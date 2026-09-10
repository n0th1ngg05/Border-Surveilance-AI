/**
 * src/models/index.ts
 * Shared TypeScript types for all domain entities.
 * These are the shapes that flow between controllers, services, and DB queries.
 */

// ── Camera ─────────────────────────────────────────────────────────────────
export interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  location: string;
  zone_id: string | null;
  status: "active" | "inactive" | "error";
  created_at: Date;
  updated_at: Date;
}

// ── Zone (Virtual Fence) ────────────────────────────────────────────────────
export type ZoneType = "RED" | "AMBER" | "GREEN" | "CORRIDOR";

export interface Zone {
  id: string;
  camera_id: string;
  name: string;
  type: ZoneType;
  /** Array of [x, y] pixel coordinate pairs defining the polygon */
  polygon: [number, number][];
  dwell_threshold_seconds: number;
  /** ISO time strings for time-restricted zones (AMBER) */
  active_from: string | null;
  active_until: string | null;
  created_at: Date;
  updated_at: Date;
}

// ── Personnel ───────────────────────────────────────────────────────────────
export type Rank = "JCO" | "OR" | "NCO" | "Officer" | "Civilian";

export interface Personnel {
  id: string;
  service_number: string;
  name: string;
  rank: Rank;
  unit: string;
  assigned_zone_id: string | null;
  face_embedding_path: string | null;
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

// ── Vehicle ─────────────────────────────────────────────────────────────────
export type VehicleType = "Combat" | "Transport" | "Patrol";

export interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: VehicleType;
  classification: string;  // e.g. "Sedan-Patrol", "SUV-Combat", "Truck-Transport"
  unit: string;
  status: "active" | "decommissioned";
  created_at: Date;
  updated_at: Date;
}

// ── AI Events ───────────────────────────────────────────────────────────────
export type PipelineModule = "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
export type AlertLevel = "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type EntityType = "PERSON" | "VEHICLE" | "UNKNOWN";

export interface AIEvent {
  id: string;
  camera_id: string;
  frame_index: number;
  timestamp_utc: Date;
  pipeline_module: PipelineModule;
  entity_type: EntityType;
  entity_id: string | null;       // recognised identity or plate number
  confidence: number;             // 0.0 – 1.0
  zone_id: string | null;
  alert_level: AlertLevel;
  verified: boolean;
  snapshot_path: string | null;
  raw_payload: Record<string, unknown>;
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export type AlertStatus = "open" | "acknowledged" | "dismissed";

export interface Alert {
  id: string;
  event_id: string;
  level: AlertLevel;
  message: string;
  camera_id: string;
  zone_id: string | null;
  entity_id: string | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  snapshot_path: string | null;
  created_at: Date;
  updated_at: Date;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "operator" | "viewer";
  created_at: Date;
}

// ── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return { data, total, page, limit, hasMore: page * limit < total };
}
