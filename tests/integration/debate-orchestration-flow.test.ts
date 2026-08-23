import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

vi.mock("../../server/openai", () => ({
  generateArgument: vi.fn(),
  judgeDebate: vi.fn(),
}));

import { processDebateStep, phaseFor } from "../../server/jobs/debateOrchestrator";
import { generateArgument, judgeDebate } from "../../server/openai";
import { storage } from "../../server/storage";

describe("debate orchestration flow", () => {
  it("creates both arguments and completes the debate with a judgment", async () => {
    const personaA = await storage.createPersona({
      name: "Flow Advocate",
      tone: "Analytical",
      bias: "Supports careful local testing",
    });
    const personaB = await storage.createPersona({
      name: "Flow Skeptic",
      tone: "Critical",
      bias: "Questions unverified releases",
    });
    const debate = await storage.createDebate({
      topic: "Should teams verify software locally before deployment?",
      personaAId: personaA.id,
      personaBId: personaB.id,
      totalRounds: 1,
    });

    vi.mocked(generateArgument)
      .mockResolvedValueOnce("Local checks reveal defects before users encounter them.")
      .mockResolvedValueOnce("Checks should be meaningful, not merely ceremonial.");
    vi.mocked(judgeDebate).mockResolvedValue({
      winnerId: personaA.id,
      judgmentSummary: "The advocate gave the stronger evidence-based case.",
    });

    await processDebateStep({ data: { debateId: debate.id, phase: phaseFor(1, 0) } } as Job<any>);
    await processDebateStep({ data: { debateId: debate.id, phase: phaseFor(1, 1) } } as Job<any>);
    await processDebateStep({ data: { debateId: debate.id, phase: phaseFor(1, 2) } } as Job<any>);

    const argumentsInDebate = await storage.getArgumentsByDebate(debate.id);
    const completedDebate = await storage.getDebate(debate.id);

    expect(argumentsInDebate).toHaveLength(2);
    expect(argumentsInDebate.map((argument) => argument.personaId)).toEqual([personaA.id, personaB.id]);
    expect(judgeDebate).toHaveBeenCalledOnce();
    expect(completedDebate).toMatchObject({
      status: "completed",
      winnerId: personaA.id,
      judgmentSummary: "The advocate gave the stronger evidence-based case.",
    });
  });
});
