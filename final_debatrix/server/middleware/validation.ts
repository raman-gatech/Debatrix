import type { NextFunction, Request, Response, RequestHandler } from "express";
import { GraphQLError } from "graphql";
import { z, type ZodTypeAny } from "zod";

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

export const resourceIdSchema = nonEmptyText(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid resource identifier");

export const resourceParamsSchema = z.object({ id: resourceIdSchema }).strict();

export const debateListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "paused", "completed", "error", "all"]).optional(),
  sortBy: z.enum(["newest", "oldest", "arguments"]).optional(),
}).strict();

export const createDebateRequestSchema = z.object({
  topic: nonEmptyText(500).min(10, "Topic must be at least 10 characters"),
  personaAName: nonEmptyText(80),
  personaATone: nonEmptyText(160),
  personaABias: nonEmptyText(500),
  personaBName: nonEmptyText(80),
  personaBTone: nonEmptyText(160),
  personaBBias: nonEmptyText(500),
  totalRounds: z.number().int().min(1).max(10).default(3),
}).strict().superRefine((input, ctx) => {
  if (input.personaAName.toLocaleLowerCase() === input.personaBName.toLocaleLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["personaBName"],
      message: "Debaters must have distinct names",
    });
  }
});

export const personaRequestSchema = z.object({
  name: nonEmptyText(80),
  tone: nonEmptyText(160),
  bias: nonEmptyText(500),
}).strict();

export const voteRequestSchema = z.object({
  argumentId: resourceIdSchema,
  debateId: resourceIdSchema,
}).strict();

export const graphQLRequestSchema = z.object({
  query: nonEmptyText(12_000),
  variables: z.record(z.unknown()).optional(),
  operationName: z.string().trim().max(128).nullable().optional(),
}).strict();

export const webSocketMessageSchema = z.object({
  type: z.literal("join"),
  debateId: resourceIdSchema,
}).strict();

type ValidationTargets = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

function validationDetails(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

export function validate(targets: ValidationTargets): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [target, schema] of Object.entries(targets) as Array<[keyof ValidationTargets, ZodTypeAny | undefined]>) {
      if (!schema) continue;
      const parsed = schema.safeParse(req[target]);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: validationDetails(parsed.error),
        });
        return;
      }
      (req as unknown as Record<string, unknown>)[target] = parsed.data;
    }
    next();
  };
}

export function parseGraphQLInput<TSchema extends ZodTypeAny>(schema: TSchema, input: unknown): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  throw new GraphQLError("Validation failed", {
    extensions: {
      code: "BAD_USER_INPUT",
      details: validationDetails(parsed.error),
    },
  });
}
