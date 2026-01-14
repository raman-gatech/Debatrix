import { Queue, Worker, Job } from "bullmq";
import { hasRedis } from "../lib/redis";
import { createLogger } from "../lib/logger";

const logger = createLogger("jobs");

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

interface JobData {
  [key: string]: any;
}

interface QueueConfig {
  name: string;
  processor: (job: Job<any>) => Promise<any>;
  concurrency?: number;
}

const queues: Map<string, Queue> = new Map();
const workers: Map<string, Worker> = new Map();

export function createQueue(config: QueueConfig): Queue | null {
  if (!hasRedis || !REDIS_URL) {
    logger.warn("Redis not available, job queues disabled");
    return null;
  }

  const queue = new Queue(config.name, {
    connection: {
      url: REDIS_URL,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  });

  const worker = new Worker(config.name, config.processor, {
    connection: {
      url: REDIS_URL,
    },
    concurrency: config.concurrency || 5,
  });

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: config.name }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: config.name, error: err.message }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ queue: config.name, error: err.message }, "Worker error");
  });

  queues.set(config.name, queue);
  workers.set(config.name, worker);

  logger.info({ queue: config.name }, "Queue initialized");

  return queue;
}

export function getQueue(name: string): Queue | null {
  return queues.get(name) || null;
}

export async function addJob(
  queueName: string,
  name: string,
  data: JobData,
  options?: {
    delay?: number;
    priority?: number;
  }
): Promise<Job | null> {
  const queue = queues.get(queueName);
  if (!queue) {
    logger.warn({ queue: queueName }, "Queue not found, running synchronously");
    return null;
  }

  const job = await queue.add(name, data, {
    delay: options?.delay,
    priority: options?.priority,
  });

  logger.debug({ jobId: job.id, queue: queueName, name }, "Job added");

  return job;
}

export async function shutdownQueues(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];

  workers.forEach((worker, name) => {
    logger.info({ queue: name }, "Shutting down worker");
    shutdownPromises.push(worker.close());
  });

  queues.forEach((queue, name) => {
    logger.info({ queue: name }, "Shutting down queue");
    shutdownPromises.push(queue.close());
  });

  await Promise.all(shutdownPromises);
  logger.info("All queues shut down");
}

export { Queue, Worker, Job };
