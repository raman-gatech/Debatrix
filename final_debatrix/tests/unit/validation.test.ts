import { describe, expect, it, vi } from "vitest";
import {
  createDebateRequestSchema,
  parseGraphQLInput,
  voteRequestSchema,
} from "../../server/middleware/validation";
import { rateLimit } from "../../server/middleware/rateLimit";

describe("request validation", () => {
  const validDebate = {
    topic: "Should governments regulate artificial intelligence?",
    personaAName: "Advocate",
    personaATone: "Analytical",
    personaABias: "Supports responsible innovation",
    personaBName: "Skeptic",
    personaBTone: "Cautious",
    personaBBias: "Prioritizes public safety",
  };

  it("normalizes valid debate input and supplies the round default", () => {
    const parsed = createDebateRequestSchema.parse({ ...validDebate, topic: `  ${validDebate.topic}  ` });
    expect(parsed.topic).toBe(validDebate.topic);
    expect(parsed.totalRounds).toBe(3);
  });

  it("rejects oversized or unexpected debate input", () => {
    expect(() => createDebateRequestSchema.parse({ ...validDebate, topic: "x".repeat(501) })).toThrow();
    expect(() => createDebateRequestSchema.parse({ ...validDebate, admin: true })).toThrow();
  });

  it("requires safe, bounded vote identifiers", () => {
    expect(voteRequestSchema.safeParse({ argumentId: "arg_123", debateId: "debate-123" }).success).toBe(true);
    expect(voteRequestSchema.safeParse({ argumentId: "../argument", debateId: "debate-123" }).success).toBe(false);
  });

  it("returns a GraphQL BAD_USER_INPUT error for invalid mutation data", () => {
    try {
      parseGraphQLInput(voteRequestSchema, { argumentId: "", debateId: "debate-123" });
      throw new Error("Expected validation to throw");
    } catch (error: any) {
      expect(error.extensions.code).toBe("BAD_USER_INPUT");
    }
  });

  it("requires a debate to use distinct persona names", () => {
    const result = createDebateRequestSchema.safeParse({
      topic: "Should governments regulate artificial intelligence?",
      personaAName: "Advocate",
      personaATone: "Analytical",
      personaABias: "Supports responsible innovation",
      personaBName: "advocate",
      personaBTone: "Cautious",
      personaBBias: "Prioritizes public safety",
      totalRounds: 1,
    });

    expect(result.success).toBe(false);
  });
});

describe("rate limiting", () => {
  it("returns 429 after the configured request limit", async () => {
    const limiter = rateLimit({ windowMs: 60_000, maxRequests: 1, keyPrefix: `test-${Date.now()}` });
    const req = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } } as any;
    const setHeader = vi.fn();
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { setHeader, status, json } as any;

    await limiter(req, response, vi.fn());
    await limiter(req, response, vi.fn());

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "RATE_LIMITED" }));
    expect(setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });
});
