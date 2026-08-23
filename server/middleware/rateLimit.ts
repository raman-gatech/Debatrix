import type { Request, Response, NextFunction } from "express";
import { getRedis, hasRedis } from "../lib/redis";
import { createLogger } from "../lib/logger";

const logger = createLogger("rate-limit");

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = "rl", keyGenerator, skip } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) return next();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${keyGenerator?.(req) || ip}`;

    const setRateLimitHeaders = (current: number, resetAt: number) => {
      res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - current).toString());
      res.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000).toString());
    };

    const sendRateLimitExceeded = (current: number, resetAt: number) => {
      logger.warn({ ip, key, current }, "Rate limit exceeded");
      setRateLimitHeaders(current, resetAt);
      res.setHeader("Retry-After", Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)).toString());
      res.status(429).json({ error: "Too many requests, please try again later", code: "RATE_LIMITED" });
    };

    if (hasRedis) {
      const redis = getRedis();
      if (redis) {
        try {
          const current = await redis.incr(key);
          if (current === 1) {
            await redis.pexpire(key, windowMs);
          }

          if (current > maxRequests) {
            sendRateLimitExceeded(current, Date.now() + windowMs);
            return;
          }

          setRateLimitHeaders(current, Date.now() + windowMs);

          return next();
        } catch (error) {
          logger.error({ error }, "Redis rate limit error, falling back to memory");
        }
      }
    }

    const now = Date.now();
    const record = inMemoryStore.get(key);

    if (!record || now > record.resetAt) {
      inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
      setRateLimitHeaders(1, now + windowMs);
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      sendRateLimitExceeded(record.count, record.resetAt);
      return;
    }

    setRateLimitHeaders(record.count, record.resetAt);

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(inMemoryStore.entries());
  for (const [key, record] of entries) {
    if (now > record.resetAt) {
      inMemoryStore.delete(key);
    }
  }
}, 60000);
