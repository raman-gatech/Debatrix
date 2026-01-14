import Redis from "ioredis";

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
      console.error("[Redis] Connection error:", err.message);
    });
    
    redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
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
      console.error("[Cache] Get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl = this.defaultTTL): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error("[Cache] Set error:", error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("[Cache] Delete error:", error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error("[Cache] Pattern invalidation error:", error);
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
        const parsed = JSON.parse(message);
        handlers.forEach((handler) => handler(parsed));
      }
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    if (!this.publisher) return;
    
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error("[PubSub] Publish error:", error);
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
      console.error("[PubSub] Subscribe error:", error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return;
    
    this.handlers.delete(channel);
    
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error("[PubSub] Unsubscribe error:", error);
    }
  }
}

export const cache = new CacheService();
export const pubsub = new PubSubService();
