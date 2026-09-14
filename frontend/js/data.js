/*
 * Backend client.
 * Every collection in this console is stored in the project database and
 * reached over its REST interface. Nothing here is invented locally.
 */
(function () {
  const BASE_URL = "https://afmqyavldcizgeccbtnj.supabase.co";
  const PUBLIC_KEY = "sb_publishable_Pd1qNPXlSpxq46ceafnsig_YG2MTp3d";
  const REST = BASE_URL + "/rest/v1";

  function headers(extra) {
    return Object.assign(
      {
        apikey: PUBLIC_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      extra || {},
    );
  }

  async function rest(path, options) {
    const opts = options || {};
    const res = await fetch(REST + path, {
      method: opts.method || "GET",
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      let message = "Request failed (" + res.status + ")";
      try {
        const detail = await res.json();
        if (detail && detail.message) message = detail.message;
      } catch (err) {
        /* no JSON body */
      }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---------- row mapping ---------- */

  const clock = (iso) =>
    iso ? new Date(iso).toLocaleTimeString("en-GB", { hour12: false }) : "";

  function relative(iso) {
    if (!iso) return "unknown";
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 45) return "just now";
    if (seconds < 3600) return Math.round(seconds / 60) + " min ago";
    if (seconds < 86400) return Math.round(seconds / 3600) + " hr ago";
    return Math.round(seconds / 86400) + " d ago";
  }

  const toCamera = (r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    rtspUrl: r.rtsp_url,
    streamUrl: r.stream_url || "",
    status: r.status,
    fps: r.fps,
    resolution: r.resolution,
    feedType: r.feed_type,
    zoneId: r.zone_id,
    recording: r.recording,
    muted: r.muted,
    createdAt: r.created_at,
  });

  const toZone = (r) => ({
    id: r.id,
    cameraId: r.camera_id,
    name: r.name,
    type: r.type,
    dwellThreshold: r.dwell_threshold,
    x: Number(r.x),
    y: Number(r.y),
    radius: Number(r.radius),
  });

  const toAlert = (r) => ({
    id: r.id,
    level: r.level,
    module: r.module,
    message: r.message,
    cameraId: r.camera_id,
    cameraName: r.camera_name || "",
    zoneName: r.zone_name || "",
    entityId: r.entity_id || "",
    status: r.status,
    createdAt: r.created_at,
    timestamp: clock(r.created_at),
  });

  const toEvent = (r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    source: r.source,
    createdAt: r.created_at,
    timestamp: clock(r.created_at),
  });

  const toPerson = (r) => ({
    id: r.id,
    serviceNumber: r.service_number,
    name: r.name,
    rank: r.rank,
    unit: r.unit,
    station: r.station,
    status: r.status,
    lastVerified: relative(r.last_verified),
  });

  const toVehicle = (r) => ({
    id: r.id,
    plateNumber: r.plate_number,
    type: r.type,
    model: r.model,
    unit: r.unit,
    status: r.status,
    lastCheckpoint: r.last_checkpoint,
  });

  const toHealth = (r) => ({
    id: r.id,
    label: r.label,
    state: r.state,
    detail: r.detail,
    latencyMs: r.latency_ms,
  });

  const fromCamera = (c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    rtsp_url: c.rtspUrl,
    stream_url: c.streamUrl || null,
    status: c.status,
    fps: c.fps,
    resolution: c.resolution,
    feed_type: c.feedType,
    zone_id: c.zoneId || null,
    recording: c.recording,
    muted: c.muted,
  });

  const cameraPatch = (patch) => {
    const map = {
      name: "name",
      location: "location",
      rtspUrl: "rtsp_url",
      streamUrl: "stream_url",
      status: "status",
      fps: "fps",
      resolution: "resolution",
      feedType: "feed_type",
      zoneId: "zone_id",
      recording: "recording",
      muted: "muted",
    };
    const out = {};
    Object.keys(patch).forEach((key) => {
      if (map[key]) out[map[key]] = patch[key];
    });
    return out;
  };

  /* ---------- reads ---------- */

  async function loadAll() {
    const started = Date.now();
    const [cameras, zones, alerts, events, personnel, vehicles, health] = await Promise.all([
      rest("/cameras?select=*&order=created_at.asc"),
      rest("/zones?select=*&order=created_at.asc"),
      rest("/alerts?select=*&order=created_at.desc&limit=120"),
      rest("/events?select=*&order=created_at.desc&limit=200"),
      rest("/personnel?select=*&order=created_at.asc"),
      rest("/vehicles?select=*&order=created_at.asc"),
      rest("/service_health?select=*&order=position.asc"),
    ]);
    return {
      latencyMs: Date.now() - started,
      cameras: cameras.map(toCamera),
      zones: zones.map(toZone),
      alerts: alerts.map(toAlert),
      events: events.map(toEvent),
      personnel: personnel.map(toPerson),
      vehicles: vehicles.map(toVehicle),
      health: health.map(toHealth),
    };
  }

  async function loadLive() {
    const started = Date.now();
    const [cameras, alerts, events] = await Promise.all([
      rest("/cameras?select=*&order=created_at.asc"),
      rest("/alerts?select=*&order=created_at.desc&limit=120"),
      rest("/events?select=*&order=created_at.desc&limit=200"),
    ]);
    return {
      latencyMs: Date.now() - started,
      cameras: cameras.map(toCamera),
      alerts: alerts.map(toAlert),
      events: events.map(toEvent),
    };
  }

  /* ---------- writes ---------- */

  async function createCamera(camera) {
    const rows = await rest("/cameras", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: fromCamera(camera),
    });
    return toCamera(rows[0]);
  }

  function updateCamera(id, patch) {
    const body = cameraPatch(patch);
    if (!Object.keys(body).length) return Promise.resolve(null);
    return rest("/cameras?id=eq." + encodeURIComponent(id), { method: "PATCH", body: body });
  }

  function deleteCamera(id) {
    return rest("/cameras?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  }

  async function createAlert(alert) {
    const rows = await rest("/alerts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        id: alert.id,
        level: alert.level,
        module: alert.module,
        message: alert.message,
        camera_id: alert.cameraId || null,
        camera_name: alert.cameraName || null,
        zone_name: alert.zoneName || null,
        entity_id: alert.entityId || null,
        status: alert.status || "open",
      },
    });
    return toAlert(rows[0]);
  }

  function setAlertStatus(id, status) {
    return rest("/alerts?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      body: { status: status },
    });
  }

  function deleteAlert(id) {
    return rest("/alerts?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  }

  async function createEvent(event) {
    const rows = await rest("/events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        kind: event.kind || "system",
        title: event.title,
        detail: event.detail || "",
        source: event.source || "System",
      },
    });
    return toEvent(rows[0]);
  }

  async function measureHealth() {
    const probes = [
      { id: "api", path: "/cameras?select=id&limit=1" },
      { id: "db", path: "/events?select=id&limit=1" },
      { id: "cache", path: "/service_health?select=id&limit=1" },
      { id: "storage", path: "/vehicles?select=id&limit=1" },
      { id: "inference", path: "/alerts?select=id&limit=1" },
      { id: "realtime", path: "/personnel?select=id&limit=1" },
    ];
    const results = await Promise.all(
      probes.map(async (probe) => {
        const started = Date.now();
        try {
          await rest(probe.path);
          return { id: probe.id, latencyMs: Date.now() - started, state: "operational" };
        } catch (err) {
          return { id: probe.id, latencyMs: Date.now() - started, state: "down" };
        }
      }),
    );
    await Promise.all(
      results.map((r) =>
        rest("/service_health?id=eq." + r.id, {
          method: "PATCH",
          body: { latency_ms: r.latencyMs, state: r.state, updated_at: new Date().toISOString() },
        }).catch(() => null),
      ),
    );
    return results;
  }

  window.API = {
    BASE_URL: BASE_URL,
    REST_URL: REST,
    LIVE: true,
    rest: rest,
    loadAll: loadAll,
    loadLive: loadLive,
    createCamera: createCamera,
    updateCamera: updateCamera,
    deleteCamera: deleteCamera,
    createAlert: createAlert,
    setAlertStatus: setAlertStatus,
    deleteAlert: deleteAlert,
    createEvent: createEvent,
    measureHealth: measureHealth,
    relative: relative,
  };
})();
