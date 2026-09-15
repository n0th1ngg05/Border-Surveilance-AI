/*
 * live-grid.js
 *
 * The real camera grid: <video> elements playing the local MP4s (served at
 * /videos/N.mp4 by boot.ts) with a <canvas> overlay per tile drawing YOLO
 * bounding boxes from live Socket.IO detection events.
 *
 * WHY THIS FILE OWNS ITS OWN DOM NODE, NOT A CHILD OF #view:
 * The rest of this app re-renders its whole page via `view.innerHTML = ...`
 * on every store change (see app.js render()), and live detection events
 * are exactly the kind of thing that trigger those rerenders. If the actual
 * <video>/<canvas> elements lived inside #view, `innerHTML = ...` would
 * destroy and recreate them (restarting playback from frame 0) many times a
 * second. Instead, this module keeps ONE permanent host element appended
 * directly to <body>, completely outside #view's subtree, and "portals" it
 * on top of wherever the current page put its placeholder
 * (#live-grid-mount) by copying that placeholder's bounding box onto the
 * host every animation frame. The host is never touched by app.js's render
 * cycle, so video playback and canvas overlays are never interrupted.
 *
 * Public API (used by pages.js):
 *   window.liveGrid.mount(placeholderEl, opts)        -> shows grid over placeholder
 *   window.liveGrid.mountSolo(placeholderEl, cameraId) -> shows single tile over placeholder
 *   window.liveGrid.unmount()                          -> hides host, stops videos/sockets
 */
(function () {
  const BOX_TTL_MS = 900; // how long a bbox stays drawn after its detection event
  const BOX_COLOR = { human: "#f2c14e", vehicle: "#5ecbe0" };

  let hostEl = null; // permanent, lives in <body>, never destroyed by app.js
  let placeholderEl = null; // the page's throwaway #live-grid-mount div we track
  let tiles = new Map(); // cameraId -> { video, canvas, ctx, wrap, boxes: [] }
  let unsubDetection = null;
  let unsubConnection = null;
  let soloMode = false;
  let trackRaf = null;

  function ensureHost() {
    if (hostEl) return hostEl;
    hostEl = document.createElement("div");
    hostEl.id = "live-grid-host";
    hostEl.style.position = "fixed";
    hostEl.style.zIndex = "5";
    hostEl.style.pointerEvents = "none"; // re-enabled per-tile below
    hostEl.style.display = "none";
    document.body.appendChild(hostEl);
    return hostEl;
  }

  function trackPlaceholder() {
    if (!placeholderEl || !hostEl) return;
    if (!placeholderEl.isConnected) {
      // The page navigated away / rerendered without our placeholder —
      // caller is responsible for calling unmount() via page.onLeave, but
      // hide defensively so we never show a grid floating over a page that
      // no longer wants it.
      hostEl.style.display = "none";
      trackRaf = requestAnimationFrame(trackPlaceholder);
      return;
    }
    const rect = placeholderEl.getBoundingClientRect();
    hostEl.style.display = "block";
    hostEl.style.top = rect.top + "px";
    hostEl.style.left = rect.left + "px";
    hostEl.style.width = rect.width + "px";
    hostEl.style.height = rect.height + "px";
    trackRaf = requestAnimationFrame(trackPlaceholder);
  }

  // BUG FIX: hostEl lives permanently under <body>, outside #view — it is
  // NOT a DOM descendant of the page's #live-grid-mount placeholder, even
  // though trackPlaceholder() visually overlays it on top of that
  // placeholder via fixed positioning. A CSS selector like
  // ".live-grid-mount.overview-preview .wall.l2x2" can therefore never
  // match anything: the grid it targets is a sibling of the placeholder in
  // the real DOM tree, not a child. Fix: mirror the placeholder's non-base
  // modifier classes (e.g. "overview-preview") onto hostEl itself whenever
  // we (re)point at a new placeholder, so page-specific CSS can actually
  // reach the portalled grid via "#live-grid-host.overview-preview ...".
  // "live-grid-mount" is the shared base class every placeholder has and
  // is deliberately excluded so it doesn't collide with hostEl's own base
  // #live-grid-host styling.
  const HOST_BASE_CLASS = "live-grid-mount";
  function syncHostClass(el) {
    if (!hostEl) return;
    hostEl.className = "";
    if (!el) return;
    el.classList.forEach((cls) => {
      if (cls !== HOST_BASE_CLASS) hostEl.classList.add(cls);
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    })[c]);
  }

  function buildTile(camera, opts) {
    const o = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "panel cam-tile live-tile";
    wrap.dataset.cameraId = camera.id;
    wrap.style.pointerEvents = "auto"; // host disables pointer-events; re-enable per-tile

    const shot = document.createElement("div");
    shot.className =
      "cam-shot live-shot" +
      (camera.feedType === "thermal" ? " thermal" : "") +
      (camera.status === "warning" ? " warning" : "");

    const isRtsp = window.LIVE && window.LIVE.isRtspCamera && window.LIVE.isRtspCamera(camera.id);
    let video = null;
    let imgEl = null;

    if (isRtsp) {
      // IP camera — use <img> fed by the server-side MJPEG proxy.
      // The MJPEG stream is delivered as multipart/x-mixed-replace, which
      // all major browsers handle natively via a plain <img> src.
      imgEl = document.createElement("img");
      imgEl.src = window.LIVE.videoUrl(camera.id);
      imgEl.className = "live-video";               // same CSS as video
      imgEl.style.objectFit = "cover";
      imgEl.style.width = "100%";
      imgEl.style.height = "100%";
      imgEl.alt = camera.name + " live feed";

      // Overlay shown while connecting or if stream is unreachable
      const overlay = document.createElement("div");
      overlay.className = "rtsp-overlay";
      overlay.innerHTML =
        '<span class="num xsmall" style="opacity:0.6">⬤ CONNECTING TO IP CAM...</span>';
      overlay.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
        "background:#000;z-index:1;transition:opacity 0.3s;";

      imgEl.onload = () => { overlay.style.opacity = "0"; overlay.style.pointerEvents = "none"; };
      imgEl.onerror = () => {
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "auto";
        overlay.innerHTML =
          '<span class="num xsmall" style="opacity:0.55">⬤ IP CAM UNREACHABLE</span>';
        // Retry after 5 seconds
        setTimeout(() => {
          overlay.innerHTML = '<span class="num xsmall" style="opacity:0.6">⬤ CONNECTING TO IP CAM...</span>';
          imgEl.src = window.LIVE.videoUrl(camera.id) + "?t=" + Date.now();
        }, 5000);
      };

      shot.appendChild(overlay);
      shot.appendChild(imgEl);
    } else {
      video = document.createElement("video");
      video.src = window.LIVE.videoUrl(camera.id);
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.className = "live-video";
      shot.appendChild(video);
    }

    const canvas = document.createElement("canvas");
    canvas.className = "live-canvas";
    shot.appendChild(canvas);

    const badgeTl = document.createElement("span");
    badgeTl.className = "cam-badge tl";
    badgeTl.innerHTML =
      '<span class="dot bg-ok"></span><span class="num">' + esc(camera.id.toUpperCase()) + "</span>";
    shot.appendChild(badgeTl);

    const badgeTr = document.createElement("span");
    badgeTr.className = "cam-badge tr";
    if (isRtsp) {
      // Show a distinct "IP·RTSP" badge so it's clear this is a real IP camera
      badgeTr.innerHTML =
        '<span class="dot bg-accent live-dot"></span><span class="num">IP·RTSP</span>';
    } else {
      badgeTr.innerHTML = '<span class="dot bg-accent live-dot"></span><span class="num">LIVE</span>';
    }
    shot.appendChild(badgeTr);

    const caption = document.createElement("span");
    caption.className = "cam-caption";
    caption.innerHTML =
      '<span style="min-width:0"><span class="name truncate" style="display:block">' +
      esc(camera.name) +
      "</span>" +
      (o.compact
        ? ""
        : '<span class="loc truncate" style="display:block">' + esc(camera.location || "") + "</span>") +
      "</span>";
    shot.appendChild(caption);

    if (!o.solo) {
      shot.addEventListener("click", () => {
        if (typeof o.onOpen === "function") o.onOpen(camera.id);
      });
      shot.style.cursor = "pointer";
    }

    wrap.appendChild(shot);

    if (video) {
      video.play().catch(() => {
        /* Autoplay can be blocked before first user gesture — video.muted
           should satisfy the browser policy, but ignore failures quietly. */
      });
    }

    return { wrap, shot, video: video || imgEl, canvas, ctx: canvas.getContext("2d"), boxes: [], isRtsp };
  }

  function resizeCanvas(tile) {
    const rect = tile.shot.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, rect.width);
    const h = Math.max(2, rect.height);
    tile.canvas.width = Math.round(w * dpr);
    tile.canvas.height = Math.round(h * dpr);
    tile.canvas.style.width = w + "px";
    tile.canvas.style.height = h + "px";
    tile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tile.cssW = w;
    tile.cssH = h;
  }

  function drawTile(tile) {
    const ctx = tile.ctx;
    ctx.clearRect(0, 0, tile.cssW, tile.cssH);
    if (!tile.boxes.length) return;

    const now = performance.now();
    tile.boxes = tile.boxes.filter((b) => now - b.at < BOX_TTL_MS);

    // Track label chip rects already placed this frame so adjacent
    // detections (e.g. two people standing close together) don't draw
    // overlapping labels on top of each other — nudge a colliding label
    // down below the previous one instead.
    const placedLabels = [];

    tile.boxes.forEach((b) => {
      const age = (now - b.at) / BOX_TTL_MS;
      const alpha = Math.max(0, 1 - age);
      const color = BOX_COLOR[b.kind] || "#f2c14e";

      // Scale from the source frame's pixel space to this tile's CSS size.
      // Fall back to a native-video-size guess if the payload had no
      // frame_width/height (e.g. demo-ticker events with no real bbox).
      // For <img> MJPEG tiles, use naturalWidth/naturalHeight instead of videoWidth.
      const el = tile.video;
      const elW = el ? (el.videoWidth || el.naturalWidth || 0) : 0;
      const elH = el ? (el.videoHeight || el.naturalHeight || 0) : 0;
      const srcW = b.frameWidth || elW || tile.cssW;
      const srcH = b.frameHeight || elH || tile.cssH;
      const sx = tile.cssW / srcW;
      const sy = tile.cssH / srcH;

      const [x1, y1, x2, y2] = b.bbox;
      const rx = x1 * sx;
      const ry = y1 * sy;
      const rw = (x2 - x1) * sx;
      const rh = (y2 - y1) * sy;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      const label = (b.label || b.kind) + (b.confidence ? " " + Math.round(b.confidence * 100) + "%" : "");
      ctx.font = "700 11px 'Archivo', sans-serif";
      const textW = ctx.measureText(label).width;
      const labelH = 16;
      const labelW = textW + 8;

      // BUG FIX: label was drawn at `ry - 16` with only Math.max(0, ...)
      // guarding the canvas's own top edge — that stops it going negative
      // in canvas space, but does nothing about the CAM-ID/LIVE badge row,
      // which is a separate pair of absolutely-positioned <span> siblings
      // inside .live-shot (top: 0.5rem, ~0.7rem font + 0.25rem padding ≈
      // 27px tall total from the tile's top edge — see .cam-badge in
      // styles.css). A detection near the top of frame (very common —
      // e.g. a person standing near the top of the shot) drew its label
      // chip right into that badge row, and two adjacent detections'
      // labels could overlap each other too. That's what looked like a
      // "NEW"/"Click" artifact in screenshots — it was always real YOLO
      // label text, just collided/clipped at the top.
      // Fix: reserve a top margin that clears the badge row (30px, with a
      // small buffer over the ~27px the badges actually occupy), flip the
      // label to sit just *inside* the box (below its top edge) instead
      // of above it whenever there isn't room above, and nudge it further
      // down if it would overlap a label already placed this frame.
      const topMargin = 30; // clears the ~27px-tall badge row + buffer
      const labelAboveY = ry - labelH - 2;
      let labelY = labelAboveY >= topMargin ? labelAboveY : ry + 2;

      let collided = true;
      let guard = 0;
      while (collided && guard < 20) {
        collided = placedLabels.some(
          (p) => rx < p.x + p.w && rx + labelW > p.x && labelY < p.y + p.h && labelY + labelH > p.y,
        );
        if (collided) {
          labelY += labelH + 2;
          guard++;
        }
      }
      placedLabels.push({ x: rx, y: labelY, w: labelW, h: labelH });

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.88;
      ctx.fillRect(rx, labelY, labelW, labelH);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#0b0d10";
      ctx.fillText(label, rx + 4, labelY + labelH - 5);
    });

    ctx.globalAlpha = 1;
  }

  function tick() {
    tiles.forEach((tile) => {
      if (!tile.wrap.isConnected) return;
      drawTile(tile);
    });
    rafHandle = requestAnimationFrame(tick);
  }

  let rafHandle = null;

  function applyDetection(evt) {
    const tile = tiles.get(evt.cameraId);
    if (!tile || !evt.detections.length) return;
    const now = performance.now();
    evt.detections.forEach((d) => {
      tile.boxes.push({
        at: now,
        bbox: d.bbox,
        label: d.label,
        confidence: d.confidence,
        kind: evt.kind,
        frameWidth: evt.frameWidth,
        frameHeight: evt.frameHeight,
      });
    });
  }

  function setConnDot(connected) {
    document.querySelectorAll(".live-tile .cam-badge.tr .dot").forEach((dot) => {
      dot.classList.toggle("bg-accent", connected);
      dot.classList.toggle("bg-warn", !connected);
    });
  }

  let currentKey = null; // "wall:3x2" | "solo:cam-01" | null — what's actually built right now

  function clearTiles() {
    tiles.forEach((tile) => {
      if (tile.isRtsp) {
        // RTSP tiles use <img> — just clear src to stop the MJPEG request
        if (tile.video) tile.video.src = "";
      } else {
        // Video tiles: stop playback fully
        if (tile.video) {
          tile.video.pause();
          tile.video.removeAttribute("src");
          tile.video.load();
        }
      }
    });
    tiles.clear();
    if (hostEl) hostEl.innerHTML = "";
  }

  function stopStreams() {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    if (trackRaf) cancelAnimationFrame(trackRaf);
    rafHandle = null;
    trackRaf = null;
    if (unsubDetection) unsubDetection();
    if (unsubConnection) unsubConnection();
    unsubDetection = null;
    unsubConnection = null;
  }

  /** Fully stop everything — call when navigating away from the Monitor page. */
  function teardown() {
    stopStreams();
    clearTiles();
    currentKey = null;
    placeholderEl = null;
    if (hostEl) {
      hostEl.style.display = "none";
      hostEl.className = ""; // drop any page-specific class synced via syncHostClass()
    }
    window.removeEventListener("resize", onResize);
  }

  function onResize() {
    tiles.forEach(resizeCanvas);
  }

  async function buildWall(cameras, opts) {
    const o = opts || {};
    clearTiles();
    const grid = document.createElement("div");
    grid.className = "wall live-wall l" + (o.layout || "3x2");
    hostEl.appendChild(grid);

    cameras.forEach((camera) => {
      const tile = buildTile(camera, { onOpen: o.onOpen, compact: o.compact });
      grid.appendChild(tile.wrap);
      tiles.set(camera.id, tile);
    });

    requestAnimationFrame(() => tiles.forEach(resizeCanvas));
  }

  async function buildSolo(camera) {
    clearTiles();
    const tile = buildTile(camera, { solo: true });
    tile.shot.classList.add("cam-solo-shot");
    tile.wrap.style.height = "100%";
    hostEl.appendChild(tile.wrap);
    tiles.set(camera.id, tile);

    requestAnimationFrame(() => tiles.forEach(resizeCanvas));
  }

  function startLiveStreams() {
    if (unsubDetection) return; // already running
    window.addEventListener("resize", onResize);
    unsubDetection = window.LIVE.onDetection(applyDetection);
    unsubConnection = window.LIVE.onConnectionChange(setConnDot);
    if (!rafHandle) rafHandle = requestAnimationFrame(tick);
  }

  /**
   * Show the wall grid, positioned over `el` (the page's #live-grid-mount
   * placeholder). Idempotent for the same layout — calling this again with
   * an unchanged layout only re-tracks the placeholder's position, it does
   * NOT rebuild tiles or restart video.
   */
  async function mount(el, opts) {
    const o = opts || {};
    const key = "wall:" + (o.layout || "3x2");
    ensureHost();
    placeholderEl = el;
    syncHostClass(el);
    if (!trackRaf) trackRaf = requestAnimationFrame(trackPlaceholder);

    if (currentKey === key) return; // same wall already built — just keep tracking position
    currentKey = key;
    soloMode = false;

    let cameras;
    try {
      cameras = await window.LIVE.getCameras();
    } catch (err) {
      hostEl.innerHTML =
        '<div class="panel" style="padding:3rem 1.5rem;text-align:center"><p class="small">Could not reach the surveillance backend.</p><p class="xsmall muted" style="margin-top:0.5rem">' +
        esc(err.message) +
        "</p></div>";
      return;
    }
    if (currentKey !== key) return; // mount target changed while awaiting

    if (!cameras.length) {
      hostEl.innerHTML =
        '<div class="panel" style="padding:3rem 1.5rem;text-align:center"><p class="small">No cameras registered.</p></div>';
      return;
    }

    await buildWall(cameras, o);
    startLiveStreams();
  }

  /** Same idempotency behavior as mount(), keyed by camera id. */
  async function mountSolo(el, cameraId) {
    const key = "solo:" + cameraId;
    ensureHost();
    placeholderEl = el;
    syncHostClass(el);
    if (!trackRaf) trackRaf = requestAnimationFrame(trackPlaceholder);

    if (currentKey === key) return;
    currentKey = key;
    soloMode = true;

    let cameras;
    try {
      cameras = await window.LIVE.getCameras();
    } catch (err) {
      hostEl.innerHTML = '<p class="small" style="padding:2rem">Could not reach backend.</p>';
      return;
    }
    if (currentKey !== key) return;

    const camera = cameras.find((c) => c.id === cameraId) || cameras[0];
    if (!camera) return;

    await buildSolo(camera);
    startLiveStreams();
  }

  window.liveGrid = {
    mount: mount,
    mountSolo: mountSolo,
    unmount: teardown,
  };
})();