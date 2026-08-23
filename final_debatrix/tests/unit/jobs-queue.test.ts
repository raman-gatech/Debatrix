import { describe, expect, it } from "vitest";
import { isFinalAttempt } from "../../server/jobs/queue";

describe("job retry handling", () => {
  it("only treats the configured final attempt as exhausted", () => {
    expect(isFinalAttempt(1, 3)).toBe(false);
    expect(isFinalAttempt(2, 3)).toBe(false);
    expect(isFinalAttempt(3, 3)).toBe(true);
  });

  it("handles jobs with an omitted or invalid attempt count as a single attempt", () => {
    expect(isFinalAttempt(0, 0)).toBe(false);
    expect(isFinalAttempt(1, 0)).toBe(true);
  });
});
