# V.I.E.W — Virtual Intelligence & Early Warning System

<div align="center">
  <h3>Next-Generation Border Surveillance & Defense Console</h3>
  <p>Engineered by <strong>Team RootError</strong> for SIH 26187 | Problem Statement: Border Surveillance System</p>
</div>

---

## Overview

**V.I.E.W** (Virtual Intelligence & Early Warning) is a state-of-the-art border surveillance system utilizing deep learning and advanced analytics to detect illegal crossings and suspicious activities in real-time. Built as a tactical, ultra-premium command and control console, it moves away from bulky, traditional security layouts and introduces an elegant, minimalist, pure-analog design aesthetic — utilizing a strictly "Black, White, and Yellow" palette.

It integrates seamlessly with advanced AI inference pipelines (Optical, Thermal, IR, and ANPR) to provide real-time situational awareness, troop verification, virtual fence intrusion detection, and drone-based surveillance.

---

## Features

- **Real-Time Object Detection** — Detects humans, vehicles, and contraband using **YOLOv11** with sub-second inference latency.
- **Virtual Zero-Line Fencing** — Custom polygonal intrusion zones with automated AI bounding boxes and instant threat flagging.
- **Anomaly Detection** — Identifies unusual movements, dwell patterns, and suspicious activities at the border perimeter.
- **ANPR Registry** — Automated Number Plate Recognition for instant verification of authorized combat/logistics vehicles vs. flagged civilian entities.
- **Facial Roster Verification** — Verifies active-duty personnel (Officers, NCOs, ORs) against the BSF deployment roster in real-time.
- **Drone Integration** — Simulates drone-based surveillance with real-time video streaming and geo-referenced overlays.
- **Alert System** — Sends instant notifications for detected threats via WebSocket, FCM push, and MQTT edge signals.
- **Incident Manager & Telemetry** — Operator logs, GPS coordinates, automated FPS/hardware telemetry, and alert acknowledgment workflow.
- **Web Interface** — Interactive V.I.E.W dashboard to monitor border activities with analog HUD overlays.

---

## Architecture

V.I.E.W operates on a two-layer native high-performance stack — **strictly avoiding Docker/WSL** to ensure bare-metal execution speeds on Windows-based tactical field servers.

```
┌─────────────────────────────────────┐
│      Operator Browser (V.I.E.W)     │  HTML + CSS + Vanilla JS
│      http://localhost:3000          │
└────────────────┬────────────────────┘
                 │ REST + WebSocket (Socket.IO)
                 ▼
┌─────────────────────────────────────┐
│   Node.js Middleware (boot.ts)      │  TypeScript + Hono Framework
│   Port: 3000                        │  PostgreSQL · Redis · MQTT
└────────────────┬────────────────────┘
                 │ Redis Pub/Sub
                 ▼
┌─────────────────────────────────────┐
│   Python AI Runtime (FastAPI)       │  YOLOv11 · OpenCV · FaceNet
│   Port: 8000                        │  HUMAN · VEHICLE · VIRTUAL_FENCE
└─────────────────────────────────────┘
```

---

## Tech Stack

### AI / ML
| Library | Purpose |
|---------|---------|
| **PyTorch** | Deep learning inference engine |
| **YOLOv11** (Ultralytics) | Real-time object detection — humans, vehicles, contraband |
| **OpenCV** | Video frame processing, RTSP stream decoding |
| **FaceNet / DeepFace** | Facial recognition & troop roster verification |

### Backend — Node.js Middleware
| Library | Purpose |
|---------|---------|
| **TypeScript** | Type-safe codebase with `NodeNext` module resolution |
| **Hono** | Ultra-fast HTTP framework (faster than Express) |
| **Socket.IO** | Sub-millisecond WebSocket event streaming to the dashboard |
| **PostgreSQL 16** | Primary data store (native Windows service, port 5432) |
| **Redis** | High-throughput AI event Pub/Sub bridge (port 6379) |
| **MQTT** | Edge-sensor health polling and physical alert signaling |
| **Zod** | Runtime environment variable and request body validation |
| **jose** | JWT signing and verification (ESM-native) |

### Backend — Python AI Runtime
| Library | Purpose |
|---------|---------|
| **FastAPI** | High-performance async API for AI inference |
| **Uvicorn** | ASGI server for FastAPI |
| **ioredis** | Publishing AI events to Redis channels |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **HTML5** | Semantic markup for dashboard layout |
| **CSS3** | Analog wireframe aesthetic — zero `border-radius`, pure black/white/yellow |
| **Vanilla JS (ES6)** | Zero-framework thin client — Socket.IO + REST API calls |
| **JetBrains Mono** | Telemetry, coordinates, timestamps typography |

### Tools
| Tool | Purpose |
|------|---------|
| **Git** | Version control |
| **VS Code** | Primary IDE |
| **pnpm** | Node.js package manager (v10+) |
| **pgAdmin** | PostgreSQL management UI |

---

## Installation

### Prerequisites
- **OS:** Windows 10/11
- **Node.js:** v20+
- **Python:** 3.10+
- **Package Manager:** `pnpm` (v10+)
- **Database:** PostgreSQL 16 (running as a native Windows service on port `5432`)
- **Services:** Redis (port `6379`), MQTT Broker (port `1883`)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Border-Surveilance-AI
```

### 2. Install Python AI Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Node.js Middleware Dependencies

```bash
cd app
pnpm install
```

### 4. Database Setup

Ensure your native PostgreSQL service is running. Open pgAdmin (or `psql`) and create the database:

```sql
CREATE DATABASE "border-surveilance";
```

> Warning: The database name must match exactly, including the spelling.

### 5. Configure Environment Variables

Inside the `app/` directory, edit the `.env` file:

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=border-surveilance

# Redis / MQTT
REDIS_URL=redis://127.0.0.1:6379
MQTT_BROKER_URL=mqtt://127.0.0.1:1883

# Tactical Demo Mode
DEMO_MODE=true
```

---

## Usage

### Start the Python AI Runtime (FastAPI)

```bash
uvicorn app.main:app --reload
```

The AI pipeline will be available at `http://localhost:8000`.

### Start the Node.js Middleware & Dashboard

```bash
cd app
pnpm run dev
```

The `boot.ts` spine automatically verifies connections to PostgreSQL, Redis, and MQTT, then boots the HTTP server and WebSocket.

**Open the V.I.E.W Console:** `http://localhost:3000`

### Demo Mode

If `DEMO_MODE=true` is set (default), on startup the system will automatically:
1. Provision all 7 PostgreSQL tables if they don't exist.
2. Seed the database with military mock data — 4 cameras, 5 troops, 5 vehicles, and 4 virtual fence zones.
3. Start a live AI simulation ticker that emits real-time intrusion and verification events over WebSocket every 3.5 seconds.

---

## Database Schema

The system uses 7 interconnected PostgreSQL tables with UUID primary keys:

| Table | Description |
|-------|-------------|
| `cameras` | Registered RTSP edge sensors and their operational status |
| `zones` | Polygonal virtual fence zones (Red, Amber, Green, Corridor) per camera |
| `personnel` | Active-duty BSF/Army roster for facial recognition cross-reference |
| `vehicles` | Authorized vehicle registry for ANPR validation |
| `ai_events` | High-volume log of every AI bounding box and inference trigger |
| `alerts` | Operator-facing incident log requiring escalation or acknowledgment |
| `users` | System operator accounts (JWT-based authentication) |

---

## UI/UX Design Philosophy

The V.I.E.W frontend is meticulously crafted to emulate high-end analog hardware:

- **The "Dieter Rams" Approach** — Zero rounded corners (`border-radius: 0px`). Single-pixel wireframe borders replace bulky background cards.
- **OLED Black (`#000000`)** — Reduces operator eye strain in dark command centers and provides infinite contrast ratio.
- **High-Visibility Yellow (`#FFD600`)** — The singular accent color used exclusively for active tracking cursors, zone boundaries, and critical action buttons.
- **Red / Green Status Indicators** — Reserved strictly for alert severity and sensor health. Never used decoratively.
- **Typography** — `JetBrains Mono` for all telemetry, GPS coordinates, and timestamps. `Inter` (300 weight) for clean, heavily-tracked headers.

---

## API Integration

The thin-client frontend communicates strictly through two channels:

### REST Endpoints (Public — no auth in demo mode)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Check status of PostgreSQL, Redis, and MQTT |
| `GET` | `/api/demo/summary` | Full snapshot: cameras, personnel, vehicles, alerts |
| `POST` | `/api/demo/trigger-breach` | Inject a live HIGH-severity Zero-Line intrusion event |
| `POST` | `/api/demo/alerts/:id/acknowledge` | Acknowledge an open alert |

### WebSocket Events (Socket.IO)
| Event | Direction | Description |
|-------|-----------|-------------|
| `demo:init` | Server → Client | Full data store snapshot on connection |
| `event:human` | Server → Client | Real-time troop verification or unknown person detection |
| `event:vehicle` | Server → Client | ANPR scan result — verified or flagged plate |
| `event:fence` | Server → Client | Virtual fence intrusion detected |
| `alert` | Server → Client | High-priority consolidated alert |

---

## Team: RootError

Engineered and developed for the **Smart India Hackathon 2026** by team **RootError**:

| Member | Role / Designation | Contact & Connect | Core Expertise & Focus Areas |
|:---|:---|:---|:---|
| **Humza Ahmad** | **Team Leader**<br>Full-Stack & AI Architect | `+91 8240253854`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/humza-ahmad-n0th1ng/) | Software Engineering, Artificial Intelligence, Full-Stack Development, and Computer Vision. |
| **Mizan Ur Rahman Mondal** | Embedded Systems & Hardware Specialist | `+91 70036 70838`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mizan-mondal/) | Hardware Prototyping, Embedded Systems, IoT Sensor Integration & Physical Computing. |
| **Farhan Ahmad** | Frontend Architect & Integration Lead | `+91 98691 60286`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/farhan-ahmad-398b6b307/) | Frontend Architecture, UI/UX Engineering, System Component Binding & Client Integration. |
| **Suhana Paul** | AI / CV Engineer & Technical Presentation | `+91 93300 64096`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/suhana-p-3b979a26b/) | Deep Learning Model Training, Computer Vision Pipelines, Data Analytics & Structured Presentation. |
| **Madhumita Roy** | UI/UX & Graphic Designer | `+91 83340 36426` | Graphic Design, UI Asset Creation, Visual Ergonomics & Software Development. |
| **Aaratrika Mitra** | Software Associate & Documentation | `+91 90738 04049`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/aaratrika-m-2bb913330/) | Computer Software Development, Technical Documentation & Structured Presentation. |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request.

---

## License & Confidentiality

Developed exclusively for the **Smart India Hackathon 2026 (Problem Statement 26187)**.

> Do not deploy in live operational environments without disabling `DEMO_MODE`, replacing the mock RTSP endpoints with secure hardware streams, and completing the JWT/bcrypt authentication implementation.
