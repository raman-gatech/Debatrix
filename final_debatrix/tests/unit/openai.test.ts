import { describe, expect, it } from "vitest";
import { parseJudgmentResponse } from "../../server/openai";

const candidates = [
  { id: "persona-a", name: "Advocate" },
  { id: "persona-b", name: "Skeptic" },
] as const;

describe("OpenAI judgment parsing", () => {
  it("accepts a judgment that names exactly one known debater", () => {
    expect(parseJudgmentResponse("WINNER: Skeptic\nJUDGMENT: The reasoning was more rigorous.", candidates)).toEqual({
      winnerId: "persona-b",
      judgmentSummary: "The reasoning was more rigorous.",
    });
  });

  it("rejects missing or ambiguous judge output instead of saving a corrupt winner", () => {
    expect(() => parseJudgmentResponse("JUDGMENT: No clear winner.", candidates)).toThrow("unrecognized winner");
    expect(() => parseJudgmentResponse("WINNER: Advocate\nJUDGMENT:", candidates)).toThrow("empty judgment");
    expect(() => parseJudgmentResponse("WINNER: Neither\nJUDGMENT: Tie.", candidates)).toThrow("unrecognized winner");
  });
});
