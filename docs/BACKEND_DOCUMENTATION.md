# V.I.E.W Backend — Complete Technical Reference

> **Purpose of this document:** This is an exhaustive, code-level specification of the V.I.E.W backend. It is intended to be given to any developer or AI model to fully understand the backend's architecture, data contracts, API surface, and real-time event system so that any compliant frontend can be built against it without ambiguity.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Boot Sequence & Service Startup](#2-boot-sequence--service-startup)
3. [Environment Variables](#3-environment-variables)
4. [Global Middleware & Headers](#4-global-middleware--headers)
5. [Authentication System](#5-authentication-system)
6. [REST API Reference](#6-rest-api-reference)
   - [6.1 Health Check](#61-health-check)
   - [6.2 Demo Mode API](#62-demo-mode-api)
   - [6.3 Cameras API](#63-cameras-api)
   - [6.4 Alerts API](#64-alerts-api)
   - [6.5 AI Events API](#65-ai-events-api)
   - [6.6 Personnel API](#66-personnel-api)
   - [6.7 Vehicles API](#67-vehicles-api)
   - [6.8 Zones API](#68-zones-api)
7. [WebSocket (Socket.IO) Event Reference](#7-websocket-socketio-event-reference)
8. [Redis Pub/Sub Channels (Python AI → Backend)](#8-redis-pubsub-channels-python-ai--backend)
9. [MQTT Topics (Edge Devices)](#9-mqtt-topics-edge-devices)
10. [Database Schema](#10-database-schema)
11. [Error Format & HTTP Status Codes](#11-error-format--http-status-codes)
12. [Pagination Contract](#12-pagination-contract)
13. [Demo Mode Deep Dive](#13-demo-mode-deep-dive)
14. [Alert Dispatch Pipeline](#14-alert-dispatch-pipeline)
15. [Frontend Integration Checklist](#15-frontend-integration-checklist)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      OPERATOR BROWSER                       │
│  - Static HTML/CSS/JS served from /frontend                 │
│  - Communicates via REST + Socket.IO                        │
└────────────────┬───────────────────────────────┬────────────┘
                 │ HTTP REST                      │ WebSocket
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│              boot.ts  ─  Hono (HTTP Framework)              │
│  Port: 3000   |   Framework: Hono on @hono/node-server      │
│                                                             │
│  Routes:                                                    │
│    /api/auth       → Authentication (JWT login/refresh)     │
│    /api/health     → Service health checks                  │
│    /api/demo       → Demo/prototype mode (no auth)          │
│    /api/cameras    → Camera CRUD (auth required)            │
│    /api/alerts     → Alerts CRUD (auth required)            │
│    /api/events     → AI event log (auth required)           │
│    /api/personnel  → Personnel registry (auth required)     │
│    /api/vehicles   → Vehicle ANPR registry (auth required)  │
│    /api/zones      → Virtual fence zones (auth required)    │
└────────────────┬───────────────────────────────┬────────────┘
                 │                                │ emit
     ┌───────────┘                                ▼
     │         ┌──────────────────────────────────────────┐
     │         │           Socket.IO Server               │
     │         │  Events: event:human, event:vehicle,     │
     │         │          event:fence, alert, demo:init   │
     │         └───────────────────────────────┬──────────┘
     │                                         │ listens via
     ▼                                         ▼
┌─────────────┐  subscribe  ┌──────────────────────────────┐
│ PostgreSQL  │◄────────────│    Redis Pub/Sub Subscriber   │
│  Port 5432  │             │  Channels:                   │
│  DB: border-│             │    ai:human   → event:human  │
│  surveilance│             │    ai:vehicle → event:vehicle│
└─────────────┘             │    ai:fence  → event:fence  │
                            │    ai:alert  → alert         │
┌─────────────┐             └──────────────┬───────────────┘
│ Redis Cache │◄────────────────────────────┘
│  Port 6379  │  publish
└─────────────┘
       ▲
       │ publish AI events to Redis channels
┌──────┴──────────────────────────────────┐
│     Python FastAPI AI Runtime           │
│     Port: 8000 (AI_SERVICE_URL)         │
│     Pipelines:                          │
│       - HUMAN: YOLOv8 + FaceNet         │
│       - VEHICLE: ANPR OCR               │
│       - VIRTUAL_FENCE: polygon check    │
└─────────────────────────────────────────┘

┌─────────────┐
│ MQTT Broker │  ← receives HIGH-level alerts from alerts.ts
│  Port 1883  │  → edge devices (lights, sirens, barriers)
└─────────────┘
```

**Key principle:** The frontend is a "thin client." It only calls HTTP REST endpoints and listens to WebSocket events. It never connects directly to the database, Redis, or MQTT.

---

## 2. Boot Sequence & Service Startup

The `boot.ts` file is the single entry point. On `pnpm run dev` it executes these steps **in order**, and each step is non-fatal (the server boots even if Redis or MQTT are offline):

| Step | Service | What Happens on Failure |
|------|---------|------------------------|
| 1/5 | PostgreSQL | Warns & continues — DB features offline |
| 2/5 | Redis (cache client) | Warns & continues — Pub/Sub disabled |
| 3/5 | Redis Subscriber | Skipped if Redis failed |
| 4/5 | MQTT Broker | Warns & continues — edge alerts disabled |
| 5/5 | Socket.IO + HTTP | **Fatal** — cannot serve without this |

After all services are initialized, if `DEMO_MODE=true`:
1. `bootstrapDemoDatabase()` — Creates all tables (if not exist) and seeds military mock data.
2. `startDemoSimulation()` — Starts an interval (every 3.5 seconds) that emits random AI events over WebSocket.

---

## 3. Environment Variables

All variables are validated at startup using Zod. Invalid values cause an immediate crash with a descriptive error.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | HTTP server port |
| `NODE_ENV` | enum | `development` | Environment: `development`, `production`, `test` |
| `DEMO_MODE` | boolean | `true` | Enables prototype mode with auto-seeded mock data |
| `DB_HOST` | string | `localhost` | PostgreSQL host |
| `DB_PORT` | number | `5432` | PostgreSQL port |
| `DB_NAME` | string | `border-surveilance` | PostgreSQL database name *(note: intentional spelling)* |
| `DB_USER` | string | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | string | `postgres` | PostgreSQL password |
| `REDIS_HOST` | string | `localhost` | Redis host |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | *(optional)* | Redis AUTH password |
| `MQTT_BROKER_URL` | string | `mqtt://localhost:1883` | MQTT broker connection URL |
| `MQTT_USERNAME` | string | *(optional)* | MQTT username |
| `MQTT_PASSWORD` | string | *(optional)* | MQTT password |
| `AI_SERVICE_URL` | URL | `http://localhost:8000` | Python FastAPI AI runtime base URL |
| `JWT_SECRET` | string | *(default key)* | JWT signing secret — **change in production** |
| `JWT_EXPIRES_IN` | string | `24h` | JWT expiry duration |
| `MINIO_ENDPOINT` | string | `localhost` | MinIO object storage host (for snapshots) |
| `MINIO_PORT` | number | `9000` | MinIO port |
| `MINIO_BUCKET` | string | `sih26187-snapshots` | Snapshot image storage bucket |
| `LOG_LEVEL` | enum | `info` | Logging level: `trace`, `debug`, `info`, `warn`, `error` |

---

## 4. Global Middleware & Headers

Every response from the server includes the following, applied automatically:

| Middleware | Effect |
|-----------|--------|
| `requestId()` | Adds `X-Request-Id` header with a UUID to every response |
| `secureHeaders()` | Adds `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` etc. |
| `cors()` | In `development`: allows all origins (`*`). In `production`: no origins allowed by default (must be configured) |
| `prettyJSON()` | Formats JSON output with `?pretty` query param for debugging |
| `honoLogger()` | Logs every request method, path, and status to console |
| `errorHandler` | Catches all thrown errors and formats them into the [standard error envelope](#11-error-format--http-status-codes) |

---

## 5. Authentication System

### Overview

Protected routes use **JWT Bearer token** authentication. The token is verified using the `jose` library (ESM-native, no shims).

### Auth Flow

```
1. POST /api/auth/login        → Returns { token, role, expiresIn }
2. Include in all protected requests:
   Authorization: Bearer <token>
3. POST /api/auth/refresh      → Returns a new token (NOT YET IMPLEMENTED)
```

> **Current Status:** The login endpoint and token refresh are **scaffolded but not fully implemented**. The bcrypt password comparison and token issuance are stubs. For the demo, the `/api/demo/*` routes are **completely public** (no auth required), which is what the current frontend uses.

### Protected Routes

All routes under `/api/*` **except** `/api/auth/*`, `/api/health`, and `/api/demo/*` require a valid JWT:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If the token is missing, malformed, or expired, the server returns:
```json
{
  "error": "Unauthorized",
  "message": "Missing Authorization header",
  "code": "UNAUTHORIZED",
  "status": 401
}
```

### JWT Payload Structure

```typescript
interface TokenPayload {
  sub: string;         // User UUID from the `users` table
  role: "admin" | "operator" | "viewer";
  iat: number;         // Issued at (Unix timestamp)
  exp: number;         // Expiry (Unix timestamp)
}
```

### Role Permissions

| Role | Cameras | Alerts | Events | Personnel | Vehicles | Zones |
|------|---------|--------|--------|-----------|---------|-------|
| `admin` | Full CRUD | Acknowledge + Dismiss | Read | Full CRUD | Full CRUD | Full CRUD |
| `operator` | Read + Update | Acknowledge | Read | Read | Read | Read + Update |
| `viewer` | Read only | Read only | Read only | Read only | Read only | Read only |

---

## 6. REST API Reference

### Base URL
```
http://localhost:3000/api
```

All responses are `Content-Type: application/json`.

---

### 6.1 Health Check

**No authentication required.**

#### `GET /api/health`

Returns the operational status of all backend services. The frontend should call this on load to display service health.

**Response `200 OK` (all services healthy):**
```json
{
  "service": "SIH-26187 Backend",
  "timestamp": "2026-09-10T04:52:51.000Z",
  "uptime": 3842,
  "services": {
    "postgres": "ok",
    "redis": "ok",
    "mqtt": "ok"
  }
}
```

**Response `503 Service Unavailable` (at least one service down):**
```json
{
  "service": "SIH-26187 Backend",
  "timestamp": "2026-09-10T04:52:51.000Z",
  "uptime": 12,
  "services": {
    "postgres": "ok",
    "redis": "error",
    "mqtt": "error"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `service` | string | Static identifier `"SIH-26187 Backend"` |
| `timestamp` | ISO 8601 | Current server time in UTC |
| `uptime` | number | Server uptime in seconds |
| `services.postgres` | `"ok"` \| `"error"` | PostgreSQL connection test result |
| `services.redis` | `"ok"` \| `"error"` | Redis PING result |
| `services.mqtt` | `"ok"` \| `"error"` | MQTT broker connection status |

---

### 6.2 Demo Mode API

**No authentication required.** These are the primary endpoints used by the current frontend.

#### `GET /api/demo/summary`

Returns the **complete in-memory snapshot** of all demo data. This is the first call the frontend makes on page load to populate the dashboard.

**Response `200 OK`:**
```json
{
  "mode": "DEMO_PROTOTYPE",
  "timestamp": "2026-09-10T04:52:51.123Z",
  "stats": {
    "camerasOnline": 4,
    "personnelOnDuty": 5,
    "vehiclesScannedToday": 42,
    "intrusionsBlocked": 3,
    "activeThreatLevel": "ELEVATED"
  },
  "cameras": [ /* Array of DemoCamera objects — see below */ ],
  "zones": [ /* Array of DemoZone objects — see below */ ],
  "personnel": [ /* Array of DemoPersonnel objects — see below */ ],
  "vehicles": [ /* Array of DemoVehicle objects — see below */ ],
  "alerts": [ /* Array of DemoAlert objects — see below */ ]
}
```

**`stats` object:**
| Field | Type | Description |
|-------|------|-------------|
| `camerasOnline` | number | Count of active cameras |
| `personnelOnDuty` | number | Count of personnel with `on-duty` or `on-patrol` status |
| `vehiclesScannedToday` | number | Running count of ANPR scans |
| `intrusionsBlocked` | number | Running count of Zero-Line breach events |
| `activeThreatLevel` | `"NORMAL"` \| `"ELEVATED"` \| `"HIGH"` | Current sector threat level |

**`cameras[]` — DemoCamera object:**
```typescript
{
  id: string;           // e.g. "cam-01"
  name: string;         // e.g. "Sector 4 — North Border Fence"
  location: string;     // e.g. "Grid Ref 32.74N 74.88E (Forward Post Alpha)"
  rtsp_url: string;     // e.g. "rtsp://192.168.1.101:554/live/sec4_thermal"
  status: "active" | "warning" | "offline";
  fps: number;          // e.g. 30
  resolution: string;   // e.g. "1920x1080 (Thermal / Optical Dual)"
  feedType: "optical" | "thermal" | "ir";
}
```

**`zones[]` — DemoZone object:**
```typescript
{
  id: string;               // e.g. "zone-red-01"
  cameraId: string;         // References camera.id
  name: string;             // e.g. "Zero-Line Restricted Zone (No Entry)"
  type: "RED" | "AMBER" | "GREEN" | "CORRIDOR";
  dwellThreshold: number;   // seconds before dwell alert triggers (0 = instant)
}
```

**`personnel[]` — DemoPersonnel object:**
```typescript
{
  id: string;               // e.g. "p-01"
  serviceNumber: string;    // e.g. "BSF-2021-4401"
  name: string;             // e.g. "Subedar Major Rajesh Kumar"
  rank: string;             // e.g. "Officer (SM)"
  unit: string;             // e.g. "14th Rajputana Rifles"
  station: string;          // e.g. "Forward Post Alpha"
  status: "on-duty" | "on-patrol" | "off-duty";
  lastVerified: string;     // Human-readable, e.g. "2 mins ago"
}
```

**`vehicles[]` — DemoVehicle object:**
```typescript
{
  id: string;               // e.g. "v-01"
  plateNumber: string;      // e.g. "22D 109284K"
  type: "Combat" | "Transport" | "Patrol";
  model: string;            // e.g. "Mahindra Marksman Armoured"
  unit: string;             // e.g. "Quick Reaction Team (QRT)"
  status: "verified" | "flagged" | "in-transit";
  lastCheckpoint: string;   // e.g. "Checkpost Alpha (08:32 AM)"
}
```

**`alerts[]` — DemoAlert object:**
```typescript
{
  id: string;               // e.g. "alert-101"
  level: "HIGH" | "MEDIUM" | "LOW" | "VERIFIED";
  module: "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
  message: string;          // Human-readable description, may contain emoji
  cameraName: string;       // Name of the camera that triggered the alert
  zoneName?: string;        // Populated for VIRTUAL_FENCE alerts
  entityId?: string;        // Plate number, service number, or target ID
  status: "open" | "acknowledged" | "resolved";
  timestamp: string;        // Locale time string, e.g. "14:32:05"
}
```

---

#### `POST /api/demo/alerts/:id/acknowledge`

Marks an alert in the in-memory demo store as `acknowledged`.

**URL Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `:id` | string | The alert `id` from the demo store (e.g. `"alert-101"`) |

**Request Body:** None.

**Response `200 OK`:**
```json
{
  "success": true,
  "alert": {
    "id": "alert-101",
    "status": "acknowledged",
    /* ...all other DemoAlert fields... */
  }
}
```

**Response `404 Not Found`:**
```json
{ "error": "Alert not found" }
```

---

#### `POST /api/demo/trigger-breach`

Injects an **immediate, manual HIGH-severity breach alert** into the demo store. Also emits it to all connected WebSocket clients via the `demo:init` mechanism (through store mutation).

This simulates a real-time intrusion event for presentations.

**Request Body:** None.

**Response `200 OK`:**
```json
{
  "success": true,
  "alert": {
    "id": "breach-8291",
    "level": "HIGH",
    "module": "VIRTUAL_FENCE",
    "message": "🚨 MANUAL TEST: Boundary Line Crossed — Incursion Detected at Forward Post Alpha!",
    "cameraName": "Sector 4 — North Border Fence",
    "zoneName": "Zero-Line Restricted Zone",
    "entityId": "INTRUDER-99",
    "status": "open",
    "timestamp": "2:32:05 PM"
  }
}
```

> **Side Effect:** `demoStore.stats.intrusionsBlocked` is incremented by 1 and persisted in-memory.

---

### 6.3 Cameras API

**Authentication required.** All responses use the [paginated envelope](#12-pagination-contract).

**Camera Object (from DB):**
```typescript
{
  id: string;           // UUID
  name: string;         // Max 100 chars
  rtsp_url: string;     // RTSP/HTTP stream URL — must be unique
  location: string;     // Physical location description, max 255 chars
  zone_id: string | null; // UUID — optional association to a primary zone
  status: "active" | "inactive" | "error";
  created_at: string;   // ISO 8601 UTC timestamp
  updated_at: string;   // ISO 8601 UTC timestamp
}
```

#### `GET /api/cameras`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (min: 1) |
| `limit` | integer | `20` | Results per page (max: 100) |
| `status` | enum | *(none)* | Filter: `active`, `inactive`, or `error` |

**Response `200 OK`:** [Paginated envelope](#12-pagination-contract) containing `Camera[]`.

---

#### `GET /api/cameras/:id`

**URL Params:** `:id` — UUID of the camera.

**Response `200 OK`:**
```json
{
  "data": { /* Camera object */ }
}
```

**Response `404`:** Standard error envelope.

---

#### `POST /api/cameras`

Create a new camera registration.

**Request Body (`application/json`):**
```json
{
  "name": "Tower Echo — Eastern Ridge",
  "rtsp_url": "rtsp://10.1.4.105:554/live/east_ridge",
  "location": "Grid Ref 32.78N 74.95E (Tower Echo)",
  "zone_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | ✅ | 1–100 chars |
| `rtsp_url` | string (URL) | ✅ | Must be a valid URL; must be unique across all cameras |
| `location` | string | ✅ | 1–255 chars |
| `zone_id` | UUID string \| null | ❌ | Must be a valid UUID if provided |

**Response `201 Created`:**
```json
{
  "data": { /* Newly created Camera object with status: "inactive" */ }
}
```

**Response `409 Conflict`:** If `rtsp_url` is already registered.

---

#### `PUT /api/cameras/:id`

Partial update — all fields are optional (PATCH semantics, but uses PUT).

**Request Body:** Same schema as POST, all fields optional. Only provided fields are updated.

**Response `200 OK`:** `{ "data": { /* Updated Camera object */ } }`

---

#### `DELETE /api/cameras/:id`

**Hard delete** — permanently removes the camera record.

**Response `200 OK`:**
```json
{ "message": "Camera <id> deleted" }
```

---

### 6.4 Alerts API

**Authentication required.** Alerts are **created by the AI pipeline** (via `redisSubscriber` → `dispatchAlert`), not by the client. The client can only read, acknowledge, or dismiss them.

**Alert Object (from DB):**
```typescript
{
  id: string;               // UUID — same as the triggering ai_event.id
  level: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  message: string;
  camera_id: string;        // UUID
  zone_id: string | null;   // UUID
  entity_id: string | null; // Plate number, service number, or target ID
  status: "open" | "acknowledged" | "dismissed";
  snapshot_path: string | null; // Path/URL to snapshot image in MinIO
  acknowledged_by: string | null; // User UUID who acknowledged
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
}
```

#### `GET /api/alerts`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max: 100) |
| `level` | enum | *(none)* | Filter: `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `status` | enum | *(none)* | Filter: `open`, `acknowledged`, `dismissed` |
| `camera_id` | UUID | *(none)* | Filter by camera UUID |

**Response `200 OK`:** Paginated `Alert[]`, ordered newest-first.

---

#### `GET /api/alerts/:id`

**Response `200 OK`:** `{ "data": { /* Alert object */ } }`

---

#### `POST /api/alerts/:id/acknowledge`

**Auth + Role:** Any authenticated user. Sets `status = "acknowledged"` and records `acknowledged_by` = the JWT user's UUID.

**Request Body:** None.

**Response `200 OK`:** `{ "data": { /* Updated Alert object */ } }`

**Error cases:**
- `404` if alert ID not found
- `403` if alert is already `dismissed` (cannot go back to acknowledged)

---

#### `DELETE /api/alerts/:id`

Dismisses an alert (`status = "dismissed"`). **Requires `admin` or `operator` role.** Viewers receive a `403`.

**Response `200 OK`:** `{ "message": "Alert <id> dismissed" }`

---

### 6.5 AI Events API

**Authentication required.** Read-only. AI events are inserted by the backend when it processes events from the Python AI pipeline via Redis Pub/Sub.

**AI Event Object (from DB):**
```typescript
{
  id: string;                 // UUID
  camera_id: string;          // Camera UUID
  frame_index: number;        // Video frame number
  timestamp_utc: string;      // ISO 8601 UTC — time the AI processed the frame
  pipeline_module: "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
  entity_type: "PERSON" | "VEHICLE" | "UNKNOWN";
  entity_id: string | null;   // Service number, plate number, or target ID
  confidence: number;         // AI confidence score: 0.0 to 1.0
  zone_id: string | null;     // Zone UUID if the entity was inside a zone
  alert_level: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  verified: boolean;          // Whether entity was matched in the registry
  snapshot_path: string | null; // Snapshot image path
  raw_payload: object;        // Complete raw JSON from Python pipeline
  created_at: string;         // ISO 8601
}
```

#### `GET /api/events`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `50` | Results per page (max: 200) |
| `module` | enum | *(none)* | Filter: `HUMAN`, `VEHICLE`, `VIRTUAL_FENCE` |
| `camera` | string | *(none)* | Filter by `camera_id` (exact UUID match) |
| `level` | enum | *(none)* | Filter: `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `from` | ISO 8601 datetime | *(none)* | Filter events after this timestamp |
| `to` | ISO 8601 datetime | *(none)* | Filter events before this timestamp |

**Response `200 OK`:** Paginated `AIEvent[]`, ordered newest-first.

---

#### `GET /api/events/:id`

**Response `200 OK`:** `{ "data": { /* AIEvent object */ } }`

---

### 6.6 Personnel API

**Authentication required.** The personnel registry is the source of truth for facial recognition cross-referencing.

**Personnel Object (from DB):**
```typescript
{
  id: string;                     // UUID
  service_number: string;         // e.g. "BSF-2021-4401" — unique
  name: string;                   // Full name, max 150 chars
  rank: "JCO" | "OR" | "NCO" | "Officer" | "Civilian";
  unit: string;                   // e.g. "14th Rajputana Rifles"
  assigned_zone_id: string | null; // UUID of their primary assigned zone
  face_embedding_path: string | null; // Path to face embedding model file
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}
```

#### `GET /api/personnel`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Max: 100 |
| `rank` | string | *(none)* | Exact rank filter |
| `unit` | string | *(none)* | Unit name (partial match, case-insensitive) |
| `status` | enum | *(none)* | `active` or `inactive` |

**Response `200 OK`:** Paginated `Personnel[]`, ordered A–Z by name.

---

#### `GET /api/personnel/:id`

Includes `face_embedding_path` in response (not returned in the list endpoint).

---

#### `POST /api/personnel`

**Request Body:**
```json
{
  "service_number": "BSF-2026-0042",
  "name": "Constable Arjun Mehta",
  "rank": "OR",
  "unit": "Border Guard Unit",
  "assigned_zone_id": null
}
```

| Field | Required | Validation |
|-------|----------|-----------|
| `service_number` | ✅ | 1–50 chars, must be unique |
| `name` | ✅ | 1–150 chars |
| `rank` | ✅ | One of: `JCO`, `OR`, `NCO`, `Officer`, `Civilian` |
| `unit` | ✅ | 1–100 chars |
| `assigned_zone_id` | ❌ | Valid UUID or null |

**Response `201 Created`:**
```json
{
  "data": { /* Personnel object */ },
  "note": "Face embedding generation will be queued"
}
```

> **Note:** Face embedding queuing is a placeholder. The `face_embedding_path` will be `null` until a face image is uploaded and processed by the Python AI runtime.

---

#### `PUT /api/personnel/:id`

All fields optional. Updates only provided fields using `COALESCE`.

---

#### `DELETE /api/personnel/:id`

**Soft delete** — sets `status = "inactive"`. The record is preserved for audit history. Only active personnel can be deactivated (returns `404` if already inactive).

---

### 6.7 Vehicles API

**Authentication required.** ANPR-detected plates are cross-referenced against this registry.

**Vehicle Object (from DB):**
```typescript
{
  id: string;               // UUID
  plate_number: string;     // e.g. "22D 109284K" — auto-uppercased, unique
  vehicle_type: "Combat" | "Transport" | "Patrol";
  classification: string;   // e.g. "Mahindra Marksman Armoured"
  unit: string;             // Owning military unit
  status: "active" | "decommissioned";
  created_at: string;
  updated_at: string;
}
```

#### `GET /api/vehicles`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Max: 100 |
| `vehicle_type` | enum | *(none)* | `Combat`, `Transport`, `Patrol` |
| `unit` | string | *(none)* | Partial match, case-insensitive |
| `status` | enum | *(none)* | `active` or `decommissioned` |

---

#### `POST /api/vehicles`

**Request Body:**
```json
{
  "plate_number": "23A 992014P",
  "vehicle_type": "Transport",
  "classification": "Force Trax Armoured Ambulance",
  "unit": "Military Field Hospital 3"
}
```

> `plate_number` is automatically converted to uppercase. Duplicate plates return `409 Conflict`.

---

#### `DELETE /api/vehicles/:id`

**Soft delete** — sets `status = "decommissioned"`. Preserves ANPR scan history.

---

### 6.8 Zones API

**Authentication required.** Zones define virtual fence polygons on the camera feed. When a zone is created, updated, or deleted, the updated configuration is **immediately published to Redis channel `config:zones`** so the Python AI runtime receives it live without needing a restart.

**Zone Object (from DB):**
```typescript
{
  id: string;                       // UUID
  camera_id: string;                // UUID — the camera this zone belongs to
  name: string;                     // e.g. "Zero-Line Restricted Zone"
  type: "RED" | "AMBER" | "GREEN" | "CORRIDOR";
  polygon: Array<[number, number]>; // Minimum 3 points: [[x1,y1],[x2,y2],[x3,y3],...]
                                    // Coordinates are pixel-space relative to camera resolution
  dwell_threshold_seconds: number;  // Seconds before a dwell triggers an alert (0 = instant)
  active_from: string | null;       // ISO 8601 — when zone becomes active (AMBER zones require this)
  active_until: string | null;      // ISO 8601 — when zone deactivates
  created_at: string;
  updated_at: string;
}
```

**Zone Types:**
| Type | Meaning | Alert on Entry |
|------|---------|----------------|
| `RED` | Absolute restricted zone — Zero-Line | Immediate `HIGH` alert |
| `AMBER` | Time-windowed caution zone | `MEDIUM` alert after `dwell_threshold_seconds` |
| `GREEN` | Authorized holding/staging area | No alert — used for verified positives |
| `CORRIDOR` | Transit-only path | Alert if dwell exceeds threshold |

#### `GET /api/zones`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Max: 100 |
| `camera_id` | UUID | *(none)* | Filter zones for a specific camera |
| `type` | enum | *(none)* | `RED`, `AMBER`, `GREEN`, `CORRIDOR` |

---

#### `POST /api/zones`

**Request Body:**
```json
{
  "camera_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Zero-Line Restricted Zone",
  "type": "RED",
  "polygon": [[100, 250], [540, 230], [560, 380], [80, 360]],
  "dwell_threshold_seconds": 0,
  "active_from": null,
  "active_until": null
}
```

| Field | Required | Validation |
|-------|----------|-----------|
| `camera_id` | ✅ | Must reference an existing camera UUID |
| `name` | ✅ | 1–100 chars |
| `type` | ✅ | `RED`, `AMBER`, `GREEN`, or `CORRIDOR` |
| `polygon` | ✅ | Array of `[x, y]` number tuples — minimum 3 points |
| `dwell_threshold_seconds` | ❌ | Default: `30`. Min: `0` |
| `active_from` | ❌ (required for AMBER) | ISO 8601 datetime string or null |
| `active_until` | ❌ (required for AMBER) | ISO 8601 datetime string or null |

**Validation Rules:**
- `AMBER` zones **must** have both `active_from` and `active_until`
- Camera must exist in the `cameras` table
- Polygon must have ≥ 3 coordinate pairs

**Side Effect on Create/Update/Delete:** Publishes to Redis channel `config:zones`:
```json
{
  "camera_id": "<camera_uuid>",
  "zones": [ /* all Zone objects for this camera */ ]
}
```

---

## 7. WebSocket (Socket.IO) Event Reference

### Connection

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  reconnectionDelay: 2000
});
```

The server accepts both `websocket` and `polling` transports. CORS is set to `*` in development.

### Events Emitted **TO** the Client (Server → Browser)

These are events the frontend must listen for:

---

#### `demo:init`

**When:** Immediately on connection, if `DEMO_MODE=true`.

**Purpose:** Provides a full snapshot of the in-memory store so the dashboard can populate instantly without a separate REST call.

**Payload:** The entire `demoStore` object — identical structure to `GET /api/demo/summary` response body.

```javascript
socket.on("demo:init", (store) => {
  // store.cameras    → DemoCamera[]
  // store.zones      → DemoZone[]
  // store.personnel  → DemoPersonnel[]
  // store.vehicles   → DemoVehicle[]
  // store.alerts     → DemoAlert[]
  // store.stats      → { camerasOnline, personnelOnDuty, vehiclesScannedToday, intrusionsBlocked, activeThreatLevel }
});
```

---

#### `event:human`

**When:** Emitted whenever the Python AI pipeline publishes a human detection event to Redis channel `ai:human`. Also emitted every ~3.5s by the demo simulation ticker.

**Purpose:** Real-time troop verification and unidentified person alerts.

**Payload:**
```typescript
{
  camera_id: string;            // e.g. "cam-01"
  camera_name: string;          // e.g. "Sector 4 — North Border Fence"
  frame_index: number;          // e.g. 1045
  timestamp_utc: string;        // ISO 8601 UTC
  pipeline_module: "HUMAN";
  entity_type: "PERSON";
  entity_id: string | null;     // BSF service number if verified, null if unidentified
  entity_name: string | null;   // Full name if verified
  confidence: number;           // 0.0 – 1.0 (e.g. 0.94)
  verified: boolean;            // true = matched in personnel DB
  alert_level: "HIGH" | "MEDIUM" | "INFO";
  message: string;              // Human-readable description
}
```

**How frontend should react:**
- `verified: true` → Show green "Verified" indicator, update patrol roster status
- `verified: false` + `alert_level: "HIGH"` → Flash red alert, push to alert feed

---

#### `event:vehicle`

**When:** Python pipeline publishes to `ai:vehicle`, or demo ticker fires.

**Purpose:** ANPR scan results from the checkpost cameras.

**Payload:**
```typescript
{
  camera_id: string;            // e.g. "cam-02"
  camera_name: string;          // e.g. "Checkpost Alpha — Main Access Gate"
  frame_index: number;
  timestamp_utc: string;        // ISO 8601 UTC
  pipeline_module: "VEHICLE";
  entity_type: "VEHICLE";
  entity_id: string;            // Plate number, e.g. "22D 109284K"
  vehicle_type: string;         // e.g. "Patrol"
  model: string;                // e.g. "Mahindra Marksman Armoured"
  confidence: number;           // OCR confidence: 0.0 – 1.0
  verified: boolean;            // true = plate is in the vehicles registry
  alert_level: "MEDIUM" | "INFO";
  message: string;              // e.g. "ANPR Plate Scan: 22D 109284K — VERIFIED"
}
```

**How frontend should react:**
- `verified: false` → Show amber/flagged status on ANPR camera feed and alert feed
- `verified: true` → Brief green confirmation overlay

---

#### `event:fence`

**When:** Python pipeline publishes to `ai:fence`.

**Purpose:** Virtual fence intrusion detection — the most critical event type.

**Payload:**
```typescript
{
  camera_id: string;
  frame_index: number;
  timestamp_utc: string;        // ISO 8601 UTC
  pipeline_module: "VIRTUAL_FENCE";
  entity_type: "PERSON" | "VEHICLE" | "UNKNOWN";
  entity_id: string | null;
  confidence: number;
  zone_id: string;              // UUID of the zone that was breached — ALWAYS present
  alert_level: "HIGH";          // Fence intrusions are always HIGH
  snapshot_path: string | null;
}
```

**How frontend should react:**
- Immediately highlight the primary feed for this camera
- Add to alert feed as critical/red
- Sound audio alert

---

#### `alert`

**When:** Python pipeline publishes to `ai:alert`, or `POST /api/demo/trigger-breach` is called.

**Purpose:** High-priority, consolidated alert events that have already been persisted to the `alerts` DB table.

**Payload** (from demo):
```typescript
{
  id: string;                   // e.g. "alert-8291"
  level: "HIGH" | "MEDIUM";
  module: "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE";
  message: string;
  cameraName: string;
  zoneName?: string;
  entityId?: string;
  status: "open";
  timestamp: string;            // Locale time string
}
```

**How frontend should react:**
- Prepend to alert list immediately
- Increment open alert count badge
- Play audio alert tone for HIGH level

---

#### `pong`

**When:** Client emits `ping`.

**Purpose:** Keep-alive / latency measurement.

```javascript
socket.emit("ping");
socket.on("pong", () => { /* connection confirmed */ });
```

---

### Events Emitted **FROM** the Client (Browser → Server)

| Event | When to emit | Payload |
|-------|-------------|---------|
| `ping` | Periodically for keep-alive | *(none)* |

---

## 8. Redis Pub/Sub Channels (Python AI → Backend)

These are the channels the Python AI runtime **publishes to**, and the Node backend subscribes to. The frontend never interacts with Redis directly.

| Channel | Publisher | Subscriber | Purpose |
|---------|-----------|------------|---------|
| `ai:human` | Python HUMAN pipeline | `redisSubscriber.ts` | Human detections → `io.emit("event:human", payload)` |
| `ai:vehicle` | Python VEHICLE pipeline | `redisSubscriber.ts` | ANPR scans → `io.emit("event:vehicle", payload)` |
| `ai:fence` | Python VIRTUAL_FENCE pipeline | `redisSubscriber.ts` | Fence intrusions → `io.emit("event:fence", payload)` |
| `ai:alert` | Any Python pipeline | `redisSubscriber.ts` | High-priority alerts → `io.emit("alert", payload)` |
| `config:zones` | `zonesController.ts` | Python AI runtime | Zone config updates (Node → Python) |

**Minimum payload shape** (all channels require these fields or the event is discarded):
```typescript
{
  camera_id: string;      // Required
  frame_index: number;    // Required
  timestamp_utc: string;  // Required (ISO 8601)
  confidence: number;     // Required (0.0–1.0)
}
```

---

## 9. MQTT Topics (Edge Devices)

MQTT is used for **outbound** physical-world alerts only. The backend publishes to MQTT when a `HIGH` severity alert is dispatched.

| Topic Pattern | Published By | Payload | Purpose |
|--------------|-------------|---------|---------|
| `alerts/<camera_id>` | `alerts.ts dispatchAlert()` | Alert JSON | Signals physical edge hardware (lights, barriers, sirens) |

**MQTT Alert Payload:**
```json
{
  "alertId": "uuid-of-alert",
  "level": "HIGH",
  "module": "VIRTUAL_FENCE",
  "message": "Virtual fence intrusion in zone zone-red-01",
  "zoneId": "zone-red-01",
  "timestamp": "2026-09-10T04:52:51.000Z"
}
```

---

## 10. Database Schema

Database name: **`border-surveilance`** (exact spelling required)

### Tables Overview

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `cameras` | UUID | Registered RTSP edge sensors |
| `zones` | UUID | Virtual fence polygons per camera |
| `personnel` | UUID | Active duty personnel roster |
| `vehicles` | UUID | Authorized vehicle ANPR registry |
| `ai_events` | UUID | Log of every AI inference event |
| `alerts` | UUID | Operator-facing incident log |
| `users` | UUID | Operator accounts for authentication |

### Key Relationships

```
cameras (1) ──── (N) zones
cameras (1) ──── (N) ai_events
cameras (1) ──── (N) alerts
zones   (1) ──── (N) ai_events
zones   (1) ──── (N) personnel (assigned_zone_id)
ai_events (1) ── (1) alerts    (alert.id = event.id)
users (1) ────── (N) alerts    (acknowledged_by)
```

### Full Column Definitions

#### `cameras`
```sql
id            UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name          VARCHAR(100) NOT NULL
rtsp_url      TEXT NOT NULL UNIQUE
location      VARCHAR(255) NOT NULL
zone_id       UUID                         -- optional primary zone association
status        VARCHAR(20) DEFAULT 'active' -- active | inactive | error
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

#### `zones`
```sql
id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4()
camera_id                UUID
name                     VARCHAR(100) NOT NULL
type                     VARCHAR(20) NOT NULL   -- RED | AMBER | GREEN | CORRIDOR
polygon                  JSONB NOT NULL         -- [[x,y],[x,y],[x,y],...]
dwell_threshold_seconds  INT DEFAULT 30
active_from              TIMESTAMPTZ
active_until             TIMESTAMPTZ
created_at               TIMESTAMPTZ DEFAULT NOW()
updated_at               TIMESTAMPTZ DEFAULT NOW()
```

#### `personnel`
```sql
id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4()
service_number       VARCHAR(50) NOT NULL UNIQUE
name                 VARCHAR(150) NOT NULL
rank                 VARCHAR(50) NOT NULL
unit                 VARCHAR(100) NOT NULL
assigned_zone_id     UUID
face_embedding_path  TEXT          -- path to stored face embedding file
status               VARCHAR(20) DEFAULT 'active'
created_at           TIMESTAMPTZ DEFAULT NOW()
updated_at           TIMESTAMPTZ DEFAULT NOW()
```

#### `vehicles`
```sql
id               UUID PRIMARY KEY DEFAULT uuid_generate_v4()
plate_number     VARCHAR(20) NOT NULL UNIQUE
vehicle_type     VARCHAR(50) NOT NULL
classification   VARCHAR(100) NOT NULL
unit             VARCHAR(100) NOT NULL
status           VARCHAR(20) DEFAULT 'active'
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

#### `ai_events`
```sql
id               UUID PRIMARY KEY DEFAULT uuid_generate_v4()
camera_id        VARCHAR(100) NOT NULL
frame_index      BIGINT NOT NULL
timestamp_utc    TIMESTAMPTZ NOT NULL
pipeline_module  VARCHAR(50) NOT NULL   -- HUMAN | VEHICLE | VIRTUAL_FENCE
entity_type      VARCHAR(50) NOT NULL   -- PERSON | VEHICLE | UNKNOWN
entity_id        VARCHAR(100)           -- service number, plate, or target ID
confidence       REAL NOT NULL          -- 0.0 to 1.0
zone_id          VARCHAR(100)
alert_level      VARCHAR(20) DEFAULT 'INFO'
verified         BOOLEAN DEFAULT FALSE
snapshot_path    TEXT
raw_payload      JSONB
created_at       TIMESTAMPTZ DEFAULT NOW()
```

#### `alerts`
```sql
id               UUID PRIMARY KEY
level            VARCHAR(20) NOT NULL   -- HIGH | MEDIUM | LOW | INFO
message          TEXT NOT NULL
camera_id        VARCHAR(100) NOT NULL
zone_id          VARCHAR(100)
entity_id        VARCHAR(100)
status           VARCHAR(20) DEFAULT 'open'  -- open | acknowledged | dismissed
snapshot_path    TEXT
acknowledged_by  UUID                   -- user.id who acknowledged
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

---

## 11. Error Format & HTTP Status Codes

All errors follow a consistent JSON envelope:

```json
{
  "error": "Human-readable error title",
  "message": "Detailed description of what went wrong",
  "code": "MACHINE_READABLE_CODE",
  "status": 400
}
```

| HTTP Status | `code` | When Thrown |
|-------------|--------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body or query parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Valid token but insufficient role |
| 404 | `NOT_FOUND` | Requested resource does not exist |
| 409 | `CONFLICT` | Duplicate unique field (e.g., duplicate RTSP URL or plate number) |
| 422 | `VALIDATION_ERROR` | Zod schema validation failure — includes field-level errors |
| 501 | `NOT_IMPLEMENTED` | Feature scaffolded but not yet built (e.g., bcrypt login) |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled server error |

**Validation Error (422) Format:**
```json
{
  "error": "Validation Error",
  "code": "VALIDATION_ERROR",
  "status": 422,
  "details": {
    "polygon": ["A zone polygon requires at least 3 points"],
    "camera_id": ["Invalid uuid"]
  }
}
```

---

## 12. Pagination Contract

All list endpoints return this envelope:

```typescript
{
  data: T[];              // Array of items for this page
  meta: {
    total: number;        // Total count of all matching records
    page: number;         // Current page (1-indexed)
    limit: number;        // Items per page requested
    totalPages: number;   // Math.ceil(total / limit)
    hasNext: boolean;     // true if more pages exist
    hasPrev: boolean;     // true if not on the first page
  }
}
```

**Example:**
```json
{
  "data": [ /* 20 camera objects */ ],
  "meta": {
    "total": 47,
    "page": 2,
    "limit": 20,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## 13. Demo Mode Deep Dive

When `DEMO_MODE=true` (the default for development), the system operates with pre-seeded in-memory data and a live simulation ticker.

### In-Memory Store Contents

The `demoStore` object in memory contains:

**4 Cameras:**
- `cam-01`: Sector 4 North Border Fence — Thermal/Optical dual (ACTIVE)
- `cam-02`: Checkpost Alpha Main Gate — ANPR 4K optical (ACTIVE)
- `cam-03`: Tower Bravo Riverine Basin — Long Range IR (WARNING — degraded signal)
- `cam-04`: Patrol Corridor Charlie Ridge — Starlight Night-Vision (ACTIVE)

**4 Zones:**
- `zone-red-01`: Zero-Line Restricted Zone on cam-01 (dwell: 0 seconds)
- `zone-amber-01`: Ridge Patrol Buffer Corridor on cam-04 (dwell: 15 seconds)
- `zone-green-01`: Checkpost Alpha Safe Holding on cam-02 (dwell: 60 seconds)
- `zone-corr-01`: Inbound Supply Vehicle Channel on cam-02 (dwell: 10 seconds)

**5 Personnel:**
| Name | Rank | Service No. | Station |
|------|------|-------------|---------|
| SM Rajesh Kumar | Officer | BSF-2021-4401 | Forward Post Alpha |
| HAV Amit Sharma | NCO | BSF-2022-8112 | Checkpost Alpha Gate 1 |
| NK Gurpreet Singh | OR | BSF-2023-1094 | Tower Bravo Basin |
| L/NK Vikram Rathore | OR | BSF-2023-5520 | Ridge Corridor Delta |
| SEP Sunil Soren | OR | BSF-2024-9182 | Forward Post Alpha |

**5 Vehicles:**
| Plate | Type | Status |
|-------|------|--------|
| 22D 109284K | Patrol — Mahindra Marksman | verified |
| 19B 847219M | Combat — BMP-2 Sarath | verified |
| 20C 551928L | Transport — Ashok Leyland Stallion | verified |
| 23A 992014P | Transport — Force Trax Ambulance | in-transit |
| DL 01 AB 4912 | Civilian SUV | **flagged** |

**3 Pre-seeded Alerts:**
1. `alert-101` — HIGH — Zero-Line Intrusion (status: `open`)
2. `alert-102` — MEDIUM — ANPR Mismatch for DL 01 AB 4912 (status: `open`)
3. `alert-103` — VERIFIED — Troop verification for SM Rajesh Kumar (status: `resolved`)

### Simulation Ticker

Every 3.5 seconds, the ticker fires one of three event functions selected by weighted random:

| Probability | Event | Effect |
|-------------|-------|--------|
| 55% | Troop verification | Updates a random personnel's `lastVerified`, emits `event:human` |
| 30% | Vehicle ANPR scan | Emits `event:vehicle` for a random vehicle |
| 15% | Fence intrusion | Creates a new `DemoAlert`, unshifts to `demoStore.alerts`, increments `intrusionsBlocked`, emits `alert` |

**Maximum alert history:** 20 alerts (oldest removed automatically).

---

## 14. Alert Dispatch Pipeline

When the AI pipeline detects a threat, the following chain executes:

```
Python AI Runtime
      │
      │ publish JSON to Redis channel (ai:human / ai:vehicle / ai:fence / ai:alert)
      ▼
redisSubscriber.ts — handleRawMessage()
      │
      │ JSON.parse → validate minimal shape
      ▼
routeEvent() — routes by channel
      │
      ├─ ai:human  → handleHumanEvent() — INSERT into ai_events
      │              ↳ if HIGH/MEDIUM → dispatchAlert()
      │
      ├─ ai:vehicle → handleVehicleEvent() — INSERT into ai_events
      │               ↳ if HIGH/MEDIUM → dispatchAlert()
      │
      └─ ai:fence  → handleFenceEvent() — INSERT into ai_events
                     ↳ ALWAYS → dispatchAlert()

dispatchAlert(AlertPayload)
      │
      ├─ ALWAYS: writeAlertToDB() → INSERT into alerts table
      │
      ├─ HIGH:   sendFCMPush() + sendMQTTEdgeSignal()
      │          (FCM stub, MQTT publishes to alerts/<camera_id>)
      │
      └─ MEDIUM: sendFCMPush()
                 (FCM stub only)

io.emit("alert" / "event:human" / "event:vehicle" / "event:fence")
      │
      ▼
All connected dashboard browser clients
```

---

## 15. Frontend Integration Checklist

This checklist summarizes everything a frontend must implement to be fully compatible with this backend.

### On Page Load
- [ ] Call `GET /api/health` to populate service status indicators
- [ ] Call `GET /api/demo/summary` to populate device list, alert feed, roster, and vehicle table
- [ ] Connect Socket.IO: `io("http://localhost:3000", { transports: ["websocket"] })`
- [ ] Listen for `demo:init` event as a real-time alternative/replacement for the REST summary

### Real-Time Event Handling
- [ ] `event:human` → Update patrol roster card; if `verified: false` + `alert_level: HIGH`, flash alert
- [ ] `event:vehicle` → Update ANPR feed overlay; if `verified: false`, show flagged status
- [ ] `event:fence` → Trigger critical alert; highlight affected camera feed; play audio tone
- [ ] `alert` → Prepend to alert list; increment open-count badge; play audio tone for `HIGH`

### Interactive Controls
- [ ] `POST /api/demo/trigger-breach` → Manual breach simulation button
- [ ] `POST /api/demo/alerts/:id/acknowledge` → Acknowledge button on alert cards
- [ ] Emit `ping` event periodically and show connection status via `pong` response

### WebSocket Reconnection
- [ ] Implement `socket.on("disconnect")` to show disconnected state in UI
- [ ] Implement `socket.on("connect")` to restore state after reconnection (re-fetch summary)

### Data Types to Validate
- [ ] `alert.level` — `"HIGH"` → red, `"MEDIUM"` → amber, `"VERIFIED"` → green
- [ ] `camera.status` — `"active"` → green dot, `"warning"` → amber dot, `"offline"` → red dot
- [ ] `vehicle.status` — `"flagged"` → amber highlight in ANPR overlay
- [ ] `personnel.status` — `"on-patrol"` vs `"on-duty"` vs `"off-duty"` for roster icons
- [ ] `zone.type` — `"RED"` polygons render in red on camera HUD overlays

---

*Document generated: 2026-09-10 | System: SIH-26187 V.I.E.W Backend v1.0*
