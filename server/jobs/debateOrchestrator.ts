import type { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { cache, hasRedis, pubsub } from "../lib/redis";
import { generateArgument, judgeDebate } from "../openai";
import { storage } from "../storage";
import { createLogger } from "../lib/logger";
import { addJob, createQueue } from "./queue";

const logger = createLogger("debate-orchestrator");
export const DEBATE_ORCHESTRATION_QUEUE = "debate-orchestration";

interface DebateStepJobData {
  debateId: string;
  phase: string;
}

export function phaseFor(round: number, argumentCount: number): string {
  return `round:${round}:arguments:${Math.min(argumentCount, 2)}`;
}

// BullMQ reserves `:` for its internal Redis key structure, so application
// supplied job IDs must not contain it. Keep the human-readable phase format
// for state comparisons while using a Redis-safe representation for the job.
export function jobIdFor(debateId: string, phase: string, retryToken?: string): string {
  const id = `debate-${debateId}-${phase.replaceAll(":", "-")}`;
  return retryToken ? `${id}-retry-${retryToken}` : id;
}

async function getCurrentPhase(debateId: string): Promise<string | null> {
  const debate = await storage.getDebate(debateId);
  if (!debate || debate.status !== "active") return null;
  const argumentsInRound = (await storage.getArgumentsByDebate(debateId))
    .filter((argument) => argument.roundNumber === debate.currentRound);
  return phaseFor(debate.currentRound, argumentsInRound.length);
}

async function clearDebateCache(debateId: string): Promise<void> {
  await cache.del(`debate:${debateId}:arguments`);
  await cache.del(`debate:${debateId}`);
  await cache.invalidatePattern("debates:*");
}

async function publishDebateUpdate(debateId: string, event: Record<string, unknown>): Promise<void> {
  await pubsub.publish(`debate:${debateId}`, event);
}

export async function handleExhaustedDebateStep(job: Job<DebateStepJobData>, error: Error): Promise<void> {
  const debate = await storage.getDebate(job.data.debateId);

  // Do not overwrite a user pause, a completed debate, or a later retry that
  // has already resumed the debate.
  if (!debate || debate.status !== "active") return;

  await storage.updateDebate(debate.id, { status: "error" });
  await clearDebateCache(debate.id);
  logger.error(
    { debateId: debate.id, jobId: job.id, phase: job.data.phase, error: error.message },
    "Debate could not be advanced after all retries",
  );
  await publishDebateUpdate(debate.id, {
    type: "error",
    message: "The debate could not be advanced after several attempts. You can retry it.",
  });
}

export async function queueDebateStep(
  debateId: string,
  delay = 0,
  options: { forceNewJob?: boolean } = {},
): Promise<void> {
  const phase = await getCurrentPhase(debateId);
  if (!phase) return;

  const data: DebateStepJobData = { debateId, phase };
  if (!hasRedis) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Redis is required to orchestrate debates in production");
    }
    setTimeout(() => {
      void processDebateStep({ data } as Job<DebateStepJobData>);
    }, delay);
    return;
  }

  await addJob(DEBATE_ORCHESTRATION_QUEUE, "advance-debate", data, {
    delay,
    // A retry after an exhausted job must not reuse that failed job's ID.
    jobId: jobIdFor(debateId, phase, options.forceNewJob ? randomUUID() : undefined),
    // Free terminal job IDs so future resumes are never blocked by a stale
    // completed or failed record for the same debate phase.
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export async function processDebateStep(job: Job<DebateStepJobData>): Promise<void> {
  const { debateId, phase } = job.data;
  const debate = await storage.getDebate(debateId);
  if (!debate || debate.status !== "active") return;

  const argumentsInRound = (await storage.getArgumentsByDebate(debateId))
    .filter((argument) => argument.roundNumber === debate.currentRound);
  const currentPhase = phaseFor(debate.currentRound, argumentsInRound.length);

  // A delayed/retried job may be stale. Schedule the current state rather than
  // performing the same AI action twice.
  if (phase !== currentPhase) {
    await queueDebateStep(debateId);
    return;
  }

  if (argumentsInRound.length >= 2) {
    if (debate.currentRound < debate.totalRounds) {
      await storage.updateDebate(debateId, { currentRound: debate.currentRound + 1 });
      await clearDebateCache(debateId);
      await queueDebateStep(debateId, 2_000);
      return;
    }

    const allArguments = await storage.getArgumentsByDebate(debateId);
    const judgment = await judgeDebate(
      debate.topic,
      debate.personaA.name,
      debate.personaB.name,
      allArguments.map((argument) => ({
        personaName: argument.persona.name,
        personaId: argument.personaId,
        content: argument.content,
        roundNumber: argument.roundNumber,
      })),
    );
    await storage.setDebateWinner(debateId, judgment.winnerId, judgment.judgmentSummary);
    await clearDebateCache(debateId);
    await publishDebateUpdate(debateId, {
      type: "judgment",
      winnerId: judgment.winnerId,
      judgmentSummary: judgment.judgmentSummary,
    });
    return;
  }

  const persona = argumentsInRound.length === 0 ? debate.personaA : debate.personaB;
  await publishDebateUpdate(debateId, { type: "typing", personaName: persona.name });
  const previousArguments = (await storage.getArgumentsByDebate(debateId))
    .map((argument) => `${argument.persona.name}: ${argument.content}`);
  const content = await generateArgument(
    debate.topic,
    persona.name,
    persona.tone,
    persona.bias,
    previousArguments,
    debate.currentRound,
  );

  // Recheck state after the external request so a duplicate job cannot append
  // an argument after a pause, cancellation, or another completed step.
  const latestDebate = await storage.getDebate(debateId);
  const latestRoundArguments = latestDebate
    ? (await storage.getArgumentsByDebate(debateId)).filter((argument) => argument.roundNumber === latestDebate.currentRound)
    : [];
  if (!latestDebate || latestDebate.status !== "active" || latestDebate.currentRound !== debate.currentRound || latestRoundArguments.length !== argumentsInRound.length) {
    return;
  }

  const argument = await storage.createArgument({
    debateId,
    personaId: persona.id,
    content,
    roundNumber: debate.currentRound,
  });
  await clearDebateCache(debateId);
  await publishDebateUpdate(debateId, {
    type: "argument",
    argument: { ...argument, persona },
  });
  await queueDebateStep(debateId, 3_000);
}

export function initDebateOrchestrator(): void {
  createQueue({
    name: DEBATE_ORCHESTRATION_QUEUE,
    processor: processDebateStep,
    concurrency: 2,
    onExhausted: handleExhaustedDebateStep,
  });
}

export async function resumeActiveDebates(): Promise<void> {
  const activeDebates = (await storage.getAllDebates()).filter((debate) => debate.status === "active");
  await Promise.all(activeDebates.map((debate) => queueDebateStep(debate.id)));
  logger.info({ count: activeDebates.length }, "Resumed active debates");
}
