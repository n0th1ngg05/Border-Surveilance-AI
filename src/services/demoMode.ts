/**
 * src/services/demoMode.ts
 *
 * Presentation & Demo Mode for SIH-26187.
 * When DEMO_MODE=true:
 *  1. Auto-creates DB tables if they don't exist
 *  2. Seeds realistic military border surveillance dummy data
 *  3. In-memory fallback if PostgreSQL is offline
 *  4. Live simulation ticker that emits real-time AI detections & alerts via WebSocket
 */

import { query } from "./db.js";
import { logger } from "../utils/logger.js";
import { getIO } from "../websocket/index.js";
import { config } from "../config/index.js";

// ── In-Memory Demo Data Store (guarantees UI works even without DB) ───────────

export interface DemoCamera {
  id: string;
  name: string;
  location: string;
  rtsp_url: string;
  status: "active" | "warning" | "offline";
  fps: number;
  resolution: string;
  feedType: "optical" | "thermal" | "ir";
}

export interface DemoZone {
  id: string;
  cameraId: string;
  name: string;
  type: "RED" | "AMBER" | "GREEN" | "CORRIDOR";
  dwellThreshold: number;
}

export interface DemoPersonnel {
  id: string;
  serviceNumber: string;
  name: string;
  rank: string;
  unit: string;
  station: string;
  status: "on-duty" | "on-patrol" | "off-duty";
  lastVerified: string;
}

export interface DemoVehicle {
  id: string;
  plateNumber: string;
  type: "Combat" | "Transport" | "Patrol";
  model: string;
  unit: string;
  status: "verified" | "flagged" | "in-transit";
  lastCheckpoint: string;
}

export interface DemoAlert {
  id: string;
  level: "HIGH" | "MEDIUM" | "LOW" | "VERIFIED";
  module: "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
  message: string;
  cameraName: string;
  zoneName?: string;
  entityId?: string;
  status: "open" | "acknowledged" | "resolved";
  timestamp: string;
}

export const demoStore = {
  cameras: [
    {
      id: "cam-01",
      name: "Sector 4 — North Border Fence",
      location: "Grid Ref 32.74N 74.88E (Forward Post Alpha)",
      rtsp_url: "rtsp://192.168.1.101:554/live/sec4_thermal",
      status: "active" as const,
      fps: 30,
      resolution: "1920x1080 (Thermal / Optical Dual)",
      feedType: "thermal" as const,
    },
    {
      id: "cam-02",
      name: "Checkpost Alpha — Main Access Gate",
      location: "Grid Ref 32.72N 74.85E (Gate 1)",
      rtsp_url: "rtsp://192.168.1.102:554/live/gate1_anpr",
      status: "active" as const,
      fps: 30,
      resolution: "2560x1440 (ANPR Edge Sensor)",
      feedType: "optical" as const,
    },
    {
      id: "cam-03",
      name: "Tower Bravo — Riverine Basin Overlook",
      location: "Grid Ref 32.76N 74.91E (Observation Tower 2)",
      rtsp_url: "rtsp://192.168.1.103:554/live/tower2_ir",
      status: "warning" as const,
      fps: 25,
      resolution: "1920x1080 (Long Range IR)",
      feedType: "ir" as const,
    },
    {
      id: "cam-04",
      name: "Patrol Corridor Charlie — Ridge Perimeter",
      location: "Grid Ref 32.70N 74.82E (Patrol Post Delta)",
      rtsp_url: "rtsp://192.168.1.104:554/live/ridge_night",
      status: "active" as const,
      fps: 30,
      resolution: "1920x1080 (HD Starlight Night-Vision)",
      feedType: "optical" as const,
    },
  ],

  zones: [
    {
      id: "zone-red-01",
      cameraId: "cam-01",
      name: "Zero-Line Restricted Zone (No Entry)",
      type: "RED" as const,
      dwellThreshold: 0,
    },
    {
      id: "zone-amber-01",
      cameraId: "cam-04",
      name: "Ridge Patrol Buffer Corridor",
      type: "AMBER" as const,
      dwellThreshold: 15,
    },
    {
      id: "zone-green-01",
      cameraId: "cam-02",
      name: "Checkpost Alpha Safe Holding Area",
      type: "GREEN" as const,
      dwellThreshold: 60,
    },
    {
      id: "zone-corr-01",
      cameraId: "cam-02",
      name: "Inbound Supply Vehicle Channel",
      type: "CORRIDOR" as const,
      dwellThreshold: 10,
    },
  ],

  personnel: [
    {
      id: "p-01",
      serviceNumber: "BSF-2021-4401",
      name: "Subedar Major Rajesh Kumar",
      rank: "Officer (SM)",
      unit: "14th Rajputana Rifles",
      station: "Forward Post Alpha",
      status: "on-duty" as const,
      lastVerified: "2 mins ago",
    },
    {
      id: "p-02",
      serviceNumber: "BSF-2022-8112",
      name: "Havildar Amit Sharma",
      rank: "NCO",
      unit: "8th Mountain Division",
      station: "Checkpost Alpha Gate 1",
      status: "on-duty" as const,
      lastVerified: "4 mins ago",
    },
    {
      id: "p-03",
      serviceNumber: "BSF-2023-1094",
      name: "Naik Gurpreet Singh",
      rank: "OR",
      unit: "14th Sikh LI",
      station: "Tower Bravo Basin",
      status: "on-patrol" as const,
      lastVerified: "1 min ago",
    },
    {
      id: "p-04",
      serviceNumber: "BSF-2023-5520",
      name: "Lance Naik Vikram Rathore",
      rank: "OR",
      unit: "Sector 4 Patrol Unit",
      station: "Ridge Corridor Delta",
      status: "on-patrol" as const,
      lastVerified: "3 mins ago",
    },
    {
      id: "p-05",
      serviceNumber: "BSF-2024-9182",
      name: "Sepoy Sunil Soren",
      rank: "OR",
      unit: "Border Guard Unit",
      station: "Forward Post Alpha",
      status: "on-duty" as const,
      lastVerified: "Just now",
    },
  ],

  vehicles: [
    {
      id: "v-01",
      plateNumber: "22D 109284K",
      type: "Patrol" as const,
      model: "Mahindra Marksman Armoured",
      unit: "Quick Reaction Team (QRT)",
      status: "verified" as const,
      lastCheckpoint: "Checkpost Alpha (08:32 AM)",
    },
    {
      id: "v-02",
      plateNumber: "19B 847219M",
      type: "Combat" as const,
      model: "BMP-2 Sarath Armoured Carrier",
      unit: "4th Armoured Recon Squadron",
      status: "verified" as const,
      lastCheckpoint: "Perimeter Sector 4 (07:15 AM)",
    },
    {
      id: "v-03",
      plateNumber: "20C 551928L",
      type: "Transport" as const,
      model: "Ashok Leyland 4x4 Stallion",
      unit: "Base Supply & Logistics Dep.",
      status: "verified" as const,
      lastCheckpoint: "Gate 1 Inbound (09:12 AM)",
    },
    {
      id: "v-04",
      plateNumber: "23A 992014P",
      type: "Transport" as const,
      model: "Force Trax Armoured Ambulance",
      unit: "Military Field Hospital 3",
      status: "in-transit" as const,
      lastCheckpoint: "En route to Forward Post Alpha",
    },
    {
      id: "v-05",
      plateNumber: "DL 01 AB 4912",
      type: "Patrol" as const,
      model: "Civilian White SUV (Unverified)",
      unit: "UNKNOWN / CIVILIAN",
      status: "flagged" as const,
      lastCheckpoint: "Checkpost Alpha Buffer (FLAGGED)",
    },
  ],

  alerts: [
    {
      id: "alert-101",
      level: "HIGH" as const,
      module: "VIRTUAL_FENCE" as const,
      message: "🚨 INTRUSION DETECTED: Unknown entity crossed Zero-Line Restricted Zone",
      cameraName: "Sector 4 — North Border Fence",
      zoneName: "Zero-Line Restricted Zone",
      entityId: "UNIDENTIFIED-091",
      status: "open" as const,
      timestamp: new Date(Date.now() - 35000).toLocaleTimeString(),
    },
    {
      id: "alert-102",
      level: "MEDIUM" as const,
      module: "VEHICLE" as const,
      message: "⚠️ ANPR MISMATCH: Civilian SUV DL 01 AB 4912 detected without Base Pass",
      cameraName: "Checkpost Alpha — Main Access Gate",
      entityId: "DL 01 AB 4912",
      status: "open" as const,
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
    },
    {
      id: "alert-103",
      level: "VERIFIED" as const,
      module: "HUMAN" as const,
      message: "✅ TROOP VERIFIED: Subedar Major Rajesh Kumar (BSF-2021-4401) at Forward Post Alpha",
      cameraName: "Sector 4 — North Border Fence",
      entityId: "BSF-2021-4401",
      status: "resolved" as const,
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
    },
  ] as DemoAlert[],

  stats: {
    camerasOnline: 4,
    personnelOnDuty: 5,
    vehiclesScannedToday: 42,
    intrusionsBlocked: 3,
    activeThreatLevel: "ELEVATED" as "NORMAL" | "ELEVATED" | "HIGH",
  },
};

// ── Auto-Provision DB Schema (if DB is connected) ───────────────────────────

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    rtsp_url TEXT NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    zone_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    polygon JSONB NOT NULL,
    dwell_threshold_seconds INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    rank VARCHAR(50) NOT NULL,
    unit VARCHAR(100) NOT NULL,
    assigned_zone_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    classification VARCHAR(100) NOT NULL,
    unit VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id VARCHAR(100) NOT NULL,
    frame_index BIGINT NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    pipeline_module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    confidence REAL NOT NULL,
    zone_id VARCHAR(100),
    alert_level VARCHAR(20) DEFAULT 'INFO',
    verified BOOLEAN DEFAULT FALSE,
    snapshot_path TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    camera_id VARCHAR(100) NOT NULL,
    zone_id VARCHAR(100),
    entity_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function bootstrapDemoDatabase(): Promise<void> {
  try {
    logger.info("Initializing database schema & seeding demo data...");
    await query(SCHEMA_SQL);

    // Seed cameras if empty
    const { rows: existingCams } = await query<{ count: string }>("SELECT COUNT(*) AS count FROM cameras");
    if (Number(existingCams[0]?.count ?? 0) === 0) {
      for (const cam of demoStore.cameras) {
        await query(
          "INSERT INTO cameras (name, rtsp_url, location, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
          [cam.name, cam.rtsp_url, cam.location, cam.status],
        );
      }
      logger.info(`Seeded ${demoStore.cameras.length} cameras`);
    }

    // Seed personnel if empty
    const { rows: existingP } = await query<{ count: string }>("SELECT COUNT(*) AS count FROM personnel");
    if (Number(existingP[0]?.count ?? 0) === 0) {
      for (const p of demoStore.personnel) {
        await query(
          "INSERT INTO personnel (service_number, name, rank, unit, status) VALUES ($1, $2, $3, $4, 'active') ON CONFLICT DO NOTHING",
          [p.serviceNumber, p.name, p.rank, p.unit],
        );
      }
      logger.info(`Seeded ${demoStore.personnel.length} personnel`);
    }

    // Seed vehicles if empty
    const { rows: existingV } = await query<{ count: string }>("SELECT COUNT(*) AS count FROM vehicles");
    if (Number(existingV[0]?.count ?? 0) === 0) {
      for (const v of demoStore.vehicles) {
        await query(
          "INSERT INTO vehicles (plate_number, vehicle_type, classification, unit, status) VALUES ($1, $2, $3, $4, 'active') ON CONFLICT DO NOTHING",
          [v.plateNumber, v.type, v.model, v.unit],
        );
      }
      logger.info(`Seeded ${demoStore.vehicles.length} vehicles`);
    }

    logger.info("✅ PostgreSQL tables created and verified!");
  } catch (err) {
    logger.warn({ err }, "Database seeding skipped (using in-memory demo store)");
  }
}

// ── Live AI Simulation Ticker ────────────────────────────────────────────────
// Emits real-time AI detections & alerts every 3-5 seconds to all connected UIs

let simulationInterval: NodeJS.Timeout | null = null;
let frameCounter = 1042;

export function startDemoSimulation(): void {
  if (simulationInterval) return;

  logger.info("🎯 DEMO MODE ACTIVE: Real-time AI simulation ticker started");

  const simulationEvents = [
    // Troop verification
    () => {
      const p = demoStore.personnel[Math.floor(Math.random() * demoStore.personnel.length)]!;
      p.lastVerified = "Just now";
      frameCounter += 3;
      const event = {
        type: "event:human",
        data: {
          camera_id: "cam-01",
          camera_name: "Sector 4 — North Border Fence",
          frame_index: frameCounter,
          timestamp_utc: new Date().toISOString(),
          pipeline_module: "HUMAN",
          entity_type: "PERSON",
          entity_id: p.serviceNumber,
          entity_name: p.name,
          confidence: Number((0.92 + Math.random() * 0.07).toFixed(2)),
          verified: true,
          alert_level: "INFO",
          message: `Face Verified: ${p.rank} ${p.name} (${p.serviceNumber}) on patrol`,
        },
      };
      return event;
    },

    // Vehicle detection & ANPR
    () => {
      const v = demoStore.vehicles[Math.floor(Math.random() * demoStore.vehicles.length)]!;
      frameCounter += 3;
      const event = {
        type: "event:vehicle",
        data: {
          camera_id: "cam-02",
          camera_name: "Checkpost Alpha — Main Access Gate",
          frame_index: frameCounter,
          timestamp_utc: new Date().toISOString(),
          pipeline_module: "VEHICLE",
          entity_type: "VEHICLE",
          entity_id: v.plateNumber,
          vehicle_type: v.type,
          model: v.model,
          confidence: Number((0.89 + Math.random() * 0.09).toFixed(2)),
          verified: v.status === "verified",
          alert_level: v.status === "flagged" ? "MEDIUM" : "INFO",
          message: `ANPR Plate Scan: ${v.plateNumber} (${v.model}) — ${v.status.toUpperCase()}`,
        },
      };
      return event;
    },

    // Virtual fence breach alert
    () => {
      frameCounter += 3;
      demoStore.stats.intrusionsBlocked += 1;
      const alertId = `alert-${Date.now().toString().slice(-4)}`;
      const newAlert: DemoAlert = {
        id: alertId,
        level: "HIGH",
        module: "VIRTUAL_FENCE",
        message: `🚨 ZERO-LINE INTRUSION: Fast-moving target crossed Restricted Zone at ${demoStore.cameras[0]!.name}`,
        cameraName: demoStore.cameras[0]!.name,
        zoneName: "Zero-Line Restricted Zone",
        entityId: `TARGET-${Math.floor(100 + Math.random() * 900)}`,
        status: "open",
        timestamp: new Date().toLocaleTimeString(),
      };
      demoStore.alerts.unshift(newAlert);
      if (demoStore.alerts.length > 20) demoStore.alerts.pop();

      return {
        type: "alert",
        data: newAlert,
      };
    },
  ];

  simulationInterval = setInterval(() => {
    try {
      const io = getIO();
      // 60% troop verification, 30% vehicle scan, 10% intrusion alert
      const rand = Math.random();
      const eventFn = rand < 0.55 ? simulationEvents[0] : rand < 0.85 ? simulationEvents[1] : simulationEvents[2];
      const payload = eventFn!();

      // Emit to WebSocket
      io.emit(payload.type, payload.data);
    } catch {
      // WebSocket might not have connected clients yet
    }
  }, 3500);
}
