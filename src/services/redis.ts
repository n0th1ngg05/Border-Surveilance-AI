/**
 * src/services/redis.ts
 * Redis client for caching and general key-value operations.
 * A separate dedicated client is used for Pub/Sub (see redisSubscriber.ts).
 *
 * Features:
 *  - Exponential backoff reconnect
 *  - Typed get/set/del helpers
 *  - Graceful close via closeRedis()
 */

import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

let client: Redis | null = null;

export async function connectRedis(): Promise<void> {
  client = new Redis({
    host:           config.REDIS_HOST,
    port:           config.REDIS_PORT,
    password:       config.REDIS_PASSWORD || undefined,
    lazyConnect:    true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 2) {
        return null; // stop retrying
      }
      return 300;
    },
  });

  client.on("error",       (err) => logger.warn({ err: err.message }, "Redis offline / connection refused"));
  client.on("reconnecting",()    => logger.warn("Redis: reconnecting..."));
  client.on("ready",       ()    => logger.info("Redis: connection ready"));

  await client.connect();
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

export function getRedis(): Redis {
  if (!client) {
    throw new ServiceUnavailableError("Redis (not initialised — boot order issue)");
  }
  return client;
}

// ── Typed cache helpers ──────────────────────────────────────────────────────

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const serialised = JSON.stringify(value);
  const redis = getRedis();
  if (ttlSeconds) {
    await redis.set(key, serialised, "EX", ttlSeconds);
  } else {
    await redis.set(key, serialised);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn({ key }, "Redis: failed to deserialise cached value");
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}
