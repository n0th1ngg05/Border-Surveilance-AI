/* Page modules: each renders a full screen and declares its own handlers. */
(function () {
  const ui = window.ui;
  const esc = ui.esc;
  const c = window.charts;
  const comp = window.components;
  const store = window.store;
  const actions = store.actions;

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const hourLabels = (data) => data.map((_, i) => String(i).padStart(2, "0") + "h");
  const pad2 = (n) => String(n).padStart(2, "0");

  function removeModal(camera, text) {
    return ui.modal({
      title: "Remove camera",
      width: "26rem",
      closeAct: "cancel-remove",
      body:
        '<p class="small muted">' +
        esc(text) +
        '</p><div class="row end" style="margin-top:1.25rem">' +
        ui.button({ label: "Cancel", act: "cancel-remove" }) +
        ui.button({ label: "Remove", act: "confirm-remove", variant: "solid" }) +
        "</div>",
    });
  }

  const EMPTY_CAMERA_FORM = {
    name: "",
    location: "",
    rtspUrl: "",
    resolution: "1920x1080",
    fps: "25",
    feedType: "optical",
    zoneId: "",
    streamUrl: "",
  };

  function cameraFormHandlers(page) {
    return {
      "open-add": (el, ev, ctx) => {
        ctx.local.addOpen = true;
        ctx.local.form = Object.assign({}, EMPTY_CAMERA_FORM);
        ctx.local.formError = null;
        ctx.rerender();
      },
      "close-add": (el, ev, ctx) => {
        ctx.local.addOpen = false;
        ctx.rerender();
      },
      "camera-field": (el, ev, ctx) => {
        ctx.local.form[el.getAttribute("data-k")] = el.value;
        if (el.tagName === "SELECT") ctx.rerender();
      },
      "submit-camera": (el, ev, ctx) => {
        const state = store.getState();
        const form = ctx.local.form;
        if (!form.name.trim() || !form.location.trim() || !form.rtspUrl.trim()) {
          ctx.local.formError = "Name, location and stream URL are required.";
          ctx.rerender();
          return;
        }
        if (state.cameras.some((cam) => cam.rtspUrl === form.rtspUrl.trim())) {
          ctx.local.formError = "That stream URL is already registered (409 Conflict).";
          ctx.rerender();
          return;
        }
        const index = state.cameras.length + 1;
        actions.addCamera({
          id: "cam-" + pad2(index) + "-" + Math.random().toString(36).slice(2, 5),
          name: form.name.trim(),
          location: form.location.trim(),
          rtspUrl: form.rtspUrl.trim(),
          status: "active",
          fps: Number(form.fps) || 25,
          resolution: form.resolution,
          feedType: form.feedType,
          zoneId: form.zoneId || null,
          recording: true,
          muted: true,
          streamUrl: (form.streamUrl || "").trim(),
          createdAt: new Date().toISOString(),
        });
        ctx.local.addOpen = false;
        ctx.local.form = Object.assign({}, EMPTY_CAMERA_FORM);
        ctx.local.formError = null;
        ctx.rerender();
      },
      "ask-remove": (el, ev, ctx) => {
        ctx.local.pendingRemoval = el.getAttribute("data-id");
        ctx.rerender();
      },
      "cancel-remove": (el, ev, ctx) => {
        ctx.local.pendingRemoval = null;
        ctx.rerender();
      },
      "confirm-remove": (el, ev, ctx) => {
        if (ctx.local.pendingRemoval) actions.removeCamera(ctx.local.pendingRemoval);
        ctx.local.pendingRemoval = null;
        ctx.rerender();
      },
      escape: (el, ev, ctx) => {
        if (ctx.local.addOpen || ctx.local.pendingRemoval) {
          ctx.local.addOpen = false;
          ctx.local.pendingRemoval = null;
          ctx.rerender();
        }
      },
    };
  }

  /* ================= Live notification strip ================= */

  function notificationStrip(state) {
    const n = window.activeNotification ? window.activeNotification(state) : null;
    const urgent = !!n && (n.level === "CRITICAL" || n.level === "HIGH");
    const body = n
      ? '<div class="notification-strip-item notification-slide-up' +
        (urgent ? " urgent" : "") +
        '">' +
        ui.dot(ui.levelDot[n.level], "margin-top:0.4rem") +
        '<div style="flex:1;min-width:0">' +
        '<div class="label-xs strong' +
        (urgent ? " text-accent" : "") +
        '">' +
        esc(n.title) +
        " ALERT" +
        (urgent ? " | PRIORITY" : "") +
        "</div>" +
        '<p class="small muted" style="margin-top:0.5rem">' +
        esc(n.detail) +
        "</p></div>" +
        ui.iconButton({
          icon: "x",
          label: "Dismiss notification",
          act: "dismiss-note",
          id: n.id,
          className: "bare",
        }) +
        "</div>"
      : '<div class="notification-strip-empty"><p class="small">No new security notifications</p>' +
        '<p class="xsmall muted" style="margin-top:0.5rem">The live queue is clear.</p></div>';

    return (
      '<section class="panel-solid notification-strip span-2" aria-live="assertive" aria-label="Latest security notification">' +
      '<div class="between"><span class="label-xs">Live notification</span>' +
      '<span class="num xsmall muted">7 SEC WINDOW</span></div>' +
      body +
      "</section>"
    );
  }

  /* ================= Overview ================= */

  const overview = {
    title: () => "Overview | V.I.E.W Surveillance Command",
    local: { detectionsExpanded: false, metricExpanded: false },
    render(state, local) {
      const openAlerts = state.alerts.filter((a) => a.status === "open");
      const critical = openAlerts.filter((a) => a.level === "CRITICAL" || a.level === "HIGH").length;
      const detections = state.series.detections;
      const peak = Math.max.apply(null, detections);
      const peakIndex = detections.indexOf(peak);
      const threatTone =
        state.stats.activeThreatLevel === "HIGH"
          ? "text-accent"
          : state.stats.activeThreatLevel === "ELEVATED"
            ? "text-warn"
            : "text-ok";

      const detailBlock = (label, value) =>
        '<div><div class="label-xs">' +
        esc(label) +
        '</div><div class="num" style="margin-top:0.25rem;font-size:1.3rem">' +
        esc(value) +
        "</div></div>";

      const metricExtra = local.metricExpanded
        ? '<div style="border-top:1px solid var(--line);padding-top:1rem">' +
          '<div class="h-40">' +
          c.bars(detections, hourLabels(detections), peakIndex) +
          "</div>" +
          '<div class="grid cols-4 tight" style="margin-top:1rem">' +
          detailBlock("Peak hour", pad2(peakIndex) + ":00") +
          detailBlock("Peak count", peak) +
          detailBlock("Hourly average", Math.round(sum(detections) / detections.length)) +
          detailBlock("Latest hour", detections[detections.length - 1]) +
          "</div></div>"
        : "";

      const metrics =
        '<div class="grid cols-4 tight">' +
        ui.metric({
          label: "Cameras online",
          value: state.stats.camerasOnline,
          tone: "text-ok",
          note:
            state.stats.camerasTotal +
            " registered / " +
            (state.stats.camerasTotal - state.stats.camerasOnline) +
            " unavailable",
        }) +
        ui.metric({
          label: "Open alerts",
          value: openAlerts.length,
          tone: openAlerts.length ? "text-accent" : "",
          note: critical + " high or critical",
        }) +
        ui.metric({
          label: "Detections today",
          value: sum(detections),
          className: local.metricExpanded ? "span-all" : "",
          chart: c.sparkline(detections, "text-info"),
          headAction: ui.iconButton({
            icon: local.metricExpanded ? "arrowDownLeft" : "arrowUpRight",
            label: (local.metricExpanded ? "Collapse" : "Expand") + " detections graph",
            act: "toggle-metric",
            ariaExpanded: String(local.metricExpanded),
          }),
          extra: metricExtra,
        }) +
        ui.metric({
          label: "Vehicles scanned",
          value: state.stats.vehiclesScannedToday,
          note: "ANPR reads since 00:00",
        }) +
        ui.metric({
          label: "Processing load",
          value: state.stats.processingLoadPct,
          unit: "%",
          tone: state.stats.processingLoadPct > 70 ? "text-warn" : "",
          note: state.stats.networkThroughputMbps + " Mbps edge throughput",
        }) +
        ui.metric({
          label: "Threat level",
          valueHtml: '<span class="' + threatTone + '">' + esc(state.stats.activeThreatLevel) + "</span>",
          note: state.stats.intrusionsBlocked + " incursions blocked",
        }) +
        notificationStrip(state) +
        "</div>";

      const wall = ui.panel({
        title: "Monitor wall: priority feeds",
        action:
          '<a href="#/monitor" class="label-xs" data-tip="All feeds" style="display:flex;align-items:center;gap:0.35rem">All feeds ' +
          window.icon("arrowUpRight") +
          "</a>",
        body:
          '<div class="grid cols-2 tight">' +
          state.cameras
            .slice(0, 4)
            .map((camera) => comp.cameraTile(camera, { compact: true }))
            .join("") +
          "</div>",
      });

      const alertsPanel = ui.panel({
        title: "Active alerts",
        flush: true,
        action:
          '<a href="#/alerts" class="label-xs" data-tip="Alert queue" style="display:flex;align-items:center;gap:0.35rem">Queue ' +
          window.icon("arrowUpRight") +
          "</a>",
        body: openAlerts.length
          ? '<ul class="list">' +
            openAlerts
              .slice(0, 7)
              .map(
                (alert) =>
                  '<li class="list-row">' +
                  ui.dot(ui.levelDot[alert.level], "margin-top:0.4rem") +
                  '<div style="flex:1;min-width:0">' +
                  '<div class="between"><span class="label-xs strong">' +
                  esc(alert.level) +
                  '</span><span class="num xsmall muted">' +
                  esc(alert.timestamp) +
                  "</span></div>" +
                  '<p class="small" style="margin-top:0.35rem">' +
                  esc(alert.message) +
                  '</p><p class="xsmall muted" style="margin-top:0.25rem">' +
                  esc(alert.cameraName) +
                  '</p><div class="row" style="margin-top:0.6rem;gap:0.5rem">' +
                  ui.button({ label: "Acknowledge", act: "acknowledge-alert", id: alert.id, tiny: true }) +
                  ui.button({ label: "Resolve", act: "resolve-alert", id: alert.id, tiny: true }) +
                  "</div></div></li>",
              )
              .join("") +
            "</ul>"
          : '<p class="empty">Queue clear. No open alerts in this sector.</p>',
      });

      const detectionsPanel = ui.panel({
        title: "Detections: last 24 hours",
        className: local.detectionsExpanded ? "span-all" : "",
        action: ui.iconButton({
          icon: local.detectionsExpanded ? "arrowDownLeft" : "arrowUpRight",
          label: (local.detectionsExpanded ? "Collapse" : "Expand") + " detection graph",
          act: "toggle-detections",
          ariaExpanded: String(local.detectionsExpanded),
        }),
        body:
          '<div class="' +
          (local.detectionsExpanded ? "h-72" : "h-40") +
          '">' +
          c.bars(detections, hourLabels(detections), peakIndex) +
          "</div>" +
          '<div class="grid cols-3 tight" style="margin-top:1rem;border-top:1px solid var(--line);padding-top:1rem">' +
          detailBlock("Peak hour", pad2(peakIndex) + ":00") +
          detailBlock("Peak count", peak) +
          detailBlock("Zones armed", state.zones.length) +
          (local.detectionsExpanded
            ? detailBlock("Hourly average", Math.round(sum(detections) / detections.length)) +
              detailBlock("Latest hour", detections[detections.length - 1]) +
              detailBlock("Cameras reporting", state.stats.camerasOnline + "/" + state.stats.camerasTotal)
            : "") +
          "</div>",
      });

      const eventsPanel = ui.panel({
        title: "Event stream",
        flush: true,
        body:
          '<ul class="list stream-list">' +
          state.events
            .slice(0, 12)
            .map(
              (event) =>
                '<li class="list-row" style="padding:0.6rem 1rem">' +
                '<span class="num xsmall muted" style="width:3.8rem;flex-shrink:0">' +
                esc(event.timestamp) +
                '</span><div style="min-width:0"><p class="small truncate">' +
                esc(event.title) +
                '</p><p class="xsmall muted truncate">' +
                esc(event.source) +
                "</p></div></li>",
            )
            .join("") +
          "</ul>",
      });

      const healthPanel = ui.panel({
        title: "System health",
        body:
          "<ul>" +
          state.health
            .slice(0, 6)
            .map(
              (service) =>
                '<li class="row" style="gap:0.75rem;margin-bottom:0.75rem;flex-wrap:nowrap">' +
                ui.dot(ui.serviceDot[service.state]) +
                '<span class="small">' +
                esc(service.label) +
                '</span><span class="num xsmall muted" style="margin-left:auto">' +
                service.latencyMs +
                'ms</span><span class="label-xs" style="width:7rem;text-align:right">' +
                ui.serviceLabel[service.state] +
                "</span></li>",
            )
            .join("") +
          '</ul><div style="margin-top:1.25rem;border-top:1px solid var(--line);padding-top:1rem">' +
          '<div class="between"><span class="label-xs">Storage used</span><span class="num">' +
          state.stats.storageUsedPct +
          '%</span></div><div style="margin:0.5rem 0 1rem">' +
          c.meter(state.stats.storageUsedPct, "info") +
          "</div>" +
          '<div class="between"><span class="label-xs">Processing load</span><span class="num">' +
          state.stats.processingLoadPct +
          '%</span></div><div style="margin:0.5rem 0 1rem">' +
          c.meter(state.stats.processingLoadPct, "warn") +
          "</div>" +
          '<div class="between"><span class="label-xs">Uptime</span><span class="num">' +
          esc(ui.formatUptime(state.stats.uptimeSeconds)) +
          "</span></div></div>",
      });

      return ui.page({
        title: "Sector Overview",
        subtitle:
          "Consolidated state of the surveillance estate: camera availability, AI detections, zone integrity and backend services.",
        actions:
          ui.button({ label: "Inject breach drill", act: "trigger-breach", variant: "solid", icon: "shield" }) +
          '<a href="#/monitor">' +
          ui.button({ label: "Open live wall", act: "noop" }) +
          "</a>",
        body:
          metrics +
          '<div class="grid split-2-1">' +
          wall +
          alertsPanel +
          "</div>" +
          '<div class="grid cols-3">' +
          detectionsPanel +
          eventsPanel +
          healthPanel +
          "</div>",
      });
    },
    handlers: {
      "toggle-detections": (el, ev, ctx) => {
        ctx.local.detectionsExpanded = !ctx.local.detectionsExpanded;
        ctx.rerender();
      },
      "toggle-metric": (el, ev, ctx) => {
        ctx.local.metricExpanded = !ctx.local.metricExpanded;
        ctx.rerender();
      },
      noop: () => {},
    },
  };

  /* ================= Live Wall ================= */

  const monitor = {
    title: () => "Live Wall | V.I.E.W Surveillance Command",
    local: {
      query: "",
      status: "all",
      sort: "id",
      solo: null,
      addOpen: false,
      form: Object.assign({}, EMPTY_CAMERA_FORM),
      formError: null,
      pendingRemoval: null,
    },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const visible = state.cameras
        .filter((cam) => (local.status === "all" ? true : cam.status === local.status))
        .filter(
          (cam) =>
            !q ||
            cam.name.toLowerCase().indexOf(q) >= 0 ||
            cam.location.toLowerCase().indexOf(q) >= 0 ||
            cam.id.toLowerCase().indexOf(q) >= 0,
        )
        .sort((a, b) => {
          if (local.sort === "name") return a.name.localeCompare(b.name);
          if (local.sort === "status") return a.status.localeCompare(b.status);
          return a.id.localeCompare(b.id);
        });

      const soloCamera = state.cameras.find((cam) => cam.id === local.solo) || null;
      const pending = state.cameras.find((cam) => cam.id === local.pendingRemoval) || null;

      const body = soloCamera
        ? comp.cameraSolo(state, soloCamera, { backAct: "clear-solo" })
        : '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "wall-query",
            placeholder: "Search feeds by name, id or location",
            label: "Search cameras",
          }) +
          ui.select({
            act: "set-status",
            key: "wall-status",
            value: local.status,
            className: "w40",
            ariaLabel: "Filter by status",
            options: [
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "warning", label: "Warning" },
              { value: "offline", label: "Offline" },
            ],
          }) +
          ui.select({
            act: "set-sort",
            key: "wall-sort",
            value: local.sort,
            className: "w40",
            ariaLabel: "Sort cameras",
            options: [
              { value: "id", label: "Sort by ID" },
              { value: "name", label: "Sort by name" },
              { value: "status", label: "Sort by status" },
            ],
          }) +
          '<span class="num small muted">' +
          visible.length +
          " / " +
          state.cameras.length +
          " feeds</span></div>" +
          (visible.length
            ? '<div class="wall l' +
              state.layout +
              '">' +
              visible
                .map((camera) => comp.cameraTile(camera, { removable: true, soloAct: true }))
                .join("") +
              "</div>"
            : '<div class="panel" style="padding:4rem 1.5rem;text-align:center">' +
              '<p class="small">No feeds match the current filters.</p>' +
              '<div class="row" style="justify-content:center;margin-top:1rem">' +
              ui.button({ label: "Clear filters", act: "clear-filters" }) +
              "</div></div>");

      return ui.page({
        title: soloCamera ? soloCamera.name : "Live Wall",
        subtitle: soloCamera
          ? soloCamera.location + ": single feed focus. Everything else is hidden while this camera is open."
          : "All registered feeds. Select any feed to isolate it, or add and deregister cameras from the controls below.",
        actions: soloCamera
          ? ""
          : ui.button({ label: "Add camera", act: "open-add", variant: "solid", icon: "plus" }) +
            ui.segmented({
              act: "set-layout",
              ariaLabel: "Wall layout",
              value: state.layout,
              options: [
                { value: "2x2", label: "2x2" },
                { value: "3x2", label: "3x2" },
                { value: "3x3", label: "3x3" },
                { value: "4x4", label: "4x4" },
              ],
            }),
        body:
          body +
          (local.addOpen
            ? ui.modal({
                title: "Register camera",
                width: "40rem",
                closeAct: "close-add",
                body: comp.addCameraForm(state, local.form, local.formError),
              })
            : "") +
          (pending
            ? removeModal(
                pending,
                pending.name +
                  " will be deregistered from the wall and its stream released. Archived footage is retained.",
              )
            : ""),
      });
    },
    handlers: Object.assign(cameraFormHandlers(), {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-status": (el, ev, ctx) => {
        ctx.local.status = el.value;
        ctx.rerender();
      },
      "set-sort": (el, ev, ctx) => {
        ctx.local.sort = el.value;
        ctx.rerender();
      },
      "clear-filters": (el, ev, ctx) => {
        ctx.local.query = "";
        ctx.local.status = "all";
        ctx.rerender();
      },
      "open-camera": (el, ev, ctx) => {
        ctx.local.solo = el.getAttribute("data-id");
        window.scrollTo(0, 0);
        ctx.rerender();
      },
      "clear-solo": (el, ev, ctx) => {
        ctx.local.solo = null;
        ctx.rerender();
      },
    }),
  };

  /* ================= Camera registry ================= */

  const cameras = {
    title: () => "Camera Registry | V.I.E.W Surveillance Command",
    local: {
      query: "",
      status: "all",
      addOpen: false,
      form: Object.assign({}, EMPTY_CAMERA_FORM),
      formError: null,
      pendingRemoval: null,
    },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const rows = state.cameras
        .filter((cam) => (local.status === "all" ? true : cam.status === local.status))
        .filter(
          (cam) =>
            !q ||
            cam.name.toLowerCase().indexOf(q) >= 0 ||
            cam.location.toLowerCase().indexOf(q) >= 0 ||
            cam.rtspUrl.toLowerCase().indexOf(q) >= 0,
        );

      const pending = state.cameras.find((cam) => cam.id === local.pendingRemoval) || null;

      const table =
        '<div class="table-scroll"><table style="min-width:56rem"><thead><tr>' +
        ["ID", "Camera", "Location", "Zone", "Feed", "Stream", "State", ""]
          .map((h) => "<th>" + esc(h) + "</th>")
          .join("") +
        "</tr></thead><tbody>" +
        rows
          .map((camera) => {
            const zone = state.zones.find((z) => z.id === camera.zoneId);
            return (
              "<tr>" +
              '<td class="num muted">' +
              esc(camera.id.toUpperCase()) +
              '</td><td><a class="cell-link" href="#/cameras/' +
              esc(camera.id) +
              '" data-tip="' +
              esc(camera.name) +
              '">' +
              esc(camera.name) +
              '</a></td><td class="muted">' +
              esc(camera.location) +
              '</td><td class="muted">' +
              esc(zone ? zone.name : "Unassigned") +
              '</td><td class="muted">' +
              esc(
                camera.feedType.toUpperCase() + " / " + camera.resolution + " / " + camera.fps + "fps",
              ) +
              '</td><td class="muted truncate" style="max-width:16rem">' +
              esc(camera.rtspUrl) +
              '</td><td><span class="row" style="gap:0.5rem;flex-wrap:nowrap">' +
              ui.dot(ui.statusDot[camera.status]) +
              esc(camera.status.toUpperCase()) +
              '</span></td><td style="text-align:right">' +
              ui.iconButton({
                icon: "trash",
                label: "Remove " + camera.name,
                act: "ask-remove",
                id: camera.id,
                className: "danger",
              }) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>" +
        (rows.length ? "" : '<p class="empty">No cameras match this filter.</p>');

      return ui.page({
        title: "Camera Registry",
        subtitle:
          "Every registered stream, its zone binding and current decoder state. Registration writes to the cameras table through the API.",
        actions: ui.button({ label: "Add camera", act: "open-add", variant: "solid", icon: "plus" }),
        body:
          '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "reg-query",
            placeholder: "Search registry",
            label: "Search camera registry",
          }) +
          ui.select({
            act: "set-status",
            key: "reg-status",
            value: local.status,
            className: "w40",
            ariaLabel: "Filter by status",
            options: [
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "warning", label: "Warning" },
              { value: "offline", label: "Offline" },
            ],
          }) +
          '<span class="num small muted">' +
          rows.length +
          " records</span></div>" +
          ui.panel({ solid: true, flush: true, body: table }) +
          (local.addOpen
            ? ui.modal({
                title: "Register camera",
                width: "40rem",
                closeAct: "close-add",
                body: comp.addCameraForm(state, local.form, local.formError),
              })
            : "") +
          (pending
            ? removeModal(
                pending,
                "Deregister " + pending.name + "? The record is deleted and the feed disappears from the wall.",
              )
            : ""),
      });
    },
    handlers: Object.assign(cameraFormHandlers(), {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-status": (el, ev, ctx) => {
        ctx.local.status = el.value;
        ctx.rerender();
      },
    }),
  };

  /* ================= Camera detail ================= */

  const cameraDetail = {
    title: (state, local, params) => {
      const camera = state.cameras.find((cam) => cam.id === params.cameraId);
      return (camera ? camera.name : "Camera Detail") + " | V.I.E.W Surveillance Command";
    },
    local: {},
    render(state, local, params) {
      const camera = state.cameras.find((cam) => cam.id === params.cameraId);
      if (!camera) {
        return ui.page({
          title: "Camera not found",
          subtitle: "No registered camera with id " + params.cameraId + ".",
          body:
            '<div class="panel" style="padding:4rem 1.5rem;text-align:center">' +
            '<p class="small muted">The record may have been deregistered from the estate.</p>' +
            '<div class="row" style="justify-content:center;margin-top:1.25rem">' +
            '<a href="#/cameras">' +
            ui.button({ label: "Back to registry", act: "noop" }) +
            "</a></div></div>",
        });
      }

      return ui.page({
        title: camera.name,
        subtitle: camera.location + ": isolated feed. Only this camera is streamed on this screen.",
        actions: '<a href="#/cameras">' + ui.button({ label: "Back to registry", act: "noop" }) + "</a>",
        body: comp.cameraSolo(state, camera, {}),
      });
    },
    handlers: { noop: () => {} },
  };

  /* ================= Alerts ================= */

  const LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

  const alerts = {
    title: () => "Alert Queue | V.I.E.W Surveillance Command",
    local: { query: "", level: "all", status: "all", selected: null },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const rows = state.alerts
        .filter((a) => (local.level === "all" ? true : a.level === local.level))
        .filter((a) => (local.status === "all" ? true : a.status === local.status))
        .filter(
          (a) =>
            !q ||
            a.message.toLowerCase().indexOf(q) >= 0 ||
            a.cameraName.toLowerCase().indexOf(q) >= 0 ||
            (a.entityId || "").toLowerCase().indexOf(q) >= 0,
        );

      const distribution = LEVELS.map((l) => ({
        label: l,
        value: state.alerts.filter((a) => a.level === l).length,
        tone:
          l === "CRITICAL" || l === "HIGH"
            ? "text-accent"
            : l === "MEDIUM"
              ? "text-warn"
              : l === "LOW"
                ? "text-info"
                : "text-idle",
      })).filter((s) => s.value > 0);

      const open = state.alerts.filter((a) => a.status === "open");
      const selected = state.alerts.find((a) => a.id === local.selected) || null;

      const queue = rows.length
        ? '<ul class="list">' +
          rows
            .map(
              (alert) =>
                '<li class="row alert-slide-down" style="align-items:flex-start;flex-wrap:wrap;position:relative;padding-right:2.75rem">' +
                ui.dot(ui.levelDot[alert.level], "margin-top:0.45rem") +
                '<div style="flex:1;min-width:15rem">' +
                '<div class="row" style="gap:0.85rem">' +
                '<span class="label-xs ' +
                ui.levelColor[alert.level] +
                '">' +
                esc(alert.level) +
                '</span><span class="label-xs">' +
                esc(alert.module.replace("_", " ")) +
                '</span><span class="num xsmall muted">' +
                esc(alert.timestamp) +
                '</span><span class="label-xs" style="margin-left:auto">' +
                esc(alert.status) +
                "</span></div>" +
                '<p class="small" style="margin-top:0.5rem">' +
                esc(alert.message) +
                '</p><p class="xsmall muted" style="margin-top:0.25rem">' +
                esc(
                  alert.cameraName +
                    (alert.zoneName ? " / " + alert.zoneName : "") +
                    (alert.entityId ? " / " + alert.entityId : ""),
                ) +
                "</p></div>" +
                '<div class="row" style="gap:0.5rem">' +
                ui.button({ label: "Detail", act: "open-detail", id: alert.id, tiny: true }) +
                ui.button({
                  label: "Acknowledge",
                  act: "acknowledge-alert",
                  id: alert.id,
                  tiny: true,
                  disabled: alert.status !== "open",
                }) +
                ui.button({
                  label: "Resolve",
                  act: "resolve-alert",
                  id: alert.id,
                  tiny: true,
                  disabled: alert.status === "resolved",
                }) +
                "</div>" +
                ui.iconButton({
                  icon: "x",
                  label: "Remove " + alert.level.toLowerCase() + " alert",
                  act: "remove-alert",
                  id: alert.id,
                  className: "bare alert-remove",
                }) +
                "</li>",
            )
            .join("") +
          "</ul>"
        : '<p class="empty">Nothing in the queue for this filter.</p>';

      const detailModal = selected
        ? ui.modal({
            title: "Alert " + selected.id,
            closeAct: "close-detail",
            body:
              '<p style="line-height:1.6">' +
              esc(selected.message) +
              '</p><dl class="dl" style="margin-top:1rem">' +
              [
                ["Severity", selected.level],
                ["Module", selected.module.replace("_", " ")],
                ["Camera", selected.cameraName],
                ["Zone", selected.zoneName || "Not assigned"],
                ["Entity", selected.entityId || "Not assigned"],
                ["Status", selected.status.toUpperCase()],
                ["Raised at", selected.timestamp],
              ]
                .map(
                  (row) =>
                    '<div><dt class="label-xs">' + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd></div>",
                )
                .join("") +
              '</dl><div class="row end" style="margin-top:1rem">' +
              ui.button({
                label: "Acknowledge",
                act: "ack-and-close",
                id: selected.id,
                disabled: selected.status !== "open",
              }) +
              ui.button({
                label: "Resolve",
                act: "resolve-and-close",
                id: selected.id,
                variant: "solid",
                disabled: selected.status === "resolved",
              }) +
              "</div>",
          })
        : "";

      return ui.page({
        title: "Alert Queue",
        subtitle:
          "Alerts are produced by the AI pipeline and dispatched to this console. Operators may acknowledge or resolve; they are never created here.",
        actions: ui.button({
          label: "Inject breach drill",
          act: "trigger-breach",
          variant: "solid",
          icon: "shield",
        }),
        body:
          '<div class="grid split-1-side"><div class="stack">' +
          '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "alert-query",
            placeholder: "Search alerts, cameras or entity IDs",
            label: "Search alerts",
          }) +
          ui.select({
            act: "set-level",
            key: "alert-level",
            value: local.level,
            className: "w40",
            ariaLabel: "Filter by severity",
            options: [{ value: "all", label: "All severities" }].concat(
              LEVELS.map((l) => ({ value: l, label: l })),
            ),
          }) +
          ui.select({
            act: "set-status",
            key: "alert-status",
            value: local.status,
            className: "w40",
            ariaLabel: "Filter by status",
            options: [
              { value: "all", label: "All states" },
              { value: "open", label: "Open" },
              { value: "acknowledged", label: "Acknowledged" },
              { value: "resolved", label: "Resolved" },
            ],
          }) +
          "</div>" +
          ui.panel({ solid: true, flush: true, body: queue }) +
          '</div><div class="stack">' +
          ui.panel({
            title: "Severity distribution",
            body: c.donut(distribution, String(state.alerts.length), "Alerts in window"),
          }) +
          ui.panel({
            title: "Queue state",
            body:
              "<ul>" +
              ["open", "acknowledged", "resolved"]
                .map(
                  (s) =>
                    '<li class="between" style="margin-bottom:0.75rem"><span class="label-xs">' +
                    esc(s) +
                    '</span><span class="num" style="font-size:1.2rem">' +
                    state.alerts.filter((a) => a.status === s).length +
                    "</span></li>",
                )
                .join("") +
              '</ul><p class="xsmall muted" style="margin-top:1rem;border-top:1px solid var(--line);padding-top:1rem">' +
              open.length +
              " alert" +
              (open.length === 1 ? "" : "s") +
              " awaiting operator action. The badge in the navigation rail mirrors this count.</p>",
          }) +
          "</div></div>" +
          detailModal,
      });
    },
    handlers: {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-level": (el, ev, ctx) => {
        ctx.local.level = el.value;
        ctx.rerender();
      },
      "set-status": (el, ev, ctx) => {
        ctx.local.status = el.value;
        ctx.rerender();
      },
      "open-detail": (el, ev, ctx) => {
        ctx.local.selected = el.getAttribute("data-id");
        ctx.rerender();
      },
      "close-detail": (el, ev, ctx) => {
        ctx.local.selected = null;
        ctx.rerender();
      },
      escape: (el, ev, ctx) => {
        if (ctx.local.selected) {
          ctx.local.selected = null;
          ctx.rerender();
        }
      },
      "ack-and-close": (el, ev, ctx) => {
        actions.acknowledgeAlert(el.getAttribute("data-id"));
        ctx.local.selected = null;
        ctx.rerender();
      },
      "resolve-and-close": (el, ev, ctx) => {
        actions.resolveAlert(el.getAttribute("data-id"));
        ctx.local.selected = null;
        ctx.rerender();
      },
    },
  };

  /* ================= Events ================= */

  const KIND_TONE = {
    security: { dot: "bg-accent", label: "SECURITY" },
    camera: { dot: "bg-info", label: "CAMERA" },
    system: { dot: "bg-ok", label: "SYSTEM" },
    network: { dot: "bg-warn", label: "NETWORK" },
    user: { dot: "bg-idle", label: "OPERATOR" },
  };

  const events = {
    title: () => "Event Timeline | V.I.E.W Surveillance Command",
    local: { query: "", kind: "all" },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const rows = state.events
        .filter((e) => (local.kind === "all" ? true : e.kind === local.kind))
        .filter(
          (e) =>
            !q ||
            e.title.toLowerCase().indexOf(q) >= 0 ||
            e.detail.toLowerCase().indexOf(q) >= 0 ||
            e.source.toLowerCase().indexOf(q) >= 0,
        );

      const cards =
        '<div class="grid cols-5 tight">' +
        Object.keys(KIND_TONE)
          .map(
            (k) =>
              '<button type="button" class="panel kind-card" data-act="toggle-kind" data-value="' +
              k +
              '" data-tip="Filter ' +
              KIND_TONE[k].label +
              '" aria-pressed="' +
              (local.kind === k) +
              '"><span class="row" style="gap:0.5rem">' +
              ui.dot(KIND_TONE[k].dot) +
              '<span class="label-xs">' +
              KIND_TONE[k].label +
              '</span></span><span class="count-big">' +
              state.events.filter((e) => e.kind === k).length +
              "</span></button>",
          )
          .join("") +
        "</div>";

      const list = rows.length
        ? '<ul class="list">' +
          rows
            .map(
              (event) =>
                '<li class="list-row">' +
                '<span class="num xsmall muted" style="width:4.4rem;flex-shrink:0">' +
                esc(event.timestamp) +
                "</span>" +
                ui.dot(KIND_TONE[event.kind].dot, "margin-top:0.4rem") +
                '<div style="flex:1;min-width:0"><div class="row" style="gap:0.85rem">' +
                '<span class="small">' +
                esc(event.title) +
                '</span><span class="label-xs">' +
                KIND_TONE[event.kind].label +
                "</span></div>" +
                '<p class="xsmall muted" style="margin-top:0.25rem">' +
                esc(event.detail) +
                '</p></div><span class="xsmall muted" style="flex-shrink:0">' +
                esc(event.source) +
                "</span></li>",
            )
            .join("") +
          "</ul>"
        : '<p class="empty">No events match this filter.</p>';

      return ui.page({
        title: "Event Timeline",
        subtitle:
          "Every signal the platform has observed in this session, newest first. Live entries arrive on the realtime channel.",
        body:
          cards +
          '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "event-query",
            placeholder: "Search the timeline",
            label: "Search events",
          }) +
          ui.select({
            act: "set-kind",
            key: "event-kind",
            value: local.kind,
            className: "w40",
            ariaLabel: "Filter by event type",
            options: [{ value: "all", label: "All event types" }].concat(
              Object.keys(KIND_TONE).map((k) => ({ value: k, label: KIND_TONE[k].label })),
            ),
          }) +
          (local.query || local.kind !== "all"
            ? ui.button({ label: "Reset", act: "reset-filters" })
            : "") +
          "</div>" +
          ui.panel({ solid: true, flush: true, body: list }),
      });
    },
    handlers: {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-kind": (el, ev, ctx) => {
        ctx.local.kind = el.value;
        ctx.rerender();
      },
      "toggle-kind": (el, ev, ctx) => {
        const value = el.getAttribute("data-value");
        ctx.local.kind = ctx.local.kind === value ? "all" : value;
        ctx.rerender();
      },
      "reset-filters": (el, ev, ctx) => {
        ctx.local.query = "";
        ctx.local.kind = "all";
        ctx.rerender();
      },
    },
  };

  /* ================= Zones ================= */

  const zones = {
    title: () => "Sector Map | V.I.E.W Surveillance Command",
    local: { selectedId: null },
    render(state, local) {
      if (!local.selectedId && state.zones.length) local.selectedId = state.zones[0].id;
      const selected = state.zones.find((z) => z.id === local.selectedId) || null;
      const camera = selected ? state.cameras.find((cam) => cam.id === selected.cameraId) : null;
      const zoneAlerts = selected ? state.alerts.filter((a) => a.zoneName === selected.name) : [];

      const counts =
        '<div class="grid cols-4 tight" style="margin-top:1rem;border-top:1px solid var(--line);padding-top:1rem">' +
        ["RED", "AMBER", "GREEN", "CORRIDOR"]
          .map(
            (type) =>
              '<div><div class="row" style="gap:0.5rem">' +
              ui.dot(comp.ZONE_DOT[type]) +
              '<span class="label-xs">' +
              type +
              '</span></div><div class="num" style="margin-top:0.5rem;font-size:1.6rem">' +
              state.zones.filter((z) => z.type === type).length +
              "</div></div>",
          )
          .join("") +
        "</div>";

      const register =
        '<ul class="list" style="padding:0">' +
        state.zones
          .map(
            (zone) =>
              '<li style="padding:0"><button type="button" class="zone-item' +
              (zone.id === local.selectedId ? " active" : "") +
              '" data-act="select-zone" data-id="' +
              esc(zone.id) +
              '" data-tip="Select ' +
              esc(zone.name) +
              '" aria-label="Select ' +
              esc(zone.name) +
              '">' +
              ui.dot(comp.ZONE_DOT[zone.type]) +
              '<span style="flex:1;min-width:0"><span class="small truncate" style="display:block">' +
              esc(zone.name) +
              '</span><span class="xsmall muted" style="display:block">' +
              esc(
                (state.cameras.find((cam) => cam.id === zone.cameraId) || {}).name || "No camera bound",
              ) +
              '</span></span><span class="num xsmall muted">' +
              (zone.dwellThreshold === 0 ? "INSTANT" : zone.dwellThreshold + "s") +
              "</span></button></li>",
          )
          .join("") +
        "</ul>";

      const detail = selected
        ? ui.panel({
            title: "Zone detail",
            solid: true,
            body:
              '<h3 style="font-size:1.2rem;font-weight:700">' +
              esc(selected.name) +
              '</h3><dl class="dl" style="margin-top:1rem">' +
              [
                ["Classification", selected.type],
                [
                  "Dwell rule",
                  selected.dwellThreshold === 0
                    ? "Instant trigger on entry"
                    : selected.dwellThreshold + "s inside boundary",
                ],
                ["Bound camera", camera ? camera.name : "Unassigned"],
                ["Camera state", camera ? camera.status.toUpperCase() : "Not available"],
                ["Alerts raised", String(zoneAlerts.length)],
              ]
                .map(
                  (row) =>
                    '<div><dt class="label-xs">' + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd></div>",
                )
                .join("") +
              "</dl>" +
              (zoneAlerts.length
                ? '<ul style="margin-top:1rem">' +
                  zoneAlerts
                    .slice(0, 4)
                    .map(
                      (a) =>
                        '<li class="row" style="gap:0.5rem;flex-wrap:nowrap;margin-bottom:0.5rem">' +
                        ui.dot(ui.levelDot[a.level]) +
                        '<span class="small truncate" style="flex:1">' +
                        esc(a.message) +
                        '</span><span class="num xsmall muted">' +
                        esc(a.timestamp) +
                        "</span></li>",
                    )
                    .join("") +
                  "</ul>"
                : "") +
              (camera
                ? '<div style="margin-top:1rem"><a href="#/cameras/' +
                  esc(camera.id) +
                  '">' +
                  ui.button({ label: "Open bound camera", act: "noop", block: true }) +
                  "</a></div>"
                : ""),
          })
        : "";

      return ui.page({
        title: "Sector Map",
        subtitle:
          "Virtual fence geometry across the sector. Select a zone to inspect its coverage, dwell rule and alert history.",
        body:
          '<div class="grid split-2-1">' +
          ui.panel({
            title: "Sector 1 to 7 coverage",
            body: comp.sectorMap(state.zones, local.selectedId) + counts,
          }) +
          '<div class="stack">' +
          ui.panel({ title: "Zone register", flush: true, body: register }) +
          detail +
          "</div></div>",
      });
    },
    handlers: {
      "select-zone": (el, ev, ctx) => {
        ctx.local.selectedId = el.getAttribute("data-id");
        ctx.rerender();
      },
      noop: () => {},
    },
  };

  /* ================= Personnel ================= */

  const DUTY_DOT = { "on-duty": "bg-ok", "on-patrol": "bg-info", "off-duty": "bg-idle" };

  const personnel = {
    title: () => "Personnel Registry | V.I.E.W Surveillance Command",
    local: { query: "", status: "all" },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const rows = state.personnel
        .filter((p) => (local.status === "all" ? true : p.status === local.status))
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().indexOf(q) >= 0 ||
            p.serviceNumber.toLowerCase().indexOf(q) >= 0 ||
            p.unit.toLowerCase().indexOf(q) >= 0,
        );

      const counts =
        '<div class="grid cols-3 tight">' +
        ["on-duty", "on-patrol", "off-duty"]
          .map(
            (s) =>
              '<div class="panel" style="padding:1rem"><span class="row" style="gap:0.5rem">' +
              ui.dot(DUTY_DOT[s]) +
              '<span class="label-xs">' +
              esc(s.replace("-", " ")) +
              '</span></span><span class="count-big">' +
              state.personnel.filter((p) => p.status === s).length +
              "</span></div>",
          )
          .join("") +
        "</div>";

      const cards =
        '<div class="grid cols-2 tight">' +
        rows
          .map(
            (person) =>
              '<section class="panel-solid" style="padding:1rem"><div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:1rem">' +
              ui.avatar(person.name, 46) +
              '<div style="flex:1;min-width:0"><div class="row" style="gap:0.5rem;flex-wrap:nowrap">' +
              '<h2 class="truncate" style="font-size:1rem;font-weight:700">' +
              esc(person.name) +
              "</h2>" +
              ui.dot(DUTY_DOT[person.status], "margin-left:auto") +
              '</div><p class="num xsmall muted" style="margin-top:0.25rem">' +
              esc(person.serviceNumber) +
              '</p><dl style="margin-top:0.75rem">' +
              [
                ["Rank", person.rank],
                ["Unit", person.unit],
                ["Station", person.station],
                ["Last verified", person.lastVerified],
              ]
                .map(
                  (row) =>
                    '<div class="between" style="margin-bottom:0.35rem"><dt class="label-xs">' +
                    esc(row[0]) +
                    '</dt><dd class="small truncate" style="text-align:right">' +
                    esc(row[1]) +
                    "</dd></div>",
                )
                .join("") +
              "</dl></div></div></section>",
          )
          .join("") +
        "</div>";

      return ui.page({
        title: "Personnel Registry",
        subtitle:
          "Identity records used by the face-recognition module to separate authorised personnel from unknown subjects. No photographs are stored in this console.",
        body:
          counts +
          '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "p-query",
            placeholder: "Search by name, service number or unit",
            label: "Search personnel",
          }) +
          ui.select({
            act: "set-status",
            key: "p-status",
            value: local.status,
            className: "w40",
            ariaLabel: "Filter by duty status",
            options: [
              { value: "all", label: "All duty states" },
              { value: "on-duty", label: "On duty" },
              { value: "on-patrol", label: "On patrol" },
              { value: "off-duty", label: "Off duty" },
            ],
          }) +
          '<span class="num small muted">' +
          rows.length +
          " records</span></div>" +
          (rows.length ? cards : '<p class="panel empty">No personnel match this filter.</p>'),
      });
    },
    handlers: {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-status": (el, ev, ctx) => {
        ctx.local.status = el.value;
        ctx.rerender();
      },
    },
  };

  /* ================= Vehicles ================= */

  const V_DOT = { verified: "bg-ok", flagged: "bg-accent", "in-transit": "bg-info" };

  const vehicles = {
    title: () => "Vehicle Control | V.I.E.W Surveillance Command",
    local: { query: "", status: "all" },
    render(state, local) {
      const q = local.query.trim().toLowerCase();
      const rows = state.vehicles
        .filter((v) => (local.status === "all" ? true : v.status === local.status))
        .filter(
          (v) =>
            !q ||
            v.plateNumber.toLowerCase().indexOf(q) >= 0 ||
            v.model.toLowerCase().indexOf(q) >= 0 ||
            v.unit.toLowerCase().indexOf(q) >= 0,
        );

      const table =
        '<div class="table-scroll"><table style="min-width:46rem"><thead><tr>' +
        ["Plate", "Class", "Model", "Unit", "Last checkpoint", "State"]
          .map((h) => "<th>" + esc(h) + "</th>")
          .join("") +
        "</tr></thead><tbody>" +
        rows
          .map(
            (vehicle) =>
              '<tr><td class="num">' +
              esc(vehicle.plateNumber) +
              '</td><td class="muted">' +
              esc(vehicle.type) +
              '</td><td class="muted">' +
              esc(vehicle.model) +
              '</td><td class="muted">' +
              esc(vehicle.unit) +
              '</td><td class="muted">' +
              esc(vehicle.lastCheckpoint) +
              '</td><td><span class="row" style="gap:0.5rem;flex-wrap:nowrap">' +
              ui.dot(V_DOT[vehicle.status]) +
              esc(vehicle.status.toUpperCase()) +
              "</span></td></tr>",
          )
          .join("") +
        "</tbody></table></div>" +
        (rows.length ? "" : '<p class="empty">No vehicles match this filter.</p>');

      return ui.page({
        title: "Vehicle Control",
        subtitle:
          "Plates read at checkpoints are matched against the registry. Flagged plates raise a high-severity alert on the queue.",
        body:
          '<div class="grid split-1-side"><div class="stack">' +
          '<div class="panel filters">' +
          ui.searchInput({
            value: local.query,
            act: "set-query",
            key: "v-query",
            placeholder: "Search plate, model or unit",
            label: "Search vehicles",
          }) +
          ui.select({
            act: "set-status",
            key: "v-status",
            value: local.status,
            className: "w40",
            ariaLabel: "Filter by verification state",
            options: [
              { value: "all", label: "All states" },
              { value: "verified", label: "Verified" },
              { value: "in-transit", label: "In transit" },
              { value: "flagged", label: "Flagged" },
            ],
          }) +
          "</div>" +
          ui.panel({ solid: true, flush: true, body: table }) +
          '</div><div class="stack">' +
          ui.panel({
            title: "Checkpoint reads: 24h",
            body:
              '<div class="h-40">' +
              c.bars(
                state.series.vehicles,
                hourLabels(state.series.vehicles),
                state.series.vehicles.indexOf(Math.max.apply(null, state.series.vehicles)),
              ) +
              "</div>",
          }) +
          ui.panel({
            title: "Registry state",
            body:
              "<ul>" +
              ["verified", "in-transit", "flagged"]
                .map(
                  (s) =>
                    '<li class="between" style="margin-bottom:0.75rem"><span class="row" style="gap:0.5rem">' +
                    ui.dot(V_DOT[s]) +
                    '<span class="label-xs">' +
                    esc(s.replace("-", " ")) +
                    '</span></span><span class="num" style="font-size:1.2rem">' +
                    state.vehicles.filter((v) => v.status === s).length +
                    "</span></li>",
                )
                .join("") +
              "</ul>",
          }) +
          "</div></div>",
      });
    },
    handlers: {
      "set-query": (el, ev, ctx) => {
        ctx.local.query = el.value;
        ctx.rerender();
      },
      "set-status": (el, ev, ctx) => {
        ctx.local.status = el.value;
        ctx.rerender();
      },
    },
  };

  /* ================= Analytics ================= */

  const SERIES_LABEL = { detections: "Detections", vehicles: "Plate reads", load: "Processing load" };
  const MODULES = ["HUMAN", "VEHICLE", "VIRTUAL_FENCE", "SYSTEM"];
  const MODULE_TONE = {
    HUMAN: "text-accent",
    VEHICLE: "text-info",
    VIRTUAL_FENCE: "text-warn",
    SYSTEM: "text-ok",
  };

  const analytics = {
    title: () => "Analytics | V.I.E.W Surveillance Command",
    local: { key: "detections" },
    render(state, local) {
      const data = state.series[local.key];
      const total = sum(data);
      const average = Math.round(total / data.length);
      const peak = Math.max.apply(null, data);

      const perCamera = state.cameras
        .map((cam) => ({ camera: cam, count: state.alerts.filter((a) => a.cameraId === cam.id).length }))
        .sort((a, b) => b.count - a.count);
      const maxPerCamera = Math.max.apply(null, [1].concat(perCamera.map((p) => p.count)));

      return ui.page({
        title: "Analytics",
        subtitle:
          "Aggregated over the last 24 hours of pipeline output. Figures are recomputed as the realtime channel delivers new metrics.",
        actions: ui.segmented({
          act: "set-series",
          ariaLabel: "Series",
          value: local.key,
          options: Object.keys(SERIES_LABEL).map((k) => ({ value: k, label: SERIES_LABEL[k] })),
        }),
        body:
          '<div class="grid cols-4 tight">' +
          ui.metric({ label: SERIES_LABEL[local.key] + " total", value: total }) +
          ui.metric({ label: "Hourly average", value: average }) +
          ui.metric({ label: "Peak hour value", value: peak, tone: "text-accent" }) +
          ui.metric({
            label: "Trend",
            value: data[data.length - 1],
            note: "Most recent hour",
            chart: c.sparkline(data, "text-info"),
          }) +
          "</div>" +
          ui.panel({
            title: SERIES_LABEL[local.key] + ": hourly",
            body: '<div class="h-56">' + c.bars(data, hourLabels(data), data.indexOf(peak)) + "</div>",
          }) +
          '<div class="grid split-2-1" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">' +
          ui.panel({
            title: "Alerts by module",
            body: c.donut(
              MODULES.map((m) => ({
                label: m.replace("_", " "),
                value: state.alerts.filter((a) => a.module === m).length,
                tone: MODULE_TONE[m],
              })).filter((s) => s.value > 0),
              String(state.alerts.length),
              "Total alerts",
            ),
          }) +
          ui.panel({
            title: "Alerts per camera",
            body:
              "<ul>" +
              perCamera
                .map(
                  (row) =>
                    '<li style="margin-bottom:0.85rem"><div class="between small"><span class="truncate">' +
                    esc(row.camera.name) +
                    '</span><span class="num muted">' +
                    row.count +
                    '</span></div><div style="margin-top:0.4rem">' +
                    c.meter((row.count / maxPerCamera) * 100, "accent") +
                    "</div></li>",
                )
                .join("") +
              "</ul>",
          }) +
          "</div>" +
          '<div class="grid cols-4 tight">' +
          ui.metric({
            label: "Cameras reporting",
            value: state.stats.camerasOnline + "/" + state.stats.camerasTotal,
          }) +
          ui.metric({ label: "Incursions blocked", value: state.stats.intrusionsBlocked, tone: "text-accent" }) +
          ui.metric({ label: "Personnel on duty", value: state.stats.personnelOnDuty, tone: "text-ok" }) +
          ui.metric({
            label: "Edge throughput",
            value: state.stats.networkThroughputMbps,
            unit: "Mbps",
            tone: "text-info",
          }) +
          "</div>",
      });
    },
    handlers: {
      "set-series": (el, ev, ctx) => {
        ctx.local.key = el.getAttribute("data-value");
        ctx.rerender();
      },
    },
  };

  /* ================= System ================= */

  const system = {
    title: () => "System Health | V.I.E.W Surveillance Command",
    local: { checking: false },
    render(state, local) {
      const degraded = state.health.filter((s) => s.state !== "operational").length;

      const services =
        '<ul class="list">' +
        state.health
          .map(
            (service) =>
              '<li class="row" style="gap:0.75rem">' +
              ui.dot(ui.serviceDot[service.state]) +
              '<div style="flex:1;min-width:12rem"><p class="small">' +
              esc(service.label) +
              '</p><p class="xsmall muted" style="margin-top:0.25rem">' +
              esc(service.detail) +
              '</p></div><span class="num small muted">' +
              service.latencyMs +
              ' ms</span><span class="label-xs" style="width:8rem;text-align:right">' +
              ui.serviceLabel[service.state] +
              "</span></li>",
          )
          .join("") +
        "</ul>";

      const pressure = [
        { label: "Storage used", value: state.stats.storageUsedPct, tone: "info" },
        { label: "Processing load", value: state.stats.processingLoadPct, tone: "warn" },
        {
          label: "Network saturation",
          value: Math.min(100, Math.round(state.stats.networkThroughputMbps / 10)),
          tone: "ok",
        },
      ]
        .map(
          (row) =>
            '<div style="margin-bottom:1rem"><div class="between"><span class="label-xs">' +
            esc(row.label) +
            '</span><span class="num">' +
            row.value +
            '%</span></div><div style="margin-top:0.5rem">' +
            c.meter(row.value, row.tone) +
            "</div></div>",
        )
        .join("");

      const connection =
        '<dl class="dl">' +
        [
          ["Data source", "Live cloud backend"],
          ["API base", window.API.BASE_URL],
          ["Realtime server", window.API.SOCKET_URL],
          ["Channel state", state.connection.toUpperCase()],
        ]
          .map(
            (row) =>
              '<div><dt class="label-xs">' +
              esc(row[0]) +
              '</dt><dd class="num xsmall truncate">' +
              esc(row[1]) +
              "</dd></div>",
          )
          .join("") +
        '</dl><p class="xsmall muted" style="margin-top:1rem">No database, broker or inference worker is attached to this prototype. Every integration point is stubbed in the service layer and documented in API-INTEGRATION.md.</p>';

      return ui.page({
        title: "System Health",
        subtitle:
          "State of the services this console depends on. In prototype mode the figures are simulated locally; with the backend attached they come from the health endpoint.",
        actions: ui.button({
          label: local.checking ? "Running check" : "Run health check",
          act: "run-check",
          variant: "solid",
          icon: "refresh",
          disabled: local.checking,
        }),
        body:
          '<div class="grid cols-4 tight">' +
          ui.metric({
            label: "Services operational",
            value: state.health.length - degraded + "/" + state.health.length,
            tone: degraded ? "text-warn" : "text-ok",
          }) +
          ui.metric({ label: "Uptime", value: ui.formatUptime(state.stats.uptimeSeconds) }) +
          ui.metric({
            label: "Processing load",
            value: state.stats.processingLoadPct,
            unit: "%",
            chart: c.sparkline(state.series.load, "text-warn"),
          }) +
          ui.metric({
            label: "Realtime channel",
            value: state.connection.toUpperCase(),
            tone: state.connection === "connected" ? "text-ok" : "text-warn",
          }) +
          "</div>" +
          '<div class="grid split-2-1">' +
          ui.panel({ title: "Services", solid: true, flush: true, body: services }) +
          '<div class="stack">' +
          ui.panel({ title: "Resource pressure", body: pressure }) +
          ui.panel({ title: "Connection", body: connection }) +
          "</div></div>",
      });
    },
    handlers: {
      "run-check": (el, ev, ctx) => {
        if (ctx.local.checking) return;
        ctx.local.checking = true;
        ctx.rerender();
        actions.refreshHealth().then(() => {
          ctx.local.checking = false;
          ctx.rerender();
        });
      },
    },
  };

  /* ================= Settings ================= */

  const settings = {
    title: () => "Settings | V.I.E.W Surveillance Command",
    local: {
      operator: "Duty Operator 04",
      station: "Command Post Alpha",
      retention: "30",
      minSeverity: "MEDIUM",
      sound: true,
      banner: true,
      autoAck: false,
      scanlines: true,
      saved: false,
    },
    render(state, local) {
      const toggle = (key, label, detail) =>
        '<div class="toggle-row"><div style="min-width:0"><p class="small">' +
        esc(label) +
        '</p><p class="xsmall muted" style="margin-top:0.25rem">' +
        esc(detail) +
        '</p></div><button type="button" class="switch" role="switch" data-act="toggle-pref" data-value="' +
        key +
        '" data-tip="' +
        esc(label) +
        '" aria-checked="' +
        local[key] +
        '" aria-label="' +
        esc(label) +
        '"><span></span></button></div>';

      return ui.page({
        title: "Settings",
        subtitle:
          "Preferences apply to this console session. Nothing here changes the AI pipeline configuration, which is managed server-side.",
        actions:
          ui.button({ label: "Save preferences", act: "save-prefs", variant: "solid" }) +
          (local.saved ? '<span class="label-xs text-ok">Saved</span>' : ""),
        body:
          '<div class="grid cols-2">' +
          ui.panel({
            title: "Operator",
            body:
              '<div class="stack">' +
              ui.field({
                label: "Operator name",
                control: ui.textInput({ value: local.operator, act: "pref-text", key: "operator", label: "Operator name" }),
              }) +
              ui.field({
                label: "Duty station",
                control: ui.textInput({ value: local.station, act: "pref-text", key: "station", label: "Duty station" }),
              }) +
              ui.field({
                label: "Footage retention (days)",
                control: ui.select({
                  act: "pref-select",
                  key: "retention",
                  value: local.retention,
                  className: "block",
                  label: "Footage retention",
                  options: ["7", "14", "30", "90", "180"].map((d) => ({ value: d, label: d + " days" })),
                }),
              }) +
              "</div>",
          }) +
          ui.panel({
            title: "Monitor wall",
            body:
              ui.field({
                label: "Default layout",
                control: ui.segmented({
                  act: "set-layout",
                  ariaLabel: "Default wall layout",
                  value: state.layout,
                  options: [
                    { value: "2x2", label: "2x2" },
                    { value: "3x2", label: "3x2" },
                    { value: "3x3", label: "3x3" },
                    { value: "4x4", label: "4x4" },
                  ],
                }),
              }) +
              '<div style="margin-top:1rem">' +
              toggle("scanlines", "Scanline overlay", "Adds decoder texture over mock feeds") +
              toggle(
                "autoAck",
                "Auto-acknowledge low severity",
                "Low and informational alerts are marked acknowledged on arrival",
              ) +
              "</div>",
          }) +
          ui.panel({
            title: "Alerting",
            body:
              ui.field({
                label: "Minimum severity to notify",
                control: ui.select({
                  act: "pref-select",
                  key: "minSeverity",
                  value: local.minSeverity,
                  className: "block",
                  label: "Minimum severity",
                  options: LEVELS.map((l) => ({ value: l, label: l })),
                }),
              }) +
              '<div style="margin-top:1rem">' +
              toggle("sound", "Audible alarm", "Plays the console tone for critical alerts") +
              toggle(
                "banner",
                "On-screen notifications",
                "Shows the sliding alert card in the corner of every page",
              ) +
              "</div>",
          }) +
          ui.panel({
            title: "Backend endpoints",
            solid: true,
            body:
              '<dl class="dl">' +
              [
                ["Mode", "Live cloud backend"],
                ["API base URL", window.API.BASE_URL],
                ["Realtime server", window.API.SOCKET_URL],
              ]
                .map(
                  (row) =>
                    '<div><dt class="label-xs">' +
                    esc(row[0]) +
                    '</dt><dd class="num xsmall truncate">' +
                    esc(row[1]) +
                    "</dd></div>",
                )
                .join("") +
              '</dl><p class="xsmall muted" style="margin-top:1rem">Endpoints are read from the configuration block in data.js. Switching to the live backend only requires turning prototype mode off; the service layer already matches the documented contracts.</p>',
          }) +
          "</div>",
      });
    },
    handlers: {
      "pref-text": (el, ev, ctx) => {
        ctx.local[el.getAttribute("data-k")] = el.value;
      },
      "pref-select": (el, ev, ctx) => {
        ctx.local[el.getAttribute("data-k")] = el.value;
        ctx.rerender();
      },
      "toggle-pref": (el, ev, ctx) => {
        const key = el.getAttribute("data-value");
        ctx.local[key] = !ctx.local[key];
        if (key === "scanlines") {
          document.documentElement.classList.toggle("no-scanlines", !ctx.local.scanlines);
        }
        ctx.rerender();
      },
      "save-prefs": (el, ev, ctx) => {
        ctx.local.saved = true;
        actions.pushEvent({
          kind: "user",
          title: "Console preferences updated",
          detail: ctx.local.operator + " saved settings at " + ctx.local.station,
          source: "Settings",
        });
        setTimeout(() => {
          ctx.local.saved = false;
          ctx.rerender();
        }, 2500);
        ctx.rerender();
      },
    },
  };

  /* ================= Not found ================= */

  const notFound = {
    title: () => "Page not found | V.I.E.W Surveillance Command",
    local: {},
    render() {
      return ui.page({
        title: "404",
        subtitle: "The page you are looking for does not exist or has been moved.",
        body:
          '<div class="panel" style="padding:4rem 1.5rem;text-align:center">' +
          '<a href="#/">' +
          ui.button({ label: "Go to overview", act: "noop" }) +
          "</a></div>",
      });
    },
    handlers: { noop: () => {} },
  };

  window.PAGES = {
    overview,
    monitor,
    cameras,
    cameraDetail,
    alerts,
    events,
    zones,
    personnel,
    vehicles,
    analytics,
    system,
    settings,
    notFound,
  };
})();
