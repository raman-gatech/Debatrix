import type { Request, Response, NextFunction } from "express";
import { getRedis, hasRedis } from "../lib/redis";
import { createLogger } from "../lib/logger";

const logger = createLogger("rate-limit");

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;

    if (hasRedis) {
      const redis = getRedis();
      if (redis) {
        try {
          const current = await redis.incr(key);
          if (current === 1) {
            await redis.pexpire(key, windowMs);
          }

          if (current > maxRequests) {
            logger.warn({ ip, key, current }, "Rate limit exceeded");
            res.status(429).json({ error: "Too many requests, please try again later" });
            return;
          }

          res.setHeader("X-RateLimit-Limit", maxRequests.toString());
          res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - current).toString());

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
      res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", (maxRequests - 1).toString());
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      logger.warn({ ip, key, count: record.count }, "Rate limit exceeded (in-memory)");
      res.status(429).json({ error: "Too many requests, please try again later" });
      return;
    }

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count).toString());

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
