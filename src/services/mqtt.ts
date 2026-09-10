/**
 * src/services/mqtt.ts
 * MQTT client for edge-node communication.
 * Publishes physical alert signals (sirens, gate locks, lights).
 *
 * Features:
 *  - Promise-based connect with timeout
 *  - Auto-reconnect (built into mqtt.js)
 *  - Message routing for inbound edge messages
 *  - graceful close via closeMQTT()
 */

import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

let client: MqttClient | null = null;

const MQTT_OPTIONS: IClientOptions = {
  username:        config.MQTT_USERNAME,
  password:        config.MQTT_PASSWORD,
  reconnectPeriod: 3_000,
  connectTimeout:  10_000,
  keepalive:       60,
  clean:           true,
};

export function connectMQTT(): Promise<void> {
  return new Promise((resolve, reject) => {
    client = mqtt.connect(config.MQTT_BROKER_URL, MQTT_OPTIONS);

    const timeout = setTimeout(() => {
      if (client) client.end(true);
      reject(new ServiceUnavailableError("MQTT broker (connection timeout)"));
    }, 2_000);

    client.once("connect", () => {
      clearTimeout(timeout);
      logger.info({ url: config.MQTT_BROKER_URL }, "MQTT connected");
      subscribeToEdgeTopics();
      resolve();
    });

    client.once("error", (err) => {
      clearTimeout(timeout);
      if (client) client.end(true);
      reject(err);
    });

    client.on("error",       (err) => logger.error({ err }, "MQTT client error"));
    client.on("reconnect",   ()    => logger.warn("MQTT: reconnecting..."));
    client.on("offline",     ()    => logger.warn("MQTT: client offline"));
    client.on("message",     handleInboundMessage);
  });
}

export function closeMQTT(): Promise<void> {
  return new Promise((resolve) => {
    if (!client) return resolve();
    client.end(false, {}, () => {
      client = null;
      resolve();
    });
  });
}

export function getMQTT(): MqttClient {
  if (!client || !client.connected) {
    throw new ServiceUnavailableError("MQTT (not connected)");
  }
  return client;
}

/**
 * Publish a JSON payload to an edge node topic.
 * QoS 1 — at least once delivery.
 */
export function publishAlert(topic: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      getMQTT().publish(
        topic,
        JSON.stringify(payload),
        { qos: 1, retain: false },
        (err) => {
          if (err) {
            logger.error({ err, topic }, "MQTT publish failed");
            return reject(err);
          }
          logger.debug({ topic }, "MQTT alert published");
          resolve();
        },
      );
    } catch (err) {
      // getMQTT() threw because client is not connected
      logger.error({ err, topic }, "MQTT publish skipped — client not available");
      reject(err);
    }
  });
}

// ── Inbound (edge → server) ──────────────────────────────────────────────────

function subscribeToEdgeTopics(): void {
  if (!client) return;
  // Subscribe to status updates from edge nodes
  client.subscribe("edge/+/status", { qos: 0 }, (err) => {
    if (err) logger.error({ err }, "MQTT subscribe failed");
  });
}

function handleInboundMessage(topic: string, messageBuffer: Buffer): void {
  const message = messageBuffer.toString();
  logger.debug({ topic, message: message.slice(0, 200) }, "MQTT inbound message");

  try {
    const payload = JSON.parse(message) as Record<string, unknown>;
    // TODO: route edge status messages (camera offline, sensor trigger, etc.)
    void payload;
  } catch {
    logger.warn({ topic, message: message.slice(0, 100) }, "MQTT: non-JSON message received");
  }
}
