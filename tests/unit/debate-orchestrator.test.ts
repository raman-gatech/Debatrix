import { describe, expect, it } from "vitest";
import { jobIdFor, phaseFor } from "../../server/jobs/debateOrchestrator";

describe("durable debate orchestration", () => {
  it("assigns a distinct idempotency phase to each step in a round", () => {
    expect(phaseFor(1, 0)).toBe("round:1:arguments:0");
    expect(phaseFor(1, 1)).toBe("round:1:arguments:1");
    expect(phaseFor(1, 2)).toBe("round:1:arguments:2");
  });

  it("caps unexpected duplicate arguments at the completed phase", () => {
    expect(phaseFor(4, 5)).toBe("round:4:arguments:2");
  });

  it("uses a Redis-safe BullMQ job ID", () => {
    const jobId = jobIdFor("debate-123", phaseFor(1, 0));

    expect(jobId).toBe("debate-debate-123-round-1-arguments-0");
    expect(jobId).not.toContain(":");
  });

  it("gives a user-initiated retry a fresh job ID", () => {
    const phase = phaseFor(1, 0);

    expect(jobIdFor("debate-123", phase, "retry-1")).toBe("debate-debate-123-round-1-arguments-0-retry-retry-1");
    expect(jobIdFor("debate-123", phase, "retry-2")).not.toBe(jobIdFor("debate-123", phase, "retry-1"));
  });
});
