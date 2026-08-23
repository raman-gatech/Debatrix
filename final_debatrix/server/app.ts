import express from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupGraphQL } from "./graphql";
import { createLogger } from "./lib/logger";
import { hasRedis } from "./lib/redis";
import { initDebateOrchestrator, resumeActiveDebates } from "./jobs/debateOrchestrator";
import { rateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { configureSession, registerAuthRoutes } from "./auth";
import { registerOperationalRoutes } from "./operations";
import type { Server } from "http";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const logger = createLogger("server");
const isProduction = process.env.NODE_ENV === "production";

export interface ApplicationInstance {
  app: express.Express;
  server: Server;
}

function assertRuntimeConfiguration(): void {
  if (isProduction && !hasRedis) {
    throw new Error("REDIS_URL or UPSTASH_REDIS_URL is required in production for durable debates and distributed rate limits");
  }
  if (isProduction && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in production");
  }
}

export async function createApplication(): Promise<ApplicationInstance> {
  assertRuntimeConfiguration();
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({
    // Vite's development client needs a looser policy. Production permits
    // only first-party application code and the remote GitHub profile images
    // displayed after sign-in.
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  configureSession(app);

  app.use(express.json({
    limit: "32kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: false, limit: "8kb" }));
  app.use(rateLimit({ windowMs: 60 * 1000, maxRequests: 100, keyPrefix: "api" }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    const originalResJson = res.json;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (capturedJsonResponse) line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      logger.info(line.length > 500 ? `${line.slice(0, 499)}…` : line);
    });
    next();
  });

  registerOperationalRoutes(app);
  registerAuthRoutes(app);
  await setupGraphQL(app);

  if (hasRedis) {
    initDebateOrchestrator();
    await resumeActiveDebates();
    logger.info("Background job queues initialized");
  } else {
    logger.info("Redis not available, job queues disabled");
  }

  const server = await registerRoutes(app);
  app.use(errorHandler);
  return { app, server };
}
