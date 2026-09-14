# V.I.E.W — "Recordly" Style UI/UX Animation Specification
### Ultra-Smooth 3D Motion Choreography on Real System Visuals

This specification guides motion designers, video editors, and frontend engineers on how to execute the high-end **"Recordly" / Screen Studio** zoom-in effects across the real V.I.E.W frontend user interface.

---

## 1. Design Aesthetics & Visual Tokens
The V.I.E.W frontend follows a strict **"Pure Analog Wireframe"** design philosophy as documented in `README.md` and `frontend/V1/css/style.css`:
- **Canvas Dark Base:** `#0a0b0e` (Tactical obsidian)
- **Panel Surface:** `#101319` with fine wireframe borders `#222938`
- **Tactical Caution Yellow / Gold:** `#eab308` / `#facc15` (Primary accents & YOLO bounding boxes)
- **Critical Alert Crimson:** `#ef4444` / `#f87171` (Incursion breaches & warning pills)
- **Typography:** `Inter` / `Archivo` for headlines, `JetBrains Mono` for telemetry, coordinates, and latency.
- **Zero Border-Radius:** Hard 90-degree corners representing rugged military computing hardware.

---

## 2. Dynamic Camera Keyframe Choreography

Below is the exact timeline of camera positions, zooms, rotations, and cursor movements to replicate in Screen Studio, After Effects, or Remotion.

```
00:00        00:06        00:12        00:18        00:24
 [Wide 1.0x] ──► [Zoom 2.2x] ──► [Pan 2.8x] ──► [Zoom 3.2x] ──► [Pullback 1.2x]
 Full Console    Alert Banner    Center Canvas   Roster Drawer   Final Matrix
```

---

### Sequence 1: Ingestion & 3D Isometric Glance (00:00 – 00:06)
- **Target UI Elements:** Full viewport (`.app` container).
- **Camera Perspective:**
  - `transform: perspective(1200px) rotateX(12deg) rotateY(-8deg) scale(0.95);`
  - Subtle depth of field blur along the left and top edges (`blur(3px)`).
- **Motion:**
  - Camera glides from an initial 15° slant into a flat 2D plane as the UI powers up.
  - Transition curve: `cubic-bezier(0.16, 1, 0.3, 1)` (Apple/Recordly signature spring ease).
- **Action on Screen:**
  - The boot screen (`#boot-screen`) finishes uplink sequence: `ESTABLISHING SECURE UPLINK… → LINK ONLINE`.
  - The live connection pill (`#ws-pill`) flashes green.

---

### Sequence 2: The Bold Threat Banner Zoom (00:06 – 00:11)
- **Target UI Elements:** `.topbar` and `#threat-pill` / `#btn-breach` / `#modal-alert`.
- **Camera Movement:**
  - Smooth dynamic zoom from `1.0x` to `2.2x` centered on the Topbar and Threat Posture box (`.threat-box`).
  - Easing: `cubic-bezier(0.25, 0.1, 0.25, 1.0)`.
- **Action on Screen:**
  - The threat posture pill flips with a dramatic animation from `NORMAL` (amber) to `CRITICAL` (pulsing crimson).
  - A bold, high-contrast modal or alert bar takes over:
    ```html
    <div class="alert-banner-bold">
      <span class="pulse-icon">▲</span>
      <strong>CRITICAL INTRUSION DETECTED // ZERO-LINE BREACH: SECTOR 4</strong>
      <span class="sub">AI CONFIDENCE: 98.6% · SENSOR ID: CAM-04</span>
    </div>
    ```

---

### Sequence 3: Center Feed Deep Dive & YOLO Inference (00:11 – 00:16)
- **Target UI Elements:** `.feed-panel` and `#hud-canvas`.
- **Camera Movement:**
  - Camera pans downward into the central surveillance stage (`.feed-stage`).
  - Zoom level increases to `2.8x`, filling 80% of the video frame with the live camera snapshot.
- **Action on Screen:**
  - On the canvas, the red polygon line representing the **Virtual Zero-Line Fence** flashes on breach.
  - The tactical yellow/red bounding box snaps onto the infiltrator's coordinates:
    ```
    [ X: 480, Y: 320, W: 110, H: 220 ]
    [ TARGET: UNVERIFIED_HUMAN ]
    [ CONFIDENCE: 98.6% ]
    ```
  - Telemetry readouts in the top-right corner of the feed update rapidly:
    `FEED: 30.0 FPS · LATENCY: 24ms · MODEL: YOLOv11n-seg`.

---

### Sequence 4: Automated Verification & Response (00:16 – 00:22)
- **Target UI Elements:** Right column (`.col-right`) and Alert Action Drawer (`#btn-breach`, `#mcam-primary`, `#st-intr`).
- **Camera Movement:**
  - Fast, fluid lateral pan across to the right sidebar stats and incident feed (`.alerts-panel`).
  - Zoom factor: `2.4x` focused on the **DISPATCH QRT** button and live incident list.
- **Action on Screen:**
  - Simulated smooth cursor glide (Recordly magnetic cursor effect) sweeping onto `#btn-breach` / `DISPATCH QRT`.
  - Cursor clicks: button responds with a glowing ripple effect (`box-shadow: 0 0 20px #eab308`).
  - The counter `#st-intr` (Intrusions Blocked) ticks from `14` to `15` with a smooth odometer number roll.
  - Status strip at the bottom (`.statusbar`) turns green across all native services:
    `POSTGRESQL [OK] · REDIS [OK] · MQTT [OK] · AI RUNTIME [24ms]`.

---

## 3. Ready-to-Use CSS & Remotion Snippets

### Pure CSS Camera Zoom Container
If recording the UI in a browser using OBS or Puppeteer:

```css
/* Container wrapping the V.I.E.W App */
.recordly-stage {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #060709;
  perspective: 1600px;
}

.recordly-viewport {
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

/* State 1: 3D Isometric Introduction */
.recordly-viewport.state-iso {
  transform: rotateX(10deg) rotateY(-6deg) scale(0.92) translateY(20px);
}

/* State 2: Focus on Breach Alert */
.recordly-viewport.state-alert {
  transform: rotateX(0deg) rotateY(0deg) scale(2.2) translate(-15%, -10%);
}

/* State 3: Macro Focus on Center Video Feed */
.recordly-viewport.state-feed {
  transform: rotateX(0deg) rotateY(0deg) scale(2.6) translate(0%, -5%);
}

/* State 4: Focus on Dispatch & Stats */
.recordly-viewport.state-dispatch {
  transform: rotateX(0deg) rotateY(0deg) scale(2.3) translate(28%, -8%);
}
```

### Motion Blur & Edge Glare Overlay
For adding the million-dollar polish in post:
- **Radial Vignette:** Dark vignette at `rgba(0,0,0,0.6)` on outer 15% of frame.
- **Screen Glare:** Subtle diagonal linear-gradient (`linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)`) moving slowly across the UI to simulate physical studio glass.
- **Lens Blur:** `1.5px` Gaussian blur applied dynamically to out-of-focus background panels during high-zoom states.
