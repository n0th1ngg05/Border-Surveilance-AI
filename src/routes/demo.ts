/**
 * src/routes/demo.ts
 *
 * REST endpoints for Demo / Prototype Mode.
 * Returns initial state for cameras, zones, troops, vehicles, and active alerts.
 */

import { Hono } from "hono";
import { demoStore } from "../services/demoMode.js";

const router = new Hono();

router.get("/summary", (c) => {
  return c.json({
    mode: "DEMO_PROTOTYPE",
    stats: demoStore.stats,
    cameras: demoStore.cameras,
    zones: demoStore.zones,
    personnel: demoStore.personnel,
    vehicles: demoStore.vehicles,
    alerts: demoStore.alerts,
    timestamp: new Date().toISOString(),
  });
});

// Acknowledge alert in demo store
router.post("/alerts/:id/acknowledge", (c) => {
  const id = c.req.param("id");
  const alert = demoStore.alerts.find((a) => a.id === id);
  if (alert) {
    alert.status = "acknowledged";
    return c.json({ success: true, alert });
  }
  return c.json({ error: "Alert not found" }, 404);
});

// Trigger an on-demand breach test for the presentation!
router.post("/trigger-breach", (c) => {
  const alertId = `breach-${Date.now().toString().slice(-4)}`;
  const breachAlert = {
    id: alertId,
    level: "HIGH" as const,
    module: "VIRTUAL_FENCE" as const,
    message: "🚨 MANUAL TEST: Boundary Line Crossed — Incursion Detected at Forward Post Alpha!",
    cameraName: "Sector 4 — North Border Fence",
    zoneName: "Zero-Line Restricted Zone",
    entityId: "INTRUDER-99",
    status: "open" as const,
    timestamp: new Date().toLocaleTimeString(),
  };
  demoStore.alerts.unshift(breachAlert);
  demoStore.stats.intrusionsBlocked += 1;
  return c.json({ success: true, alert: breachAlert });
});

export default router;
