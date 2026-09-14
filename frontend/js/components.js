/* Composite components: camera tiles, single-camera view, sector map, dialogs. */
(function () {
  const ui = window.ui;
  const esc = ui.esc;

  function stamp() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
  }

  /** A single feed on the monitor wall. */
  function cameraTile(camera, opts) {
    const o = opts || {};
    const offline = camera.status === "offline";
    const shotClass =
      "cam-shot scanlines" +
      (camera.feedType === "thermal" ? " thermal" : "") +
      (camera.status === "warning" ? " warning" : "");

    const media = offline
      ? '<span class="signal-lost">Signal lost</span>'
      : camera.streamUrl
        ? '<img src="' +
          esc(camera.streamUrl) +
          '" alt="' +
          esc(camera.name + " feed") +
          '" loading="lazy" width="1024" height="576" />'
        : '<span class="signal-lost">No signal / awaiting stream link</span>';

    return (
      '<div class="panel cam-tile">' +
      '<button type="button" class="' +
      shotClass +
      '" data-act="open-camera" data-id="' +
      esc(camera.id) +
      '" data-tip="Open ' +
      esc(camera.name) +
      '" aria-label="Open ' +
      esc(camera.name) +
      ' full view">' +
      media +
      '<span class="cam-badge tl">' +
      ui.dot(ui.statusDot[camera.status]) +
      '<span class="num">' +
      esc(camera.id.toUpperCase()) +
      "</span></span>" +
      (camera.recording && !offline
        ? '<span class="cam-badge tr">' +
          '<span class="dot bg-accent live-dot"></span><span class="num">REC</span></span>'
        : "") +
      '<span class="cam-caption"><span style="min-width:0">' +
      '<span class="name truncate" style="display:block">' +
      esc(camera.name) +
      "</span>" +
      (o.compact
        ? ""
        : '<span class="loc truncate" style="display:block">' + esc(camera.location) + "</span>") +
      '</span><span class="num xsmall muted" data-stamp>' +
      esc(stamp()) +
      "</span></span>" +
      "</button>" +
      '<div class="cam-bar"><div class="group">' +
      ui.iconButton({
        icon: "circle",
        label: camera.recording ? "Stop recording" : "Start recording",
        act: "toggle-recording",
        id: camera.id,
        className: camera.recording ? "rec" : "",
      }) +
      ui.iconButton({
        icon: camera.muted ? "volumeOff" : "volume",
        label: camera.muted ? "Unmute audio" : "Mute audio",
        act: "toggle-mute",
        id: camera.id,
      }) +
      ui.iconButton({ icon: "refresh", label: "Refresh feed", act: "refresh-camera", id: camera.id }) +
      ui.iconButton({ icon: "maximize", label: "Expand feed", act: "open-camera", id: camera.id }) +
      '</div><div class="group">' +
      '<span class="num xsmall muted">' +
      esc(camera.resolution + " / " + camera.fps + " FPS") +
      "</span>" +
      (o.removable
        ? ui.iconButton({
            icon: "x",
            label: "Remove " + camera.name,
            act: "ask-remove",
            id: camera.id,
            className: "danger",
          })
        : "") +
      "</div></div></div>"
    );
  }

  /** Single-camera view: nothing else on screen but this feed and its telemetry. */
  function cameraSolo(state, camera, opts) {
    const o = opts || {};
    const offline = camera.status === "offline";
    const zone = state.zones.find((z) => z.id === camera.zoneId);
    const camAlerts = state.alerts.filter((a) => a.cameraId === camera.id).slice(0, 6);
    const camEvents = state.events.filter((e) => e.source === camera.name).slice(0, 6);

    const meta = [
      ["Name", camera.name],
      ["Location", camera.location],
      ["Status", camera.status.toUpperCase()],
      ["Feed", camera.feedType.toUpperCase()],
      ["Resolution", camera.resolution],
      ["Frame rate", camera.fps + " FPS"],
      ["Recording", camera.recording ? "ACTIVE" : "STOPPED"],
      ["Audio", camera.muted ? "MUTED" : "LIVE"],
      ["Zone", zone ? zone.name : "Unassigned"],
      ["Stream", camera.rtspUrl],
    ];

    const metaHtml =
      '<dl class="dl padded">' +
      meta
        .map(
          (row) =>
            '<div><dt class="label-xs">' +
            esc(row[0]) +
            "</dt><dd>" +
            esc(row[1]) +
            "</dd></div>",
        )
        .join("") +
      "</dl>";

    const alertsHtml = camAlerts.length
      ? '<ul class="list">' +
        camAlerts
          .map(
            (a) =>
              '<li class="list-row">' +
              ui.dot(ui.levelDot[a.level], "margin-top:0.4rem") +
              '<div style="min-width:0"><p class="small">' +
              esc(a.message) +
              '</p><p class="num xsmall muted" style="margin-top:0.25rem">' +
              esc(a.timestamp + " / " + a.status.toUpperCase()) +
              "</p></div></li>",
          )
          .join("") +
        "</ul>"
      : '<p class="empty">No alerts recorded.</p>';

    const eventsHtml = camEvents.length
      ? '<ul class="list">' +
        camEvents
          .map(
            (e) =>
              '<li><p class="small">' +
              esc(e.title) +
              '</p><p class="num xsmall muted" style="margin-top:0.25rem">' +
              esc(e.timestamp) +
              "</p></li>",
          )
          .join("") +
        "</ul>"
      : '<p class="empty">Nothing logged in this window.</p>';

    return (
      '<div class="grid split-2-1">' +
      '<div class="stack">' +
      (o.backAct
        ? ui.button({ label: "Back to wall", act: o.backAct, variant: "ghost", icon: "arrowLeft" })
        : "") +
      '<div class="panel cam-solo scanlines' +
      (camera.feedType === "thermal" ? " thermal" : "") +
      '">' +
      (offline
        ? '<span class="signal-lost">Signal lost</span>'
        : camera.streamUrl
          ? '<img src="' + esc(camera.streamUrl) + '" alt="' + esc(camera.name + " live feed") + '" />'
          : '<span class="signal-lost">No signal / awaiting stream link</span>') +
      '<span class="cam-badge tl">' +
      ui.dot(ui.statusDot[camera.status]) +
      '<span class="num">' +
      esc(camera.id.toUpperCase()) +
      "</span></span>" +
      (camera.recording && !offline
        ? '<span class="cam-badge tr"><span class="dot bg-accent live-dot"></span><span class="num">REC</span></span>'
        : "") +
      '<span class="cam-badge br num" data-stamp>' +
      esc(stamp()) +
      "</span>" +
      "</div>" +
      '<div class="row">' +
      ui.button({
        label: camera.recording ? "Stop recording" : "Start recording",
        act: "toggle-recording",
        id: camera.id,
        icon: "circle",
        variant: camera.recording ? "danger" : "",
      }) +
      ui.button({
        label: camera.muted ? "Unmute" : "Mute",
        act: "toggle-mute",
        id: camera.id,
        icon: camera.muted ? "volumeOff" : "volume",
      }) +
      ui.button({ label: "Refresh feed", act: "refresh-camera", id: camera.id, icon: "refresh" }) +
      "</div></div>" +
      '<div class="stack">' +
      ui.panel({ title: "Camera metadata", solid: true, flush: true, body: metaHtml }) +
      ui.panel({ title: "Alerts from this camera", solid: true, flush: true, body: alertsHtml }) +
      ui.panel({ title: "Recent activity", solid: true, flush: true, body: eventsHtml }) +
      "</div></div>"
    );
  }

  const ZONE_TONE = {
    RED: { stroke: "var(--accent)", fill: "rgba(229,55,43,0.12)", text: "var(--accent)" },
    AMBER: { stroke: "var(--warn)", fill: "rgba(227,177,60,0.12)", text: "var(--warn)" },
    GREEN: { stroke: "var(--ok)", fill: "rgba(53,201,138,0.10)", text: "var(--ok)" },
    CORRIDOR: { stroke: "var(--info)", fill: "rgba(79,155,240,0.10)", text: "var(--info)" },
  };

  const ZONE_DOT = { RED: "bg-accent", AMBER: "bg-warn", GREEN: "bg-ok", CORRIDOR: "bg-info" };

  /** Schematic sector map on a normalised 100x100 grid. */
  function sectorMap(zones, selectedId) {
    let plots = "";
    zones.forEach((zone) => {
      const tone = ZONE_TONE[zone.type];
      const active = zone.id === selectedId;
      plots +=
        '<g class="zone-hit" role="button" tabindex="0" data-act="select-zone" data-id="' +
        esc(zone.id) +
        '" aria-label="' +
        esc(zone.name + ", " + zone.type + " zone") +
        '">' +
        '<circle cx="' +
        zone.x +
        '" cy="' +
        zone.y +
        '" r="' +
        zone.radius +
        '" fill="' +
        tone.fill +
        '" stroke="' +
        tone.stroke +
        '" stroke-width="' +
        (active ? 0.8 : 0.4) +
        '" />' +
        '<circle cx="' +
        zone.x +
        '" cy="' +
        zone.y +
        '" r="1.1" fill="var(--background)" stroke="' +
        tone.stroke +
        '" stroke-width="0.8" />' +
        '<text x="' +
        zone.x +
        '" y="' +
        (zone.y - zone.radius - 1.6) +
        '" text-anchor="middle" fill="' +
        tone.text +
        '" font-size="2.6" letter-spacing="0.2">' +
        esc(zone.type) +
        "</text></g>";
    });

    const legend =
      '<div class="map-legend">' +
      ["RED", "AMBER", "GREEN", "CORRIDOR"]
        .map(
          (type) =>
            '<span class="item">' + ui.dot(ZONE_DOT[type]) + '<span class="label-xs">' + type + "</span></span>",
        )
        .join("") +
      "</div>";

    return (
      '<div class="sector-map">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">' +
      '<path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.15" />' +
      "</pattern></defs>" +
      '<rect width="100" height="100" fill="url(#grid)" />' +
      '<path d="M 2 14 L 24 18 L 48 12 L 72 16 L 98 10" fill="none" stroke="rgba(229,55,43,0.7)" stroke-width="0.5" stroke-dasharray="2 1.5" />' +
      '<path d="M 45 100 L 45 52 L 60 40 L 92 30" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.4" />' +
      "</svg>" +
      '<svg viewBox="0 0 100 100">' +
      plots +
      "</svg>" +
      legend +
      "</div>"
    );
  }

  /** Camera registration form body. */
  function addCameraForm(state, form, error) {
    const zoneOptions = [{ value: "", label: "Unassigned" }].concat(
      state.zones.map((z) => ({ value: z.id, label: z.name })),
    );

    return (
      '<form data-act="submit-camera">' +
      '<div class="form-grid-2" style="margin-bottom:1rem">' +
      ui.field({
        label: "Camera name",
        control: ui.textInput({
          value: form.name,
          act: "camera-field",
          key: "name",
          placeholder: "Tower Echo: Eastern Ridge",
          maxLength: 100,
          label: "Camera name",
        }),
      }) +
      ui.field({
        label: "Location",
        control: ui.textInput({
          value: form.location,
          act: "camera-field",
          key: "location",
          placeholder: "Sector 6: Grid 32.78N 74.95E",
          maxLength: 255,
          label: "Location",
        }),
      }) +
      "</div>" +
      '<div style="margin-bottom:1rem">' +
      ui.field({
        label: "Stream URL",
        hint: "RTSP or HTTP source, must be unique across the estate.",
        control: ui.textInput({
          value: form.rtspUrl,
          act: "camera-field",
          key: "rtspUrl",
          placeholder: "rtsp://10.4.1.110:554/live/east_ridge",
          label: "Stream URL",
        }),
      }) +
      "</div>" +
      '<div class="form-grid-3" style="margin-bottom:1rem">' +
      ui.field({
        label: "Feed type",
        control: ui.select({
          act: "camera-field",
          key: "feedType",
          value: form.feedType,
          className: "block",
          label: "Feed type",
          options: [
            { value: "optical", label: "Optical" },
            { value: "thermal", label: "Thermal" },
            { value: "ir", label: "Infrared" },
          ],
        }),
      }) +
      ui.field({
        label: "Resolution",
        control: ui.select({
          act: "camera-field",
          key: "resolution",
          value: form.resolution,
          className: "block",
          label: "Resolution",
          options: ["1280x720", "1920x1080", "2560x1440", "3840x2160"].map((r) => ({
            value: r,
            label: r,
          })),
        }),
      }) +
      ui.field({
        label: "Frame rate",
        control: ui.select({
          act: "camera-field",
          key: "fps",
          value: form.fps,
          className: "block",
          label: "Frame rate",
          options: ["15", "25", "30", "60"].map((f) => ({ value: f, label: f + " FPS" })),
        }),
      }) +
      "</div>" +
      '<div class="form-grid-2" style="margin-bottom:1rem">' +
      ui.field({
        label: "Assigned zone",
        control: ui.select({
          act: "camera-field",
          key: "zoneId",
          value: form.zoneId,
          className: "block",
          label: "Assigned zone",
          options: zoneOptions,
        }),
      }) +
      ui.field({
        label: "Playable stream link",
        hint: "Optional. Leave empty and the tile stays blank until a link is supplied.",
        control: ui.textInput({
          act: "camera-field",
          key: "streamUrl",
          value: form.streamUrl,
          label: "Playable stream link",
          placeholder: "https://host/stream.jpg",
        }),
      }) +
      "</div>" +
      (error ? '<p class="form-error" style="margin-bottom:1rem">' + esc(error) + "</p>" : "") +
      '<div class="form-foot">' +
      ui.button({ label: "Cancel", act: "close-add" }) +
      ui.button({ label: "Register camera", type: "submit", variant: "solid" }) +
      "</div></form>"
    );
  }

  window.components = { cameraTile, cameraSolo, sectorMap, addCameraForm, ZONE_DOT };
})();
