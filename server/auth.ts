import { randomBytes, createHash } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { hasDatabase, pool } from "./db";
import { createLogger } from "./lib/logger";

const logger = createLogger("auth");
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = "debatrix.sid";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface AuthenticatedUser {
  githubId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface OAuthAttempt {
  state: string;
  verifier: string;
  createdAt: number;
}

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    githubOAuth?: OAuthAttempt;
  }
}

function getAppOrigin(): string {
  const origin = process.env.APP_ORIGIN || (isProduction ? undefined : "http://localhost:5000");
  if (!origin) {
    throw new Error("APP_ORIGIN must be set in production");
  }

  const url = new URL(origin);
  if (isProduction && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use HTTPS in production");
  }
  return url.origin;
}

function getCallbackUrl(): string {
  return new URL("/api/auth/github/callback", getAppOrigin()).toString();
}

function getGitHubCredentials(): { clientId: string; clientSecret: string } | null {
  const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (isProduction && (!secret || secret.length < 32)) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  return secret || "development-only-session-secret-change-me";
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function buildCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

export function configureSession(app: Express): void {
  if (isProduction && !hasDatabase) {
    throw new Error("DATABASE_URL is required in production for persistent sessions");
  }
  if (isProduction) {
    getAppOrigin();
    if (!getGitHubCredentials()) {
      throw new Error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required in production");
    }
  }

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const store = hasDatabase && pool
    ? new (connectPgSimple(session))({
        pool: pool as never,
        tableName: "user_sessions",
        createTableIfMissing: true,
      })
    : undefined;

  app.use(session({
    name: SESSION_COOKIE_NAME,
    secret: getSessionSecret(),
    store,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }));
}

export function getAuthenticatedUser(req: Request): AuthenticatedUser | undefined {
  return req.session.user;
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!getAuthenticatedUser(req)) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
    return;
  }
  next();
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/me", (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Not signed in", code: "UNAUTHENTICATED" });
      return;
    }
    res.json({ user });
  });

  app.get("/api/auth/github", async (req, res, next) => {
    try {
      const credentials = getGitHubCredentials();
      if (!credentials) {
        res.status(503).json({ error: "GitHub sign-in is not configured", code: "AUTH_NOT_CONFIGURED" });
        return;
      }

      const state = base64Url(randomBytes(32));
      const verifier = base64Url(randomBytes(64));
      req.session.githubOAuth = { state, verifier, createdAt: Date.now() };
      await saveSession(req);

      const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", credentials.clientId);
      authorizeUrl.searchParams.set("redirect_uri", getCallbackUrl());
      authorizeUrl.searchParams.set("scope", "read:user");
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("code_challenge", buildCodeChallenge(verifier));
      authorizeUrl.searchParams.set("code_challenge_method", "S256");
      authorizeUrl.searchParams.set("allow_signup", "false");
      res.redirect(authorizeUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/github/callback", async (req, res, next) => {
    try {
      const credentials = getGitHubCredentials();
      const { code, state, error } = req.query;
      const attempt = req.session.githubOAuth;

      if (error || !credentials || typeof code !== "string" || typeof state !== "string" || !attempt ||
          state !== attempt.state || Date.now() - attempt.createdAt > OAUTH_STATE_TTL_MS) {
        delete req.session.githubOAuth;
        await saveSession(req);
        res.redirect("/?authError=github");
        return;
      }

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          code,
          redirect_uri: getCallbackUrl(),
          code_verifier: attempt.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const token = await tokenResponse.json() as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token) {
        throw new Error("GitHub token exchange failed");
      }

      const profileResponse = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token.access_token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10_000),
      });
      const profile = await profileResponse.json() as {
        id?: number;
        login?: string;
        name?: string | null;
        avatar_url?: string | null;
      };
      if (!profileResponse.ok || !profile.id || !profile.login) {
        throw new Error("GitHub identity verification failed");
      }

      // Rotate the session ID after authenticating so an ID obtained before
      // sign-in cannot be used to take over the authenticated session.
      await regenerateSession(req);
      req.session.user = {
        githubId: String(profile.id),
        login: profile.login,
        displayName: profile.name ?? null,
        avatarUrl: profile.avatar_url ?? null,
      };
      delete req.session.githubOAuth;
      await saveSession(req);
      res.redirect("/");
    } catch (error) {
      logger.error({ error }, "GitHub sign-in failed");
      next(error);
    }
  });

  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      await destroySession(req);
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
}
