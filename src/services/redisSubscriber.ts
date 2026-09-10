/**
 * src/services/redisSubscriber.ts
 * Dedicated Redis Pub/Sub subscriber (separate connection from the cache client).
 * Bridges Python AI runtime events → Node.js event handlers.
 *
 * On any message parse error, the bad message is logged and skipped —
 * never crashes the subscriber process.
 *
 * Channels:
 *  ai:human    — human detection + troop verification events
 *  ai:vehicle  — vehicle detection + ANPR events
 *  ai:fence    — virtual fence intrusion events
 *  ai:alert    — high-priority alert events (all pipelines)
 */

import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { getIO } from "../websocket/index.js";

const CHANNELS = ["ai:human", "ai:vehicle", "ai:fence", "ai:alert"] as const;
type Channel = (typeof CHANNELS)[number];

let subscriber: Redis | null = null;

export async function startRedisSubscriber(): Promise<void> {
  subscriber = new Redis({
    host:        config.REDIS_HOST,
    port:        config.REDIS_PORT,
    password:    config.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 2) return null;
      return 300;
    },
  });

  subscriber.on("error", (err) =>
    logger.warn({ err: err.message }, "Redis subscriber offline / connection refused"),
  );

  subscriber.on("reconnecting", () =>
    logger.warn("Redis subscriber: reconnecting..."),
  );

  await subscriber.connect();
  await subscriber.subscribe(...CHANNELS);

  subscriber.on("message", (channel: string, raw: string) => {
    handleRawMessage(channel as Channel, raw);
  });

  logger.info({ channels: CHANNELS }, "Redis subscriber listening");
}

function handleRawMessage(channel: Channel, raw: string): void {
  let payload: unknown;

  // Parse — never throw out of here
  try {
    payload = JSON.parse(raw);
  } catch {
    logger.warn({ channel, raw: raw.slice(0, 200) }, "Failed to parse AI event — skipping");
    return;
  }

  // Validate minimal shape
  if (typeof payload !== "object" || payload === null) {
    logger.warn({ channel, payload }, "AI event payload is not an object — skipping");
    return;
  }

  try {
    routeEvent(channel, payload as Record<string, unknown>);
  } catch (err) {
    logger.error({ err, channel }, "Error in AI event handler — message dropped");
  }
}

function routeEvent(channel: Channel, payload: Record<string, unknown>): void {
  const io = getIO();

  switch (channel) {
    case "ai:human":
      logger.debug({ channel, entityId: payload["entity_id"] }, "Human event");
      // TODO: await handleHumanEvent(payload) — will persist to DB
      io.emit("event:human", payload);
      break;

    case "ai:vehicle":
      logger.debug({ channel, plate: payload["entity_id"] }, "Vehicle event");
      // TODO: await handleVehicleEvent(payload)
      io.emit("event:vehicle", payload);
      break;

    case "ai:fence":
      logger.warn({ channel, zone: payload["zone_id"] }, "Fence intrusion event");
      // TODO: await handleFenceEvent(payload)
      io.emit("event:fence", payload);
      break;

    case "ai:alert": {
      const level = payload["level"] ?? "UNKNOWN";
      logger.warn({ channel, level, cameraId: payload["camera_id"] }, "HIGH PRIORITY alert");
      // TODO: dispatchAlert(payload)
      io.emit("alert", payload);
      break;
    }

    default:
      logger.warn({ channel }, "Unknown Pub/Sub channel — no handler registered");
  }
}
