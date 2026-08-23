import { describe, expect, it } from "vitest";
import { phaseFor } from "../../server/jobs/debateOrchestrator";

describe("durable debate orchestration", () => {
  it("assigns a distinct idempotency phase to each step in a round", () => {
    expect(phaseFor(1, 0)).toBe("round:1:arguments:0");
    expect(phaseFor(1, 1)).toBe("round:1:arguments:1");
    expect(phaseFor(1, 2)).toBe("round:1:arguments:2");
  });

  it("caps unexpected duplicate arguments at the completed phase", () => {
    expect(phaseFor(4, 5)).toBe("round:4:arguments:2");
  });
});
