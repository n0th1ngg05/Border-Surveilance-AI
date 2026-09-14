/*
 * Application state: a tiny observable store backed by the project database.
 * Collections are loaded over REST, mutations are written back, and every
 * figure on screen is derived from those rows.
 */
(function () {
  const api = window.API;

  let state = {
    cameras: [],
    zones: [],
    alerts: [],
    events: [],
    personnel: [],
    vehicles: [],
    health: [],
    stats: {
      camerasOnline: 0,
      camerasTotal: 0,
      personnelOnDuty: 0,
      vehiclesScannedToday: 0,
      intrusionsBlocked: 0,
      activeThreatLevel: "GUARDED",
      processingLoadPct: 0,
      networkThroughputMbps: 0,
      storageUsedPct: 0,
      uptimeSeconds: 0,
    },
    series: { detections: [], vehicles: [], load: [] },
    layout: "3x2",
    connection: "connecting",
    loading: true,
    error: null,
    notifications: [],
  };

  const listeners = new Set();

  function set(patch) {
    state = Object.assign({}, state, patch);
    listeners.forEach((fn) => fn());
  }

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function nowTime() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
  }

  /* ---------- derivations ---------- */

  function bucketByHour(rows) {
    const buckets = new Array(24).fill(0);
    const now = new Date();
    const end = now.getTime();
    rows.forEach((row) => {
      if (!row.createdAt) return;
      const t = new Date(row.createdAt).getTime();
      const hoursAgo = Math.floor((end - t) / 3600000);
      if (hoursAgo < 0 || hoursAgo > 23) return;
      buckets[23 - hoursAgo] += 1;
    });
    return buckets;
  }

  function bitrateMbps(camera) {
    const parts = String(camera.resolution || "1920x1080").split("x");
    const pixels = (Number(parts[0]) || 1920) * (Number(parts[1]) || 1080);
    return (pixels * (camera.fps || 25) * 0.07) / 1000000;
  }

  function deriveSeries(events, alerts) {
    const detections = bucketByHour(events);
    const vehicles = bucketByHour(
      alerts.filter((a) => a.module === "VEHICLE").concat(events.filter((e) => e.kind === "vehicle")),
    );
    const load = detections.map((n) => Math.min(100, n * 6));
    return { detections: detections, vehicles: vehicles, load: load };
  }

  function deriveStats(next) {
    const cameras = next.cameras;
    const alerts = next.alerts;
    const active = cameras.filter((c) => c.status === "active");
    const recording = cameras.filter((c) => c.recording).length;
    const openCritical = alerts.filter((a) => a.status === "open" && a.level === "CRITICAL").length;
    const openHigh = alerts.filter((a) => a.status === "open" && a.level === "HIGH").length;
    const throughput = active.reduce((total, cam) => total + bitrateMbps(cam), 0);
    const capacity = Math.max(1, cameras.length * 30);
    const usedFps = active.reduce((total, cam) => total + (cam.fps || 0), 0);
    const oldest = next.events.length
      ? new Date(next.events[next.events.length - 1].createdAt).getTime()
      : Date.now();

    return {
      camerasTotal: cameras.length,
      camerasOnline: active.length,
      personnelOnDuty: next.personnel.filter((p) => String(p.status).toLowerCase().indexOf("off") === -1)
        .length,
      vehiclesScannedToday: next.vehicles.length,
      intrusionsBlocked: alerts.filter((a) => a.level === "CRITICAL" || a.level === "HIGH").length,
      activeThreatLevel: openCritical ? "HIGH" : openHigh ? "ELEVATED" : "GUARDED",
      processingLoadPct: Math.min(100, Math.round((usedFps / capacity) * 100)),
      networkThroughputMbps: Math.round(throughput),
      storageUsedPct: cameras.length
        ? Math.min(98, Math.round((recording / cameras.length) * 85))
        : 0,
      uptimeSeconds: Math.max(0, Math.round((Date.now() - oldest) / 1000)),
    };
  }

  function recompute(patch) {
    const next = Object.assign({}, state, patch);
    return Object.assign({}, patch, {
      stats: deriveStats(next),
      series: deriveSeries(next.events, next.alerts),
    });
  }

  /* ---------- loading ---------- */

  let knownAlertIds = null;
  let lastSignature = null;

  async function load(initial) {
    try {
      const data = initial ? await api.loadAll() : await api.loadLive();
      // Only touch state when the stored records actually changed, so the
      // interface never repaints on its own.
      const signature = JSON.stringify([data.cameras, data.alerts, data.events]);
      if (!initial && signature === lastSignature) {
        if (state.connection !== "connected") set({ connection: "connected", error: null });
        return;
      }
      lastSignature = signature;
      const patch = {
        cameras: data.cameras,
        alerts: data.alerts,
        events: data.events,
        connection: "connected",
        loading: false,
        error: null,
      };
      if (initial) {
        patch.zones = data.zones;
        patch.personnel = data.personnel;
        patch.vehicles = data.vehicles;
        patch.health = data.health;
      }
      const fresh = [];
      if (knownAlertIds) {
        data.alerts.forEach((alert) => {
          if (!knownAlertIds.has(alert.id) && alert.status === "open") fresh.push(alert);
        });
      }
      knownAlertIds = new Set(data.alerts.map((a) => a.id));
      if (fresh.length) {
        patch.notifications = fresh
          .map((a) => ({ id: a.id, title: a.level, detail: a.message, level: a.level }))
          .concat(state.notifications)
          .slice(0, 4);
      }
      set(recompute(patch));
    } catch (err) {
      set({ connection: "disconnected", loading: false, error: err.message });
    }
  }

  let timers = [];

  function startLive() {
    if (timers.length) return;
    timers.push(setInterval(() => load(false), 20000));
  }

  function init() {
    load(true).then(startLive);
  }

  /* ---------- actions ---------- */

  const actions = {
    setLayout(layout) {
      set({ layout: layout });
    },

    setConnection(connection) {
      set({ connection: connection });
    },

    addCamera(camera) {
      set(recompute({ cameras: state.cameras.concat([camera]) }));
      api
        .createCamera(camera)
        .then(() =>
          actions.pushEvent({
            kind: "user",
            title: "Camera registered",
            detail: camera.name + " added at " + camera.location,
            source: "Duty Operator",
          }),
        )
        .catch((err) => set({ error: err.message }));
    },

    removeCamera(id) {
      const removed = state.cameras.find((c) => c.id === id);
      set(recompute({ cameras: state.cameras.filter((c) => c.id !== id) }));
      api
        .deleteCamera(id)
        .then(() => {
          if (!removed) return;
          actions.pushEvent({
            kind: "user",
            title: "Camera removed",
            detail: removed.name + " deregistered from the wall",
            source: "Duty Operator",
          });
        })
        .catch((err) => set({ error: err.message }));
    },

    patchCamera(id, patch) {
      set(
        recompute({
          cameras: state.cameras.map((c) => (c.id === id ? Object.assign({}, c, patch) : c)),
        }),
      );
      api.updateCamera(id, patch).catch((err) => set({ error: err.message }));
    },

    toggleRecording(id) {
      const camera = state.cameras.find((c) => c.id === id);
      if (!camera) return;
      actions.patchCamera(id, { recording: !camera.recording });
      actions.pushEvent({
        kind: "camera",
        title: camera.recording ? "Recording stopped" : "Recording started",
        detail: camera.name + " archive segment " + (camera.recording ? "closed" : "opened"),
        source: camera.name,
      });
    },

    toggleMute(id) {
      const camera = state.cameras.find((c) => c.id === id);
      if (!camera) return;
      actions.patchCamera(id, { muted: !camera.muted });
    },

    refreshCamera(id) {
      const camera = state.cameras.find((c) => c.id === id);
      if (!camera) return;
      actions.patchCamera(id, { status: "active", fps: camera.fps || 25 });
      actions.pushEvent({
        kind: "camera",
        title: "Feed refreshed",
        detail: camera.name + " stream re-negotiated",
        source: camera.name,
      });
    },

    acknowledgeAlert(id) {
      set(
        recompute({
          alerts: state.alerts.map((a) =>
            a.id === id ? Object.assign({}, a, { status: "acknowledged" }) : a,
          ),
        }),
      );
      api.setAlertStatus(id, "acknowledged").catch((err) => set({ error: err.message }));
    },

    resolveAlert(id) {
      set(
        recompute({
          alerts: state.alerts.map((a) =>
            a.id === id ? Object.assign({}, a, { status: "resolved" }) : a,
          ),
        }),
      );
      api.setAlertStatus(id, "resolved").catch((err) => set({ error: err.message }));
    },

    pushAlert(alert) {
      if (knownAlertIds) knownAlertIds.add(alert.id);
      set(
        recompute({
          alerts: [alert].concat(state.alerts).slice(0, 120),
          notifications: [
            { id: alert.id, title: alert.level, detail: alert.message, level: alert.level },
          ]
            .concat(state.notifications)
            .slice(0, 4),
        }),
      );
      api.createAlert(alert).catch((err) => set({ error: err.message }));
    },

    removeAlert(id) {
      if (knownAlertIds) knownAlertIds.delete(id);
      set(
        recompute({
          alerts: state.alerts.filter((a) => a.id !== id),
          notifications: state.notifications.filter((n) => n.id !== id),
        }),
      );
      api.deleteAlert(id).catch((err) => set({ error: err.message }));
    },

    dismissNotification(id) {
      set({ notifications: state.notifications.filter((n) => n.id !== id) });
    },

    pushEvent(event) {
      api
        .createEvent(event)
        .then((entry) => set(recompute({ events: [entry].concat(state.events).slice(0, 200) })))
        .catch((err) => set({ error: err.message }));
    },

    triggerBreach() {
      const camera = state.cameras.find((c) => c.status === "active") || state.cameras[0];
      const zone = state.zones.find((z) => camera && z.cameraId === camera.id);
      const alert = {
        id: "breach-" + Date.now().toString(36),
        level: "CRITICAL",
        module: "VIRTUAL_FENCE",
        message: "Manual drill: boundary line crossed, incursion signature confirmed",
        cameraId: camera ? camera.id : null,
        cameraName: camera ? camera.name : "Unassigned",
        zoneName: zone ? zone.name : "Unassigned zone",
        entityId: "TGT-DRILL",
        status: "open",
        createdAt: new Date().toISOString(),
        timestamp: nowTime(),
      };
      actions.pushAlert(alert);
      actions.pushEvent({
        kind: "security",
        title: "Breach drill injected",
        detail: alert.message,
        source: alert.cameraName,
      });
    },

    setStats(patch) {
      set({ stats: Object.assign({}, state.stats, patch) });
    },

    setSeries(series) {
      set({ series: series });
    },

    refreshHealth() {
      return api
        .measureHealth()
        .then((results) => {
          const byId = {};
          results.forEach((r) => {
            byId[r.id] = r;
          });
          set({
            health: state.health.map((service) =>
              byId[service.id]
                ? Object.assign({}, service, {
                    latencyMs: byId[service.id].latencyMs,
                    state: byId[service.id].state,
                  })
                : service,
            ),
          });
          actions.pushEvent({
            kind: "system",
            title: "Health check completed",
            detail: "All service probes re-run from the operator console",
            source: "System",
          });
        })
        .catch((err) => set({ error: err.message }));
    },

    reload() {
      return load(true);
    },
  };

  window.store = { getState, subscribe, actions, nowTime, init: init, startSimulation: init };
})();
