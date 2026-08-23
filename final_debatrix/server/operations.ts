import type { Express } from "express";
import { checkDatabaseConnection, hasDatabase } from "./db";
import { checkRedisConnection, hasRedis } from "./lib/redis";
import { createLogger } from "./lib/logger";

const logger = createLogger("operations");

export function registerOperationalRoutes(app: Express): void {
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    const checks = await Promise.allSettled([
      hasDatabase ? checkDatabaseConnection() : Promise.resolve(false),
      hasRedis ? checkRedisConnection() : Promise.resolve(false),
    ]);
    const database = checks[0].status === "fulfilled" && checks[0].value;
    const redis = checks[1].status === "fulfilled" && checks[1].value;
    const ready = database && redis;

    if (!ready) {
      logger.error({ database, redis }, "Readiness check failed");
      res.status(503).json({ status: "unready", checks: { database, redis } });
      return;
    }
    res.status(200).json({ status: "ready", checks: { database, redis } });
  });
}
