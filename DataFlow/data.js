/**
 * V.I.E.W Backend — Architecture Visualization Data
 * 
 * All nodes, connections, groups, and detail content for the
 * interactive system topology flowchart.
 */

const VIEW_DATA = {

  /* ──────────────────────────────────────────────
   *  TABS — top-level views the user can switch
   * ────────────────────────────────────────────── */
  tabs: [
    { id: 'topology',  label: 'System Topology',     icon: '◎' },
    { id: 'dataflow',  label: 'Data Flow Pipeline',  icon: '⟿' },
    { id: 'alert',     label: 'Alert Dispatch',       icon: '⚡' },
    { id: 'boot',      label: 'Boot Sequence',        icon: '▶' },
    { id: 'api',       label: 'REST API Map',         icon: '⬡' },
  ],

  /* ──────────────────────────────────────────────
   *  GROUPS — bounding regions on the canvas
   * ────────────────────────────────────────────── */
  groups: {
    topology: [
      { id: 'grp-client',   label: 'CLIENT (OPERATOR BROWSER)',       x: 40,  y: 60,  w: 250, h: 160, color: '#0ea5e9' },
      { id: 'grp-backend',  label: 'BACKEND SERVER — Hono + Node.js', x: 340, y: 30,  w: 420, h: 540, color: '#00f0ff' },
      { id: 'grp-data',     label: 'DATA LAYER',                      x: 40,  y: 310, w: 250, h: 260, color: '#a78bfa' },
      { id: 'grp-ai',       label: 'AI RUNTIME — Python FastAPI',     x: 820, y: 310, w: 260, h: 260, color: '#f59e0b' },
      { id: 'grp-edge',     label: 'EDGE DEVICES',                    x: 820, y: 60,  w: 260, h: 180, color: '#ef4444' },
    ],
    dataflow: [
      { id: 'grp-source',   label: 'EVENT SOURCE',           x: 40,  y: 60,  w: 220, h: 440, color: '#f59e0b' },
      { id: 'grp-process',  label: 'EVENT PROCESSING',       x: 320, y: 60,  w: 320, h: 440, color: '#00f0ff' },
      { id: 'grp-output',   label: 'EVENT OUTPUT',           x: 700, y: 60,  w: 320, h: 440, color: '#10b981' },
    ],
    alert: [
      { id: 'grp-detect',   label: 'DETECTION',              x: 40,  y: 60,  w: 220, h: 440, color: '#f59e0b' },
      { id: 'grp-route',    label: 'ROUTING & PERSISTENCE',  x: 320, y: 60,  w: 320, h: 440, color: '#00f0ff' },
      { id: 'grp-dispatch', label: 'DISPATCH',               x: 700, y: 60,  w: 320, h: 440, color: '#ef4444' },
    ],
    boot: [],
    api: [
      { id: 'grp-public',    label: 'PUBLIC (No Auth)',       x: 40,  y: 60,  w: 300, h: 520, color: '#10b981' },
      { id: 'grp-protected', label: 'PROTECTED (JWT Auth)',   x: 400, y: 60,  w: 650, h: 520, color: '#ef4444' },
    ],
  },

  /* ──────────────────────────────────────────────
   *  NODES — individual system components
   * ────────────────────────────────────────────── */
  nodes: {

    /* ───── TOPOLOGY TAB ───── */
    topology: [
      // Client
      {
        id: 'frontend',
        label: 'Frontend (Static)',
        subtitle: 'HTML / CSS / JS',
        x: 70, y: 110,
        icon: '🖥',
        status: 'active',
        group: 'grp-client',
        detail: {
          title: 'Operator Browser — Frontend Client',
          tech: ['HTML5', 'CSS3', 'Vanilla JavaScript', 'Socket.IO Client'],
          description: 'Static single-page application served from the <code>/frontend</code> directory. Communicates with the backend exclusively via REST API calls and Socket.IO WebSocket events. Never connects directly to the database, Redis, or MQTT.',
          bullets: [
            'Served as static files by the Hono HTTP server',
            'Calls <code>GET /api/demo/summary</code> on page load for initial data',
            'Listens to Socket.IO events for real-time AI event updates',
            'Displays: Dashboard, Cameras, Alerts, Personnel, Vehicles',
            'No framework — pure vanilla JS with hash-based routing',
          ],
          ports: ['HTTP :3000', 'WebSocket :3000'],
        },
      },

      // Backend core
      {
        id: 'boot',
        label: 'boot.ts',
        subtitle: 'Hono HTTP entrypoint',
        x: 420, y: 80,
        icon: '⚙',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'boot.ts — Application Entrypoint',
          tech: ['Hono', '@hono/node-server', 'TypeScript', 'Zod'],
          description: 'The single entry point for the entire backend. Orchestrates the 5-step boot sequence: PostgreSQL → Redis → Redis Subscriber → MQTT → HTTP + Socket.IO. Each step is non-fatal except the last.',
          bullets: [
            'Validates all environment variables using Zod schemas on startup',
            'Port: <code>3000</code> (configurable via <code>PORT</code> env var)',
            'If <code>DEMO_MODE=true</code>: seeds database + starts simulation ticker',
            'Applies global middleware: requestId, secureHeaders, CORS, logging',
            'Mounts all route handlers under <code>/api/*</code>',
          ],
          ports: ['HTTP :3000'],
          env: ['PORT=3000', 'NODE_ENV=development', 'DEMO_MODE=true'],
        },
      },
      {
        id: 'routes',
        label: 'Route Handlers',
        subtitle: '8 API modules',
        x: 420, y: 190,
        icon: '🔀',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'REST API Route Handlers',
          tech: ['Hono Router', 'Zod Validation', 'JWT (jose)'],
          description: 'Eight route modules mounted on the Hono app. Each handles CRUD operations for its respective domain. All routes except auth, health, and demo require JWT Bearer authentication.',
          bullets: [
            '<code>/api/auth</code> — Login + token refresh (scaffolded)',
            '<code>/api/health</code> — Service health checks (public)',
            '<code>/api/demo</code> — Demo mode data + simulation (public)',
            '<code>/api/cameras</code> — Camera CRUD (auth required)',
            '<code>/api/alerts</code> — Alert read/acknowledge/dismiss (auth required)',
            '<code>/api/events</code> — AI event log, read-only (auth required)',
            '<code>/api/personnel</code> — Personnel registry CRUD (auth required)',
            '<code>/api/vehicles</code> — Vehicle ANPR registry CRUD (auth required)',
            '<code>/api/zones</code> — Virtual fence zone CRUD (auth required)',
          ],
          ports: ['HTTP :3000/api/*'],
        },
      },
      {
        id: 'middleware',
        label: 'Middleware Stack',
        subtitle: 'Auth · CORS · Security',
        x: 420, y: 300,
        icon: '🛡',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'Global Middleware Pipeline',
          tech: ['Hono Middleware', 'jose (JWT)', 'UUID'],
          description: 'Every request passes through this middleware stack before reaching route handlers. Applied automatically to all endpoints.',
          bullets: [
            '<code>requestId()</code> — Adds <code>X-Request-Id</code> UUID header',
            '<code>secureHeaders()</code> — CSP, X-Frame-Options, HSTS, etc.',
            '<code>cors()</code> — Dev: allow all origins (<code>*</code>)',
            '<code>prettyJSON()</code> — JSON formatting with <code>?pretty</code> param',
            '<code>honoLogger()</code> — Logs method, path, status to console',
            '<code>errorHandler</code> — Standard error envelope for all thrown errors',
            '<code>JWT Auth</code> — Verifies Bearer token on protected routes',
          ],
        },
      },
      {
        id: 'socketio',
        label: 'Socket.IO Server',
        subtitle: 'Real-time events',
        x: 570, y: 190,
        icon: '📡',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'Socket.IO Real-Time Event Server',
          tech: ['Socket.IO 4.x', 'WebSocket', 'HTTP Long Polling'],
          description: 'WebSocket server that pushes real-time AI detection events to all connected browser clients. Supports both WebSocket and polling transports. CORS is set to <code>*</code> in development.',
          bullets: [
            '<code>demo:init</code> — Full store snapshot on client connect',
            '<code>event:human</code> — Human detection / troop verification',
            '<code>event:vehicle</code> — ANPR vehicle scan results',
            '<code>event:fence</code> — Virtual fence intrusion (always HIGH)',
            '<code>alert</code> — Consolidated high-priority alert',
            '<code>ping/pong</code> — Keep-alive latency check',
            'Reconnection delay: 2000ms with exponential backoff',
          ],
          ports: ['WebSocket :3000'],
        },
      },
      {
        id: 'redis-sub',
        label: 'Redis Subscriber',
        subtitle: 'redisSubscriber.ts',
        x: 570, y: 370,
        icon: '📥',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'Redis Pub/Sub Subscriber',
          tech: ['ioredis', 'Redis Pub/Sub'],
          description: 'Subscribes to 4 Redis channels published by the Python AI runtime. Parses, validates, and routes incoming AI events to the appropriate handler. Each handler inserts into the database and optionally triggers alert dispatch.',
          bullets: [
            '<code>ai:human</code> → <code>handleHumanEvent()</code> → <code>io.emit("event:human")</code>',
            '<code>ai:vehicle</code> → <code>handleVehicleEvent()</code> → <code>io.emit("event:vehicle")</code>',
            '<code>ai:fence</code> → <code>handleFenceEvent()</code> → <code>io.emit("event:fence")</code>',
            '<code>ai:alert</code> → routes to <code>io.emit("alert")</code>',
            'Validates minimum payload: camera_id, frame_index, timestamp_utc, confidence',
            'Discards malformed messages with warning log',
          ],
        },
      },
      {
        id: 'demo-engine',
        label: 'Demo Simulation',
        subtitle: 'Every 3.5s ticker',
        x: 420, y: 460,
        icon: '🎬',
        status: 'active',
        group: 'grp-backend',
        detail: {
          title: 'Demo Mode Simulation Engine',
          tech: ['Node.js setInterval', 'In-memory Store'],
          description: 'When <code>DEMO_MODE=true</code>, the backend seeds military mock data and starts a simulation ticker that fires every 3.5 seconds, generating random AI events.',
          bullets: [
            '<strong>55%</strong> chance → Troop verification (<code>event:human</code>)',
            '<strong>30%</strong> chance → Vehicle ANPR scan (<code>event:vehicle</code>)',
            '<strong>15%</strong> chance → Fence intrusion (<code>event:fence</code> + <code>alert</code>)',
            'Seeds: 4 cameras, 4 zones, 5 personnel, 5 vehicles, 3 alerts',
            'Max alert history: 20 (oldest auto-removed)',
            '<code>bootstrapDemoDatabase()</code> — Creates tables + inserts seed data',
            '<code>startDemoSimulation()</code> — Starts the 3.5s interval ticker',
          ],
        },
      },

      // Data layer
      {
        id: 'postgres',
        label: 'PostgreSQL',
        subtitle: 'Port 5432',
        x: 70, y: 360,
        icon: '🐘',
        status: 'active',
        group: 'grp-data',
        detail: {
          title: 'PostgreSQL — Primary Database',
          tech: ['PostgreSQL 15+', 'pg (node-postgres)', 'uuid-ossp'],
          description: 'The primary relational data store. Holds 7 tables: cameras, zones, personnel, vehicles, ai_events, alerts, and users. All primary keys are UUID v4.',
          bullets: [
            'Database: <code>border-surveilance</code> (intentional spelling)',
            'Default credentials: <code>postgres:postgres</code>',
            'Tables: cameras, zones, personnel, vehicles, ai_events, alerts, users',
            'Key relationships: cameras → zones (1:N), cameras → ai_events (1:N)',
            'ai_events (1:1) → alerts (alert.id = event.id)',
            'All timestamps: <code>TIMESTAMPTZ DEFAULT NOW()</code>',
            'Soft deletes on personnel (inactive) and vehicles (decommissioned)',
          ],
          ports: ['TCP :5432'],
          env: ['DB_HOST=localhost', 'DB_PORT=5432', 'DB_NAME=border-surveilance'],
        },
      },
      {
        id: 'redis',
        label: 'Redis',
        subtitle: 'Port 6379',
        x: 70, y: 470,
        icon: '⚡',
        status: 'active',
        group: 'grp-data',
        detail: {
          title: 'Redis — Cache & Pub/Sub Broker',
          tech: ['Redis 7+', 'ioredis'],
          description: 'Serves dual purpose: (1) caching layer for frequently accessed data, and (2) Pub/Sub message broker between the Python AI runtime and the Node.js backend.',
          bullets: [
            'Pub/Sub channels: <code>ai:human</code>, <code>ai:vehicle</code>, <code>ai:fence</code>, <code>ai:alert</code>',
            'Config channel: <code>config:zones</code> (Node → Python, zone updates)',
            'Python AI publishes detection events → Node subscribes and broadcasts',
            'If Redis is offline: boot continues, Pub/Sub disabled, demo simulation still works',
            'Auth: optional <code>REDIS_PASSWORD</code>',
          ],
          ports: ['TCP :6379'],
          env: ['REDIS_HOST=localhost', 'REDIS_PORT=6379'],
        },
      },

      // AI Runtime
      {
        id: 'ai-runtime',
        label: 'Python AI Runtime',
        subtitle: 'FastAPI :8000',
        x: 850, y: 360,
        icon: '🧠',
        status: 'active',
        group: 'grp-ai',
        detail: {
          title: 'Python FastAPI AI Runtime',
          tech: ['Python 3.11+', 'FastAPI', 'YOLOv8', 'FaceNet', 'EasyOCR', 'Shapely'],
          description: 'The AI inference engine. Processes camera frames through 3 parallel pipelines and publishes detection events to Redis channels for the Node.js backend to consume.',
          bullets: [
            '<strong>HUMAN Pipeline</strong>: YOLOv8 person detection → FaceNet face recognition → Cross-reference with personnel registry',
            '<strong>VEHICLE Pipeline</strong>: ANPR plate detection → EasyOCR → Cross-reference with vehicle registry',
            '<strong>VIRTUAL_FENCE Pipeline</strong>: Shapely polygon point-in-polygon check → Zone breach detection',
            'Publishes to Redis: <code>ai:human</code>, <code>ai:vehicle</code>, <code>ai:fence</code>, <code>ai:alert</code>',
            'Subscribes to: <code>config:zones</code> for live zone configuration updates',
            'Confidence scores: 0.0 – 1.0 for all detections',
          ],
          ports: ['HTTP :8000'],
          env: ['AI_SERVICE_URL=http://localhost:8000'],
        },
      },
      {
        id: 'ai-human',
        label: 'HUMAN Pipeline',
        subtitle: 'YOLOv8 + FaceNet',
        x: 850, y: 470,
        icon: '👤',
        status: 'active',
        group: 'grp-ai',
        detail: {
          title: 'Human Detection & Verification Pipeline',
          tech: ['YOLOv8', 'FaceNet', 'OpenCV'],
          description: 'Detects persons in camera frames using YOLOv8, then runs face recognition against the personnel registry using FaceNet embeddings.',
          bullets: [
            'Step 1: YOLOv8 person bounding box detection',
            'Step 2: Face crop + alignment using OpenCV',
            'Step 3: FaceNet 128-d embedding generation',
            'Step 4: Cosine similarity match against personnel face_embedding_path',
            'Verified → <code>alert_level: "INFO"</code> + green confirmation',
            'Unverified → <code>alert_level: "HIGH"</code> + red alert',
            'Publishes result to Redis channel <code>ai:human</code>',
          ],
        },
      },

      // Edge
      {
        id: 'mqtt',
        label: 'MQTT Broker',
        subtitle: 'Port 1883',
        x: 850, y: 110,
        icon: '📟',
        status: 'active',
        group: 'grp-edge',
        detail: {
          title: 'MQTT Broker — Edge Device Control',
          tech: ['Mosquitto / EMQX', 'mqtt.js'],
          description: 'MQTT broker for outbound physical-world alerts. The backend publishes to MQTT when a HIGH severity alert is dispatched, signaling edge hardware (sirens, lights, barriers).',
          bullets: [
            'Topic pattern: <code>alerts/&lt;camera_id&gt;</code>',
            'Only HIGH severity alerts trigger MQTT publish',
            'Edge devices subscribe and activate physical responses',
            'If broker offline: boot continues, edge alerts disabled',
            'Payload includes: alertId, level, module, message, zoneId, timestamp',
          ],
          ports: ['TCP :1883'],
          env: ['MQTT_BROKER_URL=mqtt://localhost:1883'],
        },
      },
      {
        id: 'edge-devices',
        label: 'Edge Hardware',
        subtitle: 'Sirens · Lights · Barriers',
        x: 850, y: 190,
        icon: '🚨',
        status: 'warning',
        group: 'grp-edge',
        detail: {
          title: 'Physical Edge Devices',
          tech: ['MQTT Subscribers', 'IoT Controllers'],
          description: 'Physical security devices deployed along the border. Subscribe to MQTT topics and activate when HIGH severity alerts are dispatched.',
          bullets: [
            'Perimeter flood lights — activate on fence intrusion',
            'Audio sirens — sound on HIGH alerts',
            'Vehicle barriers — can be raised/lowered at checkpoints',
            'Status beacons — visual indicators at guard posts',
            'All devices subscribe to <code>alerts/&lt;camera_id&gt;</code> topics',
          ],
        },
      },
    ],

    /* ───── DATA FLOW TAB ───── */
    dataflow: [
      {
        id: 'df-camera', label: 'Camera Feeds', subtitle: 'RTSP Streams',
        x: 70, y: 110, icon: '📹', status: 'active', group: 'grp-source',
        detail: {
          title: 'Camera RTSP Feeds', tech: ['RTSP', 'H.264/H.265'],
          description: '4 edge cameras streaming video to the AI runtime for real-time analysis.',
          bullets: [
            'Sector 4 — Thermal/Optical Dual (1080p, 30fps)',
            'Sector 7 — 4K Optical (2560x1440, 25fps)',
            'Checkpoint Alpha — IR Night Vision (1080p, 30fps)',
            'Sector 12 — Thermal (1080p, 25fps)',
            'Feed types: <code>optical</code>, <code>thermal</code>, <code>ir</code>',
          ],
        },
      },
      {
        id: 'df-ai', label: 'AI Inference', subtitle: '3 Parallel Pipelines',
        x: 70, y: 280, icon: '🧠', status: 'active', group: 'grp-source',
        detail: {
          title: 'AI Detection Pipelines', tech: ['YOLOv8', 'FaceNet', 'EasyOCR', 'Shapely'],
          description: 'Three parallel inference pipelines process every camera frame.',
          bullets: [
            'HUMAN: Person detection + face recognition (55% of demo events)',
            'VEHICLE: License plate OCR + registry lookup (30% of demo events)',
            'VIRTUAL_FENCE: Point-in-polygon zone breach check (15% of demo events)',
          ],
        },
      },
      {
        id: 'df-ai-out', label: 'AI Event Output', subtitle: 'JSON Payload',
        x: 70, y: 400, icon: '📤', status: 'active', group: 'grp-source',
        detail: {
          title: 'AI Event Payload', tech: ['JSON', 'Redis Pub/Sub'],
          description: 'Each pipeline produces a standardized JSON payload with required fields: camera_id, frame_index, timestamp_utc, confidence (0.0-1.0).',
          bullets: [
            'Published to Redis channels: ai:human, ai:vehicle, ai:fence',
            'HIGH severity events also published to ai:alert channel',
          ],
        },
      },
      {
        id: 'df-redis', label: 'Redis Pub/Sub', subtitle: 'Message Broker',
        x: 380, y: 110, icon: '⚡', status: 'active', group: 'grp-process',
        detail: {
          title: 'Redis Pub/Sub Channels', tech: ['Redis', 'ioredis'],
          description: 'Four inbound channels carry AI events from Python to Node.js. One outbound channel carries zone config updates from Node.js to Python.',
          bullets: [
            '<code>ai:human</code> → Human detection events',
            '<code>ai:vehicle</code> → Vehicle ANPR scan events',
            '<code>ai:fence</code> → Virtual fence intrusion events',
            '<code>ai:alert</code> → High-priority consolidated alerts',
            '<code>config:zones</code> → Zone configuration updates (Node → Python)',
          ],
        },
      },
      {
        id: 'df-handler', label: 'Event Handlers', subtitle: 'redisSubscriber.ts',
        x: 380, y: 280, icon: '🔀', status: 'active', group: 'grp-process',
        detail: {
          title: 'Event Routing & Processing', tech: ['TypeScript', 'PostgreSQL'],
          description: 'The Redis subscriber parses incoming events, validates them, inserts into the ai_events database table, and conditionally triggers alert dispatch.',
          bullets: [
            '<code>handleHumanEvent()</code> — INSERT ai_events + conditional dispatchAlert()',
            '<code>handleVehicleEvent()</code> — INSERT ai_events + conditional dispatchAlert()',
            '<code>handleFenceEvent()</code> — INSERT ai_events + ALWAYS dispatchAlert()',
            'Validation: rejects payloads missing camera_id, frame_index, timestamp_utc, or confidence',
          ],
        },
      },
      {
        id: 'df-db', label: 'Database Write', subtitle: 'ai_events + alerts',
        x: 380, y: 400, icon: '💾', status: 'active', group: 'grp-process',
        detail: {
          title: 'Database Persistence', tech: ['PostgreSQL', 'node-postgres'],
          description: 'Every validated AI event is persisted to the ai_events table. If alert dispatch triggers, a corresponding row is inserted into the alerts table with the same UUID.',
          bullets: [
            'ai_events table: stores raw_payload JSONB + all parsed fields',
            'alerts table: alert.id = ai_event.id (1:1 relationship)',
            'Both tables use TIMESTAMPTZ DEFAULT NOW()',
          ],
        },
      },
      {
        id: 'df-socketio', label: 'Socket.IO Emit', subtitle: 'Real-time broadcast',
        x: 750, y: 110, icon: '📡', status: 'active', group: 'grp-output',
        detail: {
          title: 'WebSocket Event Broadcast', tech: ['Socket.IO'],
          description: 'After processing, events are emitted to all connected browser clients via Socket.IO WebSocket connections.',
          bullets: [
            '<code>io.emit("event:human", payload)</code>',
            '<code>io.emit("event:vehicle", payload)</code>',
            '<code>io.emit("event:fence", payload)</code>',
            '<code>io.emit("alert", payload)</code>',
          ],
        },
      },
      {
        id: 'df-browser', label: 'Browser Update', subtitle: 'Dashboard refresh',
        x: 750, y: 280, icon: '🖥', status: 'active', group: 'grp-output',
        detail: {
          title: 'Frontend Real-Time Update', tech: ['Socket.IO Client', 'DOM API'],
          description: 'The browser receives Socket.IO events and updates the UI in real-time: event feed, alert list, stat counters, camera overlays.',
          bullets: [
            'event:human → Update patrol roster, flash alert if unverified',
            'event:vehicle → Update ANPR overlay, show flagged status',
            'event:fence → Critical alert, highlight camera feed, audio tone',
            'alert → Prepend to alert list, increment badge count',
          ],
        },
      },
      {
        id: 'df-mqtt', label: 'MQTT Dispatch', subtitle: 'Edge hardware',
        x: 750, y: 400, icon: '🚨', status: 'active', group: 'grp-output',
        detail: {
          title: 'MQTT Edge Alert', tech: ['MQTT', 'mqtt.js'],
          description: 'HIGH severity alerts trigger MQTT publish to edge devices (sirens, lights, barriers).',
          bullets: [
            'Topic: <code>alerts/&lt;camera_id&gt;</code>',
            'Only HIGH severity triggers MQTT',
            'MEDIUM severity: FCM push notification only (stub)',
          ],
        },
      },
    ],

    /* ───── ALERT DISPATCH TAB ───── */
    alert: [
      {
        id: 'al-python', label: 'Python AI Runtime', subtitle: 'Detection event',
        x: 70, y: 110, icon: '🧠', status: 'active', group: 'grp-detect',
        detail: {
          title: 'AI Detection Source', tech: ['Python', 'FastAPI'],
          description: 'The Python AI runtime detects a threat and publishes a JSON event to the appropriate Redis channel.',
          bullets: ['Publishes to: ai:human, ai:vehicle, ai:fence, ai:alert'],
        },
      },
      {
        id: 'al-redis', label: 'Redis Channel', subtitle: 'Pub/Sub message',
        x: 70, y: 280, icon: '⚡', status: 'active', group: 'grp-detect',
        detail: {
          title: 'Redis Pub/Sub Transport', tech: ['Redis'],
          description: 'Carries the detection event from Python to the Node.js backend.',
          bullets: ['Channels: ai:human, ai:vehicle, ai:fence, ai:alert'],
        },
      },
      {
        id: 'al-validate', label: 'handleRawMessage()', subtitle: 'Parse + validate',
        x: 380, y: 110, icon: '✅', status: 'active', group: 'grp-route',
        detail: {
          title: 'Message Validation', tech: ['TypeScript', 'JSON'],
          description: 'Parses the raw Redis message as JSON and validates the minimum required fields.',
          bullets: [
            'Required: camera_id, frame_index, timestamp_utc, confidence',
            'Malformed messages → logged warning + discarded',
          ],
        },
      },
      {
        id: 'al-route', label: 'routeEvent()', subtitle: 'Route by channel',
        x: 380, y: 230, icon: '🔀', status: 'active', group: 'grp-route',
        detail: {
          title: 'Event Router', tech: ['TypeScript'],
          description: 'Routes the validated event to the appropriate handler based on the Redis channel name.',
          bullets: [
            'ai:human → handleHumanEvent()',
            'ai:vehicle → handleVehicleEvent()',
            'ai:fence → handleFenceEvent() → ALWAYS dispatches alert',
          ],
        },
      },
      {
        id: 'al-insert', label: 'INSERT ai_events', subtitle: 'Database write',
        x: 380, y: 340, icon: '💾', status: 'active', group: 'grp-route',
        detail: {
          title: 'Event Persistence', tech: ['PostgreSQL'],
          description: 'Inserts the AI event into the ai_events table with all parsed fields plus the raw JSON payload.',
          bullets: ['UUID primary key', 'raw_payload stored as JSONB'],
        },
      },
      {
        id: 'al-dispatch', label: 'dispatchAlert()', subtitle: 'Alert creation',
        x: 380, y: 440, icon: '🔔', status: 'active', group: 'grp-route',
        detail: {
          title: 'Alert Dispatch Function', tech: ['TypeScript'],
          description: 'Creates an alert record in the alerts table. Conditionally triggers MQTT and FCM based on severity level.',
          bullets: [
            'ALWAYS: writeAlertToDB() — INSERT into alerts (id = event.id)',
            'HIGH: sendMQTTEdgeSignal() + sendFCMPush()',
            'MEDIUM: sendFCMPush() only',
            'LOW/INFO: database only',
          ],
        },
      },
      {
        id: 'al-socket', label: 'io.emit("alert")', subtitle: 'WebSocket broadcast',
        x: 750, y: 110, icon: '📡', status: 'active', group: 'grp-dispatch',
        detail: {
          title: 'WebSocket Alert Broadcast', tech: ['Socket.IO'],
          description: 'Emits the alert to all connected browser clients for real-time dashboard updates.',
          bullets: ['All connected clients receive the alert immediately'],
        },
      },
      {
        id: 'al-mqtt', label: 'MQTT Publish', subtitle: 'alerts/<camera_id>',
        x: 750, y: 250, icon: '📟', status: 'active', group: 'grp-dispatch',
        detail: {
          title: 'MQTT Edge Signal', tech: ['MQTT', 'mqtt.js'],
          description: 'Publishes to MQTT topic <code>alerts/&lt;camera_id&gt;</code> for physical edge device activation. Only triggered for HIGH severity.',
          bullets: ['Sirens, flood lights, vehicle barriers'],
        },
      },
      {
        id: 'al-fcm', label: 'FCM Push', subtitle: 'Mobile notification',
        x: 750, y: 370, icon: '📱', status: 'warning',  group: 'grp-dispatch',
        detail: {
          title: 'Firebase Cloud Messaging (Stub)', tech: ['FCM'],
          description: 'Push notification to operator mobile devices. Currently a stub — not yet implemented.',
          bullets: ['Placeholder for future mobile app integration', 'Triggered for HIGH and MEDIUM alerts'],
        },
      },
      {
        id: 'al-browser', label: 'Browser Dashboard', subtitle: 'Alert feed update',
        x: 750, y: 440, icon: '🖥', status: 'active', group: 'grp-dispatch',
        detail: {
          title: 'Dashboard Alert Display', tech: ['JavaScript', 'DOM API'],
          description: 'The browser receives the alert via Socket.IO and updates the UI: prepend to alert list, increment badge counter, play audio tone for HIGH alerts.',
          bullets: ['Operators can Acknowledge or Dismiss alerts via REST API calls'],
        },
      },
    ],

    /* ───── BOOT SEQUENCE TAB ───── */
    boot: [
      {
        id: 'bt-start', label: 'pnpm run dev', subtitle: 'Entry point',
        x: 460, y: 60, icon: '▶', status: 'active',
        detail: {
          title: 'Application Startup', tech: ['pnpm', 'tsx'],
          description: 'The developer runs <code>pnpm run dev</code> which executes <code>boot.ts</code> via tsx. The 5-step initialization sequence begins.',
          bullets: ['All env vars validated via Zod on startup', 'Invalid values → immediate crash with descriptive error'],
        },
      },
      {
        id: 'bt-pg', label: '1/5 PostgreSQL', subtitle: 'Connect to DB',
        x: 460, y: 160, icon: '🐘', status: 'active',
        detail: {
          title: 'Step 1: PostgreSQL Connection', tech: ['pg', 'PostgreSQL'],
          description: 'Attempts to connect to PostgreSQL. On failure: warns and continues — database features will be offline but the server will still boot.',
          bullets: ['Non-fatal: server continues on failure', 'DB: border-surveilance on localhost:5432'],
        },
      },
      {
        id: 'bt-redis', label: '2/5 Redis Cache', subtitle: 'Connect cache',
        x: 460, y: 260, icon: '⚡', status: 'active',
        detail: {
          title: 'Step 2: Redis Cache Client', tech: ['ioredis'],
          description: 'Connects the Redis cache client. On failure: warns and continues — Pub/Sub will be disabled.',
          bullets: ['Non-fatal: server continues on failure', 'If this fails, Step 3 (Subscriber) is skipped entirely'],
        },
      },
      {
        id: 'bt-sub', label: '3/5 Redis Subscriber', subtitle: 'Subscribe channels',
        x: 460, y: 360, icon: '📥', status: 'active',
        detail: {
          title: 'Step 3: Redis Pub/Sub Subscriber', tech: ['ioredis'],
          description: 'Creates a dedicated Redis connection for Pub/Sub and subscribes to the 4 AI event channels. Skipped entirely if Step 2 failed.',
          bullets: ['Subscribes to: ai:human, ai:vehicle, ai:fence, ai:alert', 'Skipped if Redis cache connection failed'],
        },
      },
      {
        id: 'bt-mqtt', label: '4/5 MQTT Broker', subtitle: 'Connect broker',
        x: 460, y: 460, icon: '📟', status: 'active',
        detail: {
          title: 'Step 4: MQTT Broker Connection', tech: ['mqtt.js'],
          description: 'Connects to the MQTT broker for edge device alert dispatch. On failure: warns and continues — edge alerts will be disabled.',
          bullets: ['Non-fatal: server continues on failure', 'Default: mqtt://localhost:1883'],
        },
      },
      {
        id: 'bt-http', label: '5/5 HTTP + Socket.IO', subtitle: 'FATAL if fails',
        x: 460, y: 560, icon: '🌐', status: 'active',
        detail: {
          title: 'Step 5: HTTP Server + Socket.IO (FATAL)', tech: ['Hono', '@hono/node-server', 'Socket.IO'],
          description: 'Starts the HTTP server and Socket.IO WebSocket server on the configured port. This is the ONLY fatal step — if this fails, the entire application crashes.',
          bullets: ['⚠️ FATAL: Cannot serve without HTTP + Socket.IO', 'Default port: 3000', 'Serves static frontend from /frontend'],
        },
      },
      {
        id: 'bt-demo', label: 'Demo Mode Init', subtitle: 'If DEMO_MODE=true',
        x: 460, y: 660, icon: '🎬', status: 'active',
        detail: {
          title: 'Demo Mode Bootstrap', tech: ['TypeScript'],
          description: 'After all services are initialized, if <code>DEMO_MODE=true</code>: seeds the database with military mock data and starts the simulation ticker.',
          bullets: [
            'bootstrapDemoDatabase() — CREATE tables IF NOT EXISTS + INSERT seed data',
            'startDemoSimulation() — setInterval(3500ms) emitting random AI events',
            '4 cameras, 4 zones, 5 personnel, 5 vehicles, 3 alerts seeded',
          ],
        },
      },
    ],

    /* ───── REST API MAP TAB ───── */
    api: [
      // Public
      {
        id: 'api-health', label: 'GET /api/health', subtitle: 'Service health',
        x: 70, y: 110, icon: '💚', status: 'active', group: 'grp-public',
        detail: {
          title: 'Health Check Endpoint', tech: ['Hono'],
          description: 'Returns operational status of PostgreSQL, Redis, and MQTT. Frontend calls this on page load.',
          bullets: ['200 OK — all services healthy', '503 — at least one service down', 'Fields: service, timestamp, uptime, services.{postgres,redis,mqtt}'],
        },
      },
      {
        id: 'api-demo', label: 'GET /api/demo/summary', subtitle: 'Full demo snapshot',
        x: 70, y: 290, icon: '📊', status: 'active', group: 'grp-public',
        detail: {
          title: 'Demo Summary Endpoint', tech: ['Hono'],
          description: 'Returns the complete in-memory demo store: stats, cameras, zones, personnel, vehicles, alerts. The first call the frontend makes.',
          bullets: ['Returns: mode, timestamp, stats, cameras[], zones[], personnel[], vehicles[], alerts[]', 'Stats: camerasOnline, personnelOnDuty, vehiclesScannedToday, intrusionsBlocked, activeThreatLevel'],
        },
      },
      {
        id: 'api-demo-ack', label: 'POST /api/demo/alerts/:id/ack', subtitle: 'Acknowledge alert',
        x: 70, y: 380, icon: '✅', status: 'active', group: 'grp-public',
        detail: {
          title: 'Demo Alert Acknowledge', tech: ['Hono'],
          description: 'Marks a demo alert as "acknowledged" in the in-memory store.',
          bullets: ['200 OK — success + updated alert object', '404 — Alert not found'],
        },
      },
      {
        id: 'api-demo-breach', label: 'POST /api/demo/trigger-breach', subtitle: 'Simulate intrusion',
        x: 70, y: 470, icon: '🚨', status: 'active', group: 'grp-public',
        detail: {
          title: 'Manual Breach Trigger', tech: ['Hono'],
          description: 'Injects a HIGH severity VIRTUAL_FENCE breach alert into the demo store. Used for presentations. Side effect: increments intrusionsBlocked stat.',
          bullets: ['Creates alert with level:HIGH, module:VIRTUAL_FENCE', 'Emits to all Socket.IO clients via demo:init mechanism'],
        },
      },
      {
        id: 'api-auth', label: 'POST /api/auth/login', subtitle: 'JWT login (stub)',
        x: 70, y: 200, icon: '🔐', status: 'warning', group: 'grp-public',
        detail: {
          title: 'Authentication Endpoint (Stub)', tech: ['jose', 'bcrypt (stub)'],
          description: 'Login endpoint that returns a JWT token. Currently scaffolded but not fully implemented — bcrypt comparison and token issuance are stubs.',
          bullets: ['Returns: { token, role, expiresIn }', 'Roles: admin, operator, viewer', 'JWT signed with HS256 using JWT_SECRET env var'],
        },
      },
      // Protected
      {
        id: 'api-cameras', label: '/api/cameras', subtitle: 'Camera CRUD',
        x: 440, y: 110, icon: '📹', status: 'active', group: 'grp-protected',
        detail: {
          title: 'Cameras REST API', tech: ['Hono', 'pg', 'Zod'],
          description: 'Full CRUD for camera registrations. RTSP URLs must be unique. Hard delete (permanent removal).',
          bullets: ['GET / — Paginated list, filter by status', 'GET /:id — Single camera', 'POST / — Create (201)', 'PUT /:id — Partial update', 'DELETE /:id — Hard delete'],
        },
      },
      {
        id: 'api-alerts', label: '/api/alerts', subtitle: 'Alert management',
        x: 640, y: 110, icon: '🔔', status: 'active', group: 'grp-protected',
        detail: {
          title: 'Alerts REST API', tech: ['Hono', 'pg', 'Zod'],
          description: 'Read-only + acknowledge/dismiss. Alerts are created by the AI pipeline, not the client.',
          bullets: ['GET / — Paginated list, filter by level/status/camera_id', 'GET /:id — Single alert', 'POST /:id/acknowledge — Set status=acknowledged', 'DELETE /:id — Dismiss (admin/operator only)'],
        },
      },
      {
        id: 'api-events', label: '/api/events', subtitle: 'AI event log',
        x: 840, y: 110, icon: '📋', status: 'active', group: 'grp-protected',
        detail: {
          title: 'AI Events REST API', tech: ['Hono', 'pg', 'Zod'],
          description: 'Read-only log of every AI inference event. Filterable by module, camera, level, and time range.',
          bullets: ['GET / — Paginated (default 50/page, max 200)', 'GET /:id — Single event with full raw_payload', 'Filter params: module, camera, level, from, to'],
        },
      },
      {
        id: 'api-personnel', label: '/api/personnel', subtitle: 'Personnel registry',
        x: 440, y: 290, icon: '👤', status: 'active', group: 'grp-protected',
        detail: {
          title: 'Personnel REST API', tech: ['Hono', 'pg', 'Zod'],
          description: 'CRUD for the personnel registry — source of truth for facial recognition. Service numbers must be unique. Soft delete (status → inactive).',
          bullets: ['GET / — Paginated, filter by rank/unit/status', 'POST / — Create (queues face embedding)', 'PUT /:id — Partial update', 'DELETE /:id — Soft delete (inactive)', 'Ranks: JCO, OR, NCO, Officer, Civilian'],
        },
      },
      {
        id: 'api-vehicles', label: '/api/vehicles', subtitle: 'Vehicle ANPR registry',
        x: 640, y: 290, icon: '🚗', status: 'active', group: 'grp-protected',
        detail: {
          title: 'Vehicles REST API', tech: ['Hono', 'pg', 'Zod'],
          description: 'CRUD for the ANPR vehicle registry. Plate numbers are auto-uppercased and must be unique. Soft delete (status → decommissioned).',
          bullets: ['GET / — Paginated, filter by vehicle_type/unit/status', 'POST / — Create (409 on duplicate plate)', 'DELETE /:id — Soft delete (decommissioned)', 'Types: Combat, Transport, Patrol'],
        },
      },
      {
        id: 'api-zones', label: '/api/zones', subtitle: 'Virtual fence zones',
        x: 840, y: 290, icon: '⬡', status: 'active', group: 'grp-protected',
        detail: {
          title: 'Zones REST API', tech: ['Hono', 'pg', 'Zod', 'Redis Pub/Sub'],
          description: 'CRUD for virtual fence polygons. On create/update/delete, publishes updated config to Redis channel <code>config:zones</code> for live AI runtime updates.',
          bullets: [
            'GET / — Paginated, filter by camera_id/type',
            'POST / — Create (polygon min 3 points)',
            'PUT /:id — Update (triggers Redis publish)',
            'DELETE /:id — Hard delete (triggers Redis publish)',
            'Types: RED (instant HIGH), AMBER (dwell-based MEDIUM), GREEN (no alert), CORRIDOR (dwell-based)',
            'AMBER zones require active_from + active_until',
          ],
        },
      },
    ],
  },

  /* ──────────────────────────────────────────────
   *  CONNECTIONS — lines between nodes
   * ────────────────────────────────────────────── */
  connections: {
    topology: [
      { from: 'frontend',    to: 'boot',        label: 'HTTP REST',      protocol: 'http' },
      { from: 'frontend',    to: 'socketio',     label: 'WebSocket',      protocol: 'ws' },
      { from: 'boot',        to: 'routes',       label: 'mount routes',   protocol: 'internal' },
      { from: 'boot',        to: 'middleware',    label: 'apply middleware', protocol: 'internal' },
      { from: 'boot',        to: 'socketio',     label: 'attach socket',  protocol: 'internal' },
      { from: 'routes',      to: 'postgres',     label: 'SQL queries',    protocol: 'http' },
      { from: 'redis-sub',   to: 'redis',        label: 'SUBSCRIBE',      protocol: 'ws' },
      { from: 'redis-sub',   to: 'socketio',     label: 'emit events',    protocol: 'internal' },
      { from: 'redis-sub',   to: 'postgres',     label: 'INSERT',         protocol: 'http' },
      { from: 'ai-runtime',  to: 'redis',        label: 'PUBLISH',        protocol: 'ws' },
      { from: 'ai-human',    to: 'ai-runtime',   label: 'pipeline',       protocol: 'internal' },
      { from: 'routes',      to: 'mqtt',         label: 'HIGH alerts',    protocol: 'http' },
      { from: 'mqtt',        to: 'edge-devices', label: 'MQTT topic',     protocol: 'ws' },
      { from: 'boot',        to: 'demo-engine',  label: 'DEMO_MODE',      protocol: 'internal' },
      { from: 'demo-engine', to: 'socketio',     label: 'emit simulated', protocol: 'internal' },
    ],
    dataflow: [
      { from: 'df-camera',  to: 'df-ai',       label: 'RTSP frames',    protocol: 'http' },
      { from: 'df-ai',      to: 'df-ai-out',   label: 'JSON payload',   protocol: 'internal' },
      { from: 'df-ai-out',  to: 'df-redis',    label: 'PUBLISH',        protocol: 'ws' },
      { from: 'df-redis',   to: 'df-handler',  label: 'SUBSCRIBE',      protocol: 'ws' },
      { from: 'df-handler', to: 'df-db',       label: 'INSERT',         protocol: 'internal' },
      { from: 'df-handler', to: 'df-socketio', label: 'io.emit()',      protocol: 'ws' },
      { from: 'df-socketio', to: 'df-browser', label: 'WebSocket',      protocol: 'ws' },
      { from: 'df-handler', to: 'df-mqtt',     label: 'HIGH only',      protocol: 'http' },
    ],
    alert: [
      { from: 'al-python',   to: 'al-redis',    label: 'PUBLISH JSON',   protocol: 'ws' },
      { from: 'al-redis',    to: 'al-validate', label: 'SUBSCRIBE',      protocol: 'ws' },
      { from: 'al-validate', to: 'al-route',    label: 'validated msg',  protocol: 'internal' },
      { from: 'al-route',    to: 'al-insert',   label: 'handler()',      protocol: 'internal' },
      { from: 'al-insert',   to: 'al-dispatch', label: 'if HIGH/MED',   protocol: 'internal' },
      { from: 'al-dispatch', to: 'al-socket',   label: 'ALWAYS',         protocol: 'ws' },
      { from: 'al-dispatch', to: 'al-mqtt',     label: 'HIGH only',      protocol: 'http' },
      { from: 'al-dispatch', to: 'al-fcm',      label: 'HIGH + MED',     protocol: 'internal' },
      { from: 'al-socket',   to: 'al-browser',  label: 'WebSocket',      protocol: 'ws' },
    ],
    boot: [
      { from: 'bt-start',  to: 'bt-pg',    label: '',               protocol: 'internal' },
      { from: 'bt-pg',     to: 'bt-redis', label: 'warn & continue', protocol: 'internal' },
      { from: 'bt-redis',  to: 'bt-sub',   label: 'skip if failed',  protocol: 'internal' },
      { from: 'bt-sub',    to: 'bt-mqtt',  label: 'warn & continue', protocol: 'internal' },
      { from: 'bt-mqtt',   to: 'bt-http',  label: 'FATAL if fails',  protocol: 'http' },
      { from: 'bt-http',   to: 'bt-demo',  label: 'if DEMO_MODE',    protocol: 'internal' },
    ],
    api: [],
  },

  /* ──────────────────────────────────────────────
   *  LEGEND — protocol color coding
   * ────────────────────────────────────────────── */
  protocols: {
    http:     { color: '#0ea5e9', label: 'HTTP / REST / SQL', dash: false },
    ws:       { color: '#e879f9', label: 'WebSocket / Pub-Sub', dash: false },
    internal: { color: '#f59e0b', label: 'Internal / In-Process', dash: true },
    heartbeat:{ color: '#10b981', label: 'Heartbeat / Health',   dash: true },
  },
};
