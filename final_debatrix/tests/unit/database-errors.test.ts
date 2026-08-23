import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../../server/lib/databaseErrors";

describe("database error classification", () => {
  it("recognizes PostgreSQL unique constraint violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("does not misclassify ordinary errors", () => {
    expect(isUniqueViolation(new Error("database unavailable"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
