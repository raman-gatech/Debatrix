import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupGraphQL } from "./graphql";
import { initTelemetry } from "./lib/telemetry";
import { createLogger } from "./lib/logger";
import { hasRedis } from "./lib/redis";
import { initArgumentQueue } from "./jobs/argumentGenerator";
import { rateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";

initTelemetry();

const logger = createLogger("server");

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyPrefix: "api",
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await setupGraphQL(app);
  logger.info("GraphQL endpoint available at /graphql");

  if (hasRedis) {
    initArgumentQueue();
    logger.info("Background job queues initialized");
  } else {
    logger.info("Redis not available, job queues disabled");
  }

  const server = await registerRoutes(app);

  app.use(errorHandler);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info({ port }, "Server started");
    log(`serving on port ${port}`);
    
    logger.info({
      features: {
        graphql: true,
        redis: hasRedis,
        jobQueues: hasRedis,
        telemetry: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      }
    }, "Feature status");
  });
})();
