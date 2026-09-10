/**
 * src/services/alerts.ts
 * Alert dispatch service.
 * Routes alerts based on severity:
 *  HIGH   → FCM push + MQTT edge signal
 *  MEDIUM → FCM push only
 *  LOW    → Logged to DB only
 *  INFO   → Silent log
 */

import { publishAlert as mqttPublish } from "./mqtt.js";
import { query } from "./db.js";
import { logger } from "../utils/logger.js";
import type { AlertLevel } from "../models/index.js";

export interface AlertPayload {
  alertId:      string;
  level:        AlertLevel;
  module:       "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
  message:      string;
  cameraId:     string;
  zoneId?:      string;
  entityId?:    string;
  snapshotPath?: string;
  timestamp:    string;
}

export async function dispatchAlert(alert: AlertPayload): Promise<void> {
  logger.warn({ alertId: alert.alertId, level: alert.level, module: alert.module }, "Dispatching alert");

  // Always write to alerts table
  try {
    await writeAlertToDB(alert);
  } catch (err) {
    logger.error({ err, alertId: alert.alertId }, "Failed to persist alert to DB");
    // Continue — still try to notify even if DB write fails
  }

  switch (alert.level) {
    case "HIGH":
      await Promise.allSettled([
        sendFCMPush(alert),
        sendMQTTEdgeSignal(alert),
      ]);
      break;

    case "MEDIUM":
      await sendFCMPush(alert).catch((err) =>
        logger.error({ err, alertId: alert.alertId }, "FCM push failed for MEDIUM alert"),
      );
      break;

    case "LOW":
    case "INFO":
      logger.info({ alertId: alert.alertId, level: alert.level }, "Low-priority alert — logged only");
      break;
  }
}

async function writeAlertToDB(alert: AlertPayload): Promise<void> {
  await query(
    `INSERT INTO alerts
       (id, event_id, level, message, camera_id, zone_id, entity_id, status, snapshot_path, created_at)
     VALUES ($1, $1, $2, $3, $4, $5, $6, 'open', $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      alert.alertId,
      alert.level,
      alert.message,
      alert.cameraId,
      alert.zoneId    ?? null,
      alert.entityId  ?? null,
      alert.snapshotPath ?? null,
      alert.timestamp,
    ],
  );
}

async function sendFCMPush(alert: AlertPayload): Promise<void> {
  // TODO: Implement with firebase-admin
  // const { getMessaging } = await import("firebase-admin/messaging");
  // await getMessaging().send({
  //   topic: `camera_${alert.cameraId}`,
  //   notification: { title: `[${alert.level}] ${alert.module}`, body: alert.message },
  //   data: { alertId: alert.alertId, cameraId: alert.cameraId },
  //   android: { priority: alert.level === "HIGH" ? "high" : "normal" },
  // });
  logger.debug({ alertId: alert.alertId }, "[FCM PLACEHOLDER] Push would be sent here");
}

async function sendMQTTEdgeSignal(alert: AlertPayload): Promise<void> {
  const topic = `alerts/${alert.cameraId}`;
  try {
    await mqttPublish(topic, {
      alertId:   alert.alertId,
      level:     alert.level,
      module:    alert.module,
      message:   alert.message,
      zoneId:    alert.zoneId,
      timestamp: alert.timestamp,
    });
  } catch (err) {
    // MQTT failure is non-fatal — FCM already sent
    logger.error({ err, topic }, "MQTT edge signal failed");
  }
}
