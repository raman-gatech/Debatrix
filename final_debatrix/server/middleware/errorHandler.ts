import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../lib/logger";
import { ZodError } from "zod";

const logger = createLogger("error-handler");

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ""} not found`, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    logger.warn({ path: req.path, errors: err.errors }, "Validation error");
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(
      { path: req.path, statusCode: err.statusCode, code: err.code },
      err.message
    );
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  logger.error({ path: req.path, error: err.message, stack: err.stack }, "Unhandled error");

  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
