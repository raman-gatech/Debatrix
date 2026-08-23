import { Job } from "bullmq";
import { createQueue, addJob } from "./queue";
import { generateArgument } from "../openai";
import { storage } from "../storage";
import { pubsub, cache } from "../lib/redis";
import { createLogger } from "../lib/logger";
import { withSpan } from "../lib/telemetry";

const logger = createLogger("argument-generator");

export const ARGUMENT_QUEUE = "argument-generation";

interface ArgumentJobData {
  debateId: string;
  personaId: string;
  personaName: string;
  personaTone: string;
  personaBias: string;
  topic: string;
  previousArguments: string[];
  roundNumber: number;
}

async function processArgumentJob(job: Job<ArgumentJobData>): Promise<string> {
  const { debateId, personaId, personaName, personaTone, personaBias, topic, previousArguments, roundNumber } =
    job.data;

  logger.info({ debateId, personaName, roundNumber }, "Generating argument");

  return withSpan(
    "generate-argument",
    async (span) => {
      span.setAttribute("debate.id", debateId);
      span.setAttribute("persona.name", personaName);
      span.setAttribute("round", roundNumber);

      const content = await generateArgument(
        topic,
        personaName,
        personaTone,
        personaBias,
        previousArguments,
        roundNumber
      );

      const argument = await storage.createArgument({
        debateId,
        personaId,
        content,
        roundNumber,
      });

      await cache.del(`debate:${debateId}:arguments`);
      await cache.del(`debate:${debateId}`);
      await cache.invalidatePattern("debates:*");

      await pubsub.publish(`debate:${debateId}`, {
        type: "argument",
        argument: {
          ...argument,
          persona: { id: personaId, name: personaName, tone: personaTone, bias: personaBias },
        },
      });

      logger.info({ debateId, argumentId: argument.id }, "Argument generated and saved");

      return content;
    },
    { "ai.model": "gpt-4o-mini" }
  );
}

export function initArgumentQueue(): void {
  createQueue({
    name: ARGUMENT_QUEUE,
    processor: processArgumentJob as (job: Job<any>) => Promise<any>,
    concurrency: 2,
  });
}

export async function queueArgumentGeneration(data: ArgumentJobData): Promise<void> {
  const job = await addJob(ARGUMENT_QUEUE, "generate", data, {
    priority: data.roundNumber,
  });

  if (!job) {
    logger.info("No queue available, generating argument synchronously");
    await processArgumentJob({ data } as Job<ArgumentJobData>);
  }
}
