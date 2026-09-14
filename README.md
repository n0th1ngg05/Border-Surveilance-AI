# V.I.E.W — Virtual Intelligence & Early Warning System

<div align="center">
  <h3>Next-Generation Border Surveillance & Defense Console</h3>
  <p>Engineered by <strong>Team RootError</strong> for SIH 26187 | Problem Statement: Border Surveillance System</p>
</div>

---

## Overview

**V.I.E.W** (Virtual Intelligence & Early Warning) is a next-generation military-grade border surveillance and reconnaissance platform designed for perimeter security, tactical monitoring, and automated threat interception. Engineered to eliminate human operator fatigue across long-range frontiers, V.I.E.W delivers real-time AI detection, dynamic multi-stream monitor walls, automated number plate recognition (ANPR), virtual fence tripwires, and personnel roster verification.

The platform operates on a native high-performance stack — strictly avoiding Docker/WSL to ensure bare-metal execution speeds on Windows-based tactical field servers with dedicated NVIDIA RTX GPU acceleration.

---

## Key Capabilities

- **Real-Time Edge Inference (YOLO on GPU)** — Sub-second object detection for humans, tactical combat vehicles, and civilian transports accelerated via PyTorch CUDA 12.1 on NVIDIA RTX hardware.
- **Dynamic Multi-Stream Monitor Wall** — Intelligently scales to any $N$ camera feeds configured via JSON registry, rendering live MP4/RTSP streams with synchronized tactical bounding box overlays and preserved 16:9 aspect ratios.
- **Alternate-Frame Demultiplexing Engine** — Frame-interleaving pipeline scheduler (`Frame n` = Human, `Frame n+1` = Vehicle, `Frame n+2` = Virtual Fence/Pattern) maximizing GPU batch throughput without frame drops.
- **Decoupled DOM Portal Architecture** — Zero-flicker live video grid portaling (`live-grid.js`) that persists `<video>` and `<canvas>` elements across UI re-renders and page navigation.
- **Hybrid Standalone & Enterprise Dual-Transport**:
  - **Prototype / Field Mode:** High-speed direct HTTP push (`aiohttp` → `POST /api/ai-event`) enabling instant zero-dependency execution without requiring Redis or external databases.
  - **Enterprise Production Mode:** Distributed Redis Pub/Sub message broker (`ioredis`) with PostgreSQL 16 persistence and MQTT edge sensor telemetry.
- **Virtual Zero-Line Fence Breach Engine** — Custom polygonal intrusion zones with automated threat classification and instant alarm signaling.
- **Automated Number Plate Recognition (ANPR)** — Instant verification of authorized military logistics and combat vehicles against the military motor pool registry.
- **Active-Duty Troop Roster Cross-Referencing** — Facial telemetry and service ID matching against active BSF/Army field deployment rosters.
- **Tactical Incident Manager** — Severity triage (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), GPS grid references, operator acknowledgment workflow, and sensor health telemetry.

---

## System Architecture

V.I.E.W features a decoupled three-tier architecture optimized for sub-millisecond edge response times:

```
┌────────────────────────────────────────────────────────────────────────┐
│               OPERATOR CONSOLE (V2 Command SPA)                       │
│               http://localhost:3000 · Vanilla JS + CSS3 + HTML5        │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │  Dashboard & Metrics  │  │  Live Monitor Wall (#live-grid-host)  │  │
│  │  Telemetry Sparklines │  │  <video> Feeds + Dynamic YOLO Canvas  │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API + WebSocket (Socket.IO)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            NODE.JS MIDDLEWARE SPINE (app/boot.ts)                      │
│            TypeScript · Hono Framework · Port: 3000                    │
│                                                                        │
│  • Public Ingestion: POST /api/ai-event (No Auth, Sub-ms Ingest)       │
│  • Static Stream Server: /videos/* (Local Border Feeds)                │
│  • WebSocket Broadcast: event:human, event:vehicle, alert              │
│  • In-Memory Demo Store & State Sync (5 Preconfigured Tactical Sectors)│
│  • Optional Enterprise Connectors: PostgreSQL 16 · Redis · MQTT        │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP Push (Prototype) OR Redis Pub/Sub
                                    │
┌────────────────────────────────────────────────────────────────────────┐
│            PYTHON AI RUNTIME (app/runtime/main.py)                     │
│            FastAPI · Uvicorn · Port: 8000 · NVIDIA RTX GPU (CUDA 12.1) │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Dynamic Source Registry (sources.json)                          │  │
│  │  Loads N video sources (MP4 / RTSP) with per-camera FPS targets  │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │ Frame Stream                        │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Async Video Runner (services/video_runner.py)                    │  │
│  │  Frame Interleaving: Frame n (Human) · n+1 (Vehicle) · n+2 (Skip)│  │
│  └───────────────────────┬──────────────────────┬───────────────────┘  │
│                          │                      │                      │
│                          ▼                      ▼                      │
│             ┌────────────────────────┐┌───────────────────────┐        │
│             │ HumanDetectionPipeline ││VehicleDetectionPipeline│        │
│             │ YOLOv8n (Class 0)      ││YOLOv8n (Classes 2,3,5)│        │
│             └────────────┬───────────┘└──────────┬────────────┘        │
│                          │                       │                     │
│                          └───────────┬───────────┘                     │
│                                      ▼                                 │
│                     ┌────────────────────────────────┐                 │
│                     │ HTTP Publisher (aiohttp)       │                 │
│                     │ Fire-and-forget push to Node   │                 │
│                     └────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Alternate-Frame Demultiplexing Architecture

To achieve sustained 30+ FPS inference across multiple concurrent border camera streams on consumer and laptop GPUs (e.g. NVIDIA RTX 4050 6GB VRAM), V.I.E.W implements an **alternate-frame pipeline scheduler**:

| Frame Index | Dispatched Pipeline | Target Classes | Target Action |
|:---:|:---|:---|:---|
| **$n \pmod 3 == 0$** | `HumanDetectionPipeline` | COCO Class 0 (`person`) | Extracts bounding boxes, calculates confidence, flags zero-line breach |
| **$n \pmod 3 == 1$** | `VehicleDetectionPipeline` | COCO Classes 2, 3, 5, 7 (`car`, `motorcycle`, `bus`, `truck`) | Classifies vehicle tactical type (Combat/Transport/Patrol), reads plate |
| **$n \pmod 3 == 2$** | *Pattern / Sensor Sync* | Reserved for behavioral analysis | Skips YOLO forward pass to relieve VRAM thermal load |

---

## Tech Stack

### AI / Machine Learning Runtime (`app/runtime/`)
| Technology | Version | Purpose |
|---|---|---|
| **PyTorch (CUDA 12.1)** | `2.x+cu121` | GPU-accelerated deep learning execution engine |
| **Ultralytics YOLO** | `>=8.2.0` | Real-time object detection (`yolov8n.pt` / `yolov11.pt`) |
| **OpenCV** | `4.10.0.86` | Hardware video decoding, frame resizing, RTSP buffering |
| **FastAPI + Uvicorn** | Latest | Asynchronous Python runtime & health inspection server |
| **aiohttp** | `3.9.5` | Non-blocking async HTTP event publisher to Node.js |

### Node.js Middleware & Core Backend (`app/`)
| Technology | Purpose |
|---|---|
| **TypeScript + Node.js (v20+)** | Type-safe backend with ESM/NodeNext resolution |
| **Hono** | High-performance HTTP routing framework |
| **Socket.IO** | Sub-millisecond WebSocket fanout to operator browsers |
| **PostgreSQL 16** | Relational data store for users, alerts, rosters, and audit logs |
| **ioredis** | High-throughput Pub/Sub message broker (enterprise deployment) |
| **MQTT** | Edge sensor polling and perimeter hardware signal triggers |
| **Zod** | Runtime payload validation and environment safety checks |

### Operator Console (Frontend V2) (`app/frontend/`)
| Technology | Purpose |
|---|---|
| **Modern Vanilla ES6+ SPA** | Zero-framework lightning-fast client (`pages.js`, `components.js`, `ui.js`) |
| **`live-grid.js` Portal Engine** | Fixed-coordinate DOM portaling maintaining live `<video>` streams & YOLO canvas overlays |
| **Tactical Dark UI** | Glassmorphic design with high-contrast tactical accents (`#f2c14e` gold, `#5ecbe0` cyan, `#e5484d` red) |
| **Responsive Grid System** | CSS Grid with `auto-fill` and strict `16:9` aspect-ratio preservation for camera walls |
| **Chart & Sparkline Engine** | Lightweight inline canvas charts (`charts.js`) for 24h telemetry and processing load |

---

## Directory Structure

```
SIH 2026/
├── app/
│   ├── boot.ts                     # Core Node.js entry point & route registration
│   ├── package.json                # Node dependencies & npm scripts
│   ├── models/
│   │   └── yolov8n.pt              # YOLOv8n neural network weights (6.5 MB)
│   ├── videos/                     # Stock border camera MP4 feeds
│   │   ├── 1.mp4                   # Sector 4 — North Border Fence
│   │   ├── 2.mp4                   # Checkpost Alpha — Main Access Gate
│   │   ├── 3.mp4                   # Tower Bravo — Riverine Basin Overlook
│   │   ├── 4.mp4                   # Patrol Corridor Charlie — Ridge Perimeter
│   │   └── 5.mp4                   # Forward Post Alpha — Gate South
│   ├── runtime/                    # Python AI Edge Runtime
│   │   ├── main.py                 # FastAPI lifespan, model warm-up & background runner
│   │   ├── sources.json            # Dynamic camera/video stream configuration
│   │   ├── requirements.txt        # Python dependency manifest
│   │   ├── SETUP.txt               # Step-by-step GPU environment guide
│   │   ├── pipelines/
│   │   │   ├── human_detection.py  # YOLO person detection & alert trigger
│   │   │   └── vehicle_detection.py# YOLO vehicle classification & ANPR simulation
│   │   └── services/
│   │       ├── http_publisher.py   # Async HTTP event dispatcher (No Redis needed)
│   │       └── video_runner.py     # Multi-threaded async video stream scheduler
│   ├── frontend/                   # V2 Tactical Command Interface
│   │   ├── index.html              # Single Page Application root
│   │   ├── css/
│   │   │   └── styles.css          # Full tactical stylesheet & monitor wall rules
│   │   ├── js/
│   │   │   ├── app.js              # SPA router and page lifecycle coordinator
│   │   │   ├── pages.js            # Page views: Overview, Monitor, Alerts, Roster, etc.
│   │   │   ├── live-grid.js        # DOM portal engine for live videos & YOLO bboxes
│   │   │   ├── live-source.js      # Video stream URL resolution & camera registry
│   │   │   ├── store.js            # Reactive frontend state store & Socket.IO bridge
│   │   │   ├── components.js       # Modular UI components (tiles, metrics, badges)
│   │   │   ├── charts.js           # Sparklines and telemetry graph renderers
│   │   │   ├── data.js             # REST client and data adapters
│   │   │   ├── ui.js               # Modal, toast, and dropdown primitives
│   │   │   └── icons.js            # Inline SVG icon catalog
│   │   └── assets/                 # High-resolution tactical terrain & preview assets
│   └── src/                        # Node.js Backend Modules
│       ├── config/                 # Environment variables and configuration
│       ├── routes/
│       │   ├── aiEvent.ts          # POST /api/ai-event ingestion endpoint
│       │   ├── demo.ts             # Demo mode endpoints (/summary, /trigger-breach)
│       │   ├── health.ts           # Health check routes
│       │   └── ...                 # Protected REST routes (cameras, alerts, zones)
│       ├── services/
│       │   └── demoMode.ts         # In-memory demo data store & simulation engine
│       └── websocket/              # Socket.IO connection handling & event routing
```

---

## Dynamic Video Stream Configuration (`sources.json`)

Adding, removing, or modifying video streams requires **zero code modifications**. Simply edit [`app/runtime/sources.json`](file:///c:/Users/humza/OneDrive/Desktop/Study/SIH%202026/app/runtime/sources.json):

```json
{
  "sources": [
    {
      "id": "cam-01",
      "name": "Sector 4 — North Border Fence",
      "location": "Grid Ref 32.74N 74.88E (Forward Post Alpha)",
      "video_path": "../videos/1.mp4",
      "feed_type": "thermal",
      "fps_target": 15,
      "enabled": true
    },
    {
      "id": "cam-02",
      "name": "Checkpost Alpha — Main Access Gate",
      "location": "Grid Ref 32.72N 74.85E (Gate 1)",
      "video_path": "../videos/2.mp4",
      "feed_type": "optical",
      "fps_target": 15,
      "enabled": true
    }
  ]
}
```

- `video_path`: Relative to `sources.json` or an absolute path (supports `.mp4`, `.avi`, or live `rtsp://` streams).
- `fps_target`: Dynamic FPS throttle per camera to prevent GPU overutilization.
- `enabled`: Toggle streams on or off on the fly without deleting definitions.

---

## Setup & Execution Guide

### Prerequisites
- **Operating System:** Windows 10 / 11 (64-bit)
- **Node.js:** v20.0+ & `pnpm` (v10+)
- **Python:** 3.10 or 3.11 (with `venv`)
- **GPU:** NVIDIA GPU with CUDA 12.x support (e.g. RTX 3050/4050 or higher)

---

### Step 1: Set Up Python AI Runtime (GPU)

Open PowerShell in the runtime directory:

```powershell
cd "app/runtime"

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install PyTorch with CUDA 12.1 acceleration (Run this first)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install remaining dependencies
pip install -r requirements.txt
```

Verify GPU availability:
```powershell
python -c "import torch; print('CUDA Available:', torch.cuda.is_available(), '| Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

---

### Step 2: Download YOLO Model Weights

Ensure `yolov8n.pt` is present in `app/models/`:

```powershell
# Auto-download via Ultralytics if not already present
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
copy "$env:USERPROFILE\.ultralytics\assets\yolov8n.pt" "..\models\yolov8n.pt"
```

---

### Step 3: Run the Application

#### Terminal 1 — Node.js Middleware & Operator Console:
```powershell
cd app
pnpm install
pnpm dev
```
> Server will boot at **`http://localhost:3000`**.

#### Terminal 2 — Python AI Edge Runtime:
```powershell
cd app/runtime
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Verification & Health Check Endpoints

- **Operator Dashboard:** `http://localhost:3000`
- **Full Monitor Wall:** `http://localhost:3000/#/monitor`
- **AI Runtime Health:** `http://localhost:8000/health`
- **Active AI Sources:** `http://localhost:8000/sources`
- **Pipeline Latency & Status:** `http://localhost:8000/pipelines/status`
- **Backend Health Check:** `http://localhost:3000/api/health`

---

## API & WebSocket Specification

### AI Event Ingestion (`POST /api/ai-event`)
Published by the Python AI Runtime directly to Node.js:

```json
{
  "pipeline": "human",
  "camera_id": "cam-01",
  "camera_name": "Sector 4 — North Border Fence",
  "frame_index": 1042,
  "frame_width": 1920,
  "frame_height": 1080,
  "detections": [
    {
      "bbox": [420.5, 210.0, 560.2, 580.4],
      "confidence": 0.942,
      "label": "person",
      "tactical_type": "INFILTRATOR"
    }
  ],
  "verified": false,
  "entity_id": "UNKNOWN",
  "message": "Unidentified personnel detected in restricted sector"
}
```

### WebSocket Streaming Events (Socket.IO)

| Event Name | Direction | Payload Description |
|---|---|---|
| `demo:init` | Server → Client | Complete snapshot of initial store state (cameras, roster, alerts) |
| `event:human` | Server → Client | Live person detection with normalized YOLO bounding box coordinates |
| `event:vehicle` | Server → Client | ANPR scan event with tactical vehicle classification and plate match |
| `event:fence` | Server → Client | Virtual zero-line fence perimeter breach notification |
| `alert` | Server → Client | Consolidated incident ticket requiring operator escalation |

---

## Team: RootError

Engineered and developed for the **Smart India Hackathon 2026** by team **RootError**:

| Member | Role / Designation | Contact & Connect | Focus Areas |
|:---|:---|:---|:---|
| **Humza Ahmad** | **Team Leader**<br>Full-Stack & AI Architect | `+91 8240253854`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/humza-ahmad-n0th1ng/) | System Architecture, Deep Learning Pipelines, GPU Optimization, Full-Stack Backend Integration. |
| **Mizan Ur Rahman Mondal** | Embedded Systems & Hardware Specialist | `+91 70036 70838`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mizan-mondal/) | Hardware Prototyping, Embedded Edge Computing, Sensor Signal Processing & Physical Computing. |
| **Farhan Ahmad** | Frontend Architect & Integration Lead | `+91 98691 60286`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/farhan-ahmad-398b6b307/) | Frontend Architecture, UI/UX Engineering, Real-Time DOM Portaling & Canvas Rendering. |
| **Suhana Paul** | AI / CV Engineer & Technical Presentation | `+91 93300 64096`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/suhana-p-3b979a26b/) | Computer Vision Pipelines, Bounding Box Coordinate Transformation & Presentation Strategy. |
| **Madhumita Roy** | UI/UX & Graphic Designer | `+91 83340 36426` | Tactical Visual Identity, Ergonomic Design, Color Systems & UI Asset Creation. |
| **Aaratrika Mitra** | Software Associate & Documentation | `+91 90738 04049`<br>[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/aaratrika-m-2bb913330/) | Software Testing, Quality Assurance, Technical Documentation & System Specifications. |

---

## License & Operational Notice

Developed exclusively for the **Smart India Hackathon 2026 (Problem Statement 26187)**.  
Unauthorized reproduction, deployment in operational live-border environments without secondary human verification systems, or distribution outside of official competition evaluation is strictly restricted.
