import Redis from "ioredis";
import { createLogger } from "./logger";

const logger = createLogger("redis");

let redis: Redis | null = null;
let subscriber: Redis | null = null;

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

export function getRedis(): Redis | null {
  if (!REDIS_URL) {
    return null;
  }
  
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    
    redis.on("error", (err) => {
      logger.warn({ error: err.message }, "Redis connection error");
    });
    
    redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  
  return redis;
}

export function getSubscriber(): Redis | null {
  if (!REDIS_URL) {
    return null;
  }
  
  if (!subscriber) {
    subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  
  return subscriber;
}

export const hasRedis = !!REDIS_URL;

export async function checkRedisConnection(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  await client.ping();
  return true;
}

export async function closeRedis(): Promise<void> {
  const clients = [redis, subscriber].filter((client): client is Redis => client !== null);
  await Promise.all(clients.map((client) => client.quit()));
  redis = null;
  subscriber = null;
}

export class CacheService {
  private redis: Redis | null;
  private defaultTTL = 300;

  constructor() {
    this.redis = getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn({ error }, "Cache get failed");
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl = this.defaultTTL): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn({ error }, "Cache set failed");
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.warn({ error }, "Cache delete failed");
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      // KEYS blocks Redis while walking the whole keyspace. SCAN bounds each
      // operation, which keeps cache invalidation safe as the cache grows.
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== "0");
    } catch (error) {
      logger.warn({ error, pattern }, "Cache pattern invalidation failed");
    }
  }
}

export class PubSubService {
  private publisher: Redis | null;
  private subscriber: Redis | null;
  private handlers: Map<string, ((message: any) => void)[]> = new Map();

  constructor() {
    this.publisher = getRedis();
    this.subscriber = getSubscriber();
    this.setupSubscriber();
  }

  private setupSubscriber() {
    if (!this.subscriber) return;
    
    this.subscriber.on("message", (channel, message) => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        try {
          const parsed = JSON.parse(message);
          handlers.forEach((handler) => handler(parsed));
        } catch (error) {
          logger.warn({ error, channel }, "Discarded malformed pubsub message");
        }
      }
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    if (!this.publisher) return;
    
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.warn({ error, channel }, "Pubsub publish failed");
    }
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.subscriber) return;
    
    const handlers = this.handlers.get(channel) || [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);
    
    try {
      await this.subscriber.subscribe(channel);
    } catch (error) {
      logger.warn({ error, channel }, "Pubsub subscribe failed");
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return;
    
    this.handlers.delete(channel);
    
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      logger.warn({ error, channel }, "Pubsub unsubscribe failed");
    }
  }
}

export const cache = new CacheService();
export const pubsub = new PubSubService();
