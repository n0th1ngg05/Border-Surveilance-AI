/*
 * live-source.js
 *
 * Bridges the V.I.E.W console to the REAL Node.js backend (boot.ts / Hono /
 * Socket.IO on port 3000) — the actual YOLO pipeline runs there, not Supabase.
 *
 * data.js (window.API) still owns Cameras/Alerts/Zones/etc. CRUD pages, per
 * instruction to leave everything else as-is. This file is additive: it does
 * not touch window.API or window.store, it just gives the live camera grid
 * (js/live-grid.js) somewhere to get camera metadata and detection events.
 *
 * Exposes window.LIVE:
 *   LIVE.getCameras()          -> Promise<Array<{id, name, location, feedType, status}>>
 *   LIVE.onDetection(fn)       -> subscribe to every human/vehicle detection event
 *   LIVE.onAlert(fn)           -> subscribe to alert events
 *   LIVE.onConnectionChange(fn)-> subscribe to socket connect/disconnect
 *   LIVE.videoUrl(cameraId)    -> "/videos/1.mp4" style URL for a camera
 */
(function () {
  // Same-origin — this frontend is served BY boot.ts on :3000, so no CORS needed.
  const NODE_BASE = "";

  // Map of camera IDs that are live RTSP/IP cameras — streamed via MJPEG proxy
  // instead of a local MP4 file. Add new IP cameras here when registering them.
  const RTSP_CAMERAS = {
    "cam-06": "/stream/cam-06",
  };

  // camera_id -> video URL.
  // For RTSP cameras, returns the Node.js MJPEG proxy endpoint.
  // For file-based cameras, maps cam-NN -> /videos/N.mp4.
  function videoUrl(cameraId) {
    if (RTSP_CAMERAS[cameraId]) return RTSP_CAMERAS[cameraId];
    const match = /(\d+)\s*$/.exec(String(cameraId || ""));
    const n = match ? parseInt(match[1], 10) : 1;
    return "/videos/" + n + ".mp4";
  }

  // Returns true for IP cameras that stream MJPEG (not a local MP4).
  // live-grid.js uses this to render <img> instead of <video> for those tiles.
  function isRtspCamera(cameraId) {
    return !!RTSP_CAMERAS[cameraId];
  }

  async function getCameras() {
    const res = await fetch(NODE_BASE + "/api/demo/summary");
    if (!res.ok) throw new Error("summary " + res.status);
    const data = await res.json();
    return (data.cameras || []).map((c) => ({
      id: c.id,
      name: c.name,
      location: c.location,
      feedType: c.feedType || "optical",
      status: c.status || "active",
    }));
  }

  async function getHealth() {
    const res = await fetch(NODE_BASE + "/api/health");
    if (!res.ok) return null;
    return res.json();
  }

  /* ---------- Socket.IO wiring ---------- */

  const detectionListeners = new Set();
  const alertListeners = new Set();
  const connectionListeners = new Set();

  let socket = null;

  function ensureSocket() {
    if (socket) return socket;
    if (typeof io === "undefined") {
      console.warn("[live-source] socket.io client not loaded — detections will not stream");
      return null;
    }
    socket = io(NODE_BASE || undefined, {
      transports: ["websocket", "polling"],
      reconnectionDelay: 1500,
    });

    socket.on("connect", () => connectionListeners.forEach((fn) => fn(true)));
    socket.on("disconnect", () => connectionListeners.forEach((fn) => fn(false)));

    // Both live YOLO events (from aiEvent.ts) and the demo ticker fire these
    // same event names, so this works whether or not the Python runtime is up.
    socket.on("event:human", (payload) => {
      detectionListeners.forEach((fn) => fn(normalizeDetectionPayload(payload, "human")));
    });
    socket.on("event:vehicle", (payload) => {
      detectionListeners.forEach((fn) => fn(normalizeDetectionPayload(payload, "vehicle")));
    });
    socket.on("alert", (payload) => {
      alertListeners.forEach((fn) => fn(payload));
    });

    return socket;
  }

  /**
   * Two payload shapes can arrive on the same event name:
   *  - Real YOLO pipeline (aiEvent.ts / http_publisher.py): has `detections[]`,
   *    `frame_width`, `frame_height`, `camera_id`.
   *  - Demo ticker (demoMode.ts): no `detections[]` / no bbox data, just a
   *    verification message — camera is always cam-01 or cam-02.
   * Normalize both into one shape the grid can consume; demo-ticker events
   * simply carry an empty detections array (grid draws no boxes for them).
   */
  function normalizeDetectionPayload(payload, kind) {
    return {
      kind: kind, // "human" | "vehicle"
      cameraId: payload.camera_id,
      cameraName: payload.camera_name,
      frameIndex: payload.frame_index,
      frameWidth: payload.frame_width || null,
      frameHeight: payload.frame_height || null,
      detections: Array.isArray(payload.detections) ? payload.detections : [],
      verified: !!payload.verified,
      entityId: payload.entity_id || null,
      message: payload.message || "",
      raw: payload,
    };
  }

  function onDetection(fn) {
    ensureSocket();
    detectionListeners.add(fn);
    return () => detectionListeners.delete(fn);
  }

  function onAlert(fn) {
    ensureSocket();
    alertListeners.add(fn);
    return () => alertListeners.delete(fn);
  }

  function onConnectionChange(fn) {
    ensureSocket();
    connectionListeners.add(fn);
    return () => connectionListeners.delete(fn);
  }

  window.LIVE = {
    getCameras: getCameras,
    getHealth: getHealth,
    onDetection: onDetection,
    onAlert: onAlert,
    onConnectionChange: onConnectionChange,
    videoUrl: videoUrl,
    isRtspCamera: isRtspCamera,
  };
})();
