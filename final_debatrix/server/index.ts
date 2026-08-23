import { createApplication } from "./app";
import { setupVite, serveStatic, log } from "./vite";
import { initTelemetry, shutdownTelemetry } from "./lib/telemetry";
import { createLogger } from "./lib/logger";
import { hasRedis, closeRedis } from "./lib/redis";
import { closeDatabase } from "./db";
import { shutdownQueues } from "./jobs/queue";

initTelemetry();
const logger = createLogger("server");

async function start(): Promise<void> {
  const { app, server } = await createApplication();

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    logger.info({ port, redis: hasRedis }, "Server started");
    log(`serving on port ${port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");
    const forceExit = setTimeout(() => process.exit(1), 30_000);
    forceExit.unref();
    try {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await shutdownQueues();
      await closeRedis();
      await closeDatabase();
      await shutdownTelemetry();
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Graceful shutdown failed");
      process.exit(1);
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

void start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Application startup failed");
  process.exit(1);
});
