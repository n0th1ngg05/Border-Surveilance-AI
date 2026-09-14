/*
 * Shell: hash router, event delegation, hover tooltips, notifications, clock.
 */
(function () {
  const ui = window.ui;
  const esc = ui.esc;
  const store = window.store;

  const NAV = [
    { to: "/", label: "Overview", icon: "grid" },
    { to: "/monitor", label: "Live Wall", icon: "monitor" },
    { to: "/cameras", label: "Cameras", icon: "cctv" },
    { to: "/alerts", label: "Alerts", icon: "bell" },
    { to: "/events", label: "Events", icon: "activity" },
    { to: "/zones", label: "Sector Map", icon: "map" },
    { to: "/personnel", label: "Personnel", icon: "users" },
    { to: "/vehicles", label: "Vehicles", icon: "truck" },
    { to: "/analytics", label: "Analytics", icon: "activity" },
    { to: "/system", label: "System", icon: "server" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ];

  const view = document.getElementById("view");
  const sidebar = document.getElementById("sidebar");
  const navList = document.getElementById("sidebar-nav");
  const tooltip = document.getElementById("tooltip");
  const pinToggle = document.getElementById("pin-toggle");

  let pinned = false;
  let currentPath = "/";
  let currentParams = {};

  /* ---------- routing ---------- */

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    return raw.startsWith("/") ? raw : "/" + raw;
  }

  function matchRoute(path) {
    if (path.indexOf("/cameras/") === 0) {
      return { page: window.PAGES.cameraDetail, params: { cameraId: path.slice("/cameras/".length) } };
    }
    const map = {
      "/": window.PAGES.overview,
      "/monitor": window.PAGES.monitor,
      "/cameras": window.PAGES.cameras,
      "/alerts": window.PAGES.alerts,
      "/events": window.PAGES.events,
      "/zones": window.PAGES.zones,
      "/personnel": window.PAGES.personnel,
      "/vehicles": window.PAGES.vehicles,
      "/analytics": window.PAGES.analytics,
      "/system": window.PAGES.system,
      "/settings": window.PAGES.settings,
    };
    return { page: map[path] || window.PAGES.notFound, params: {} };
  }

  function navigate(path) {
    location.hash = "#" + path;
  }

  /* ---------- rendering ---------- */

  let frame = null;

  function scheduleRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  }

  function captureFocus() {
    const el = document.activeElement;
    if (!el || !view.contains(el)) return null;
    const key = el.getAttribute("data-k");
    if (!key) return null;
    return {
      key: key,
      start: el.selectionStart === undefined ? null : el.selectionStart,
      end: el.selectionEnd === undefined ? null : el.selectionEnd,
    };
  }

  function restoreFocus(snapshot) {
    if (!snapshot) return;
    const el = view.querySelector('[data-k="' + snapshot.key + '"]');
    if (!el) return;
    el.focus();
    if (snapshot.start !== null && el.setSelectionRange && el.type !== "email") {
      try {
        el.setSelectionRange(snapshot.start, snapshot.end);
      } catch (err) {
        /* not a text field */
      }
    }
  }

  let lastRenderedPage = null;

  function render() {
    const match = matchRoute(currentPath);
    const state = store.getState();
    const snapshot = captureFocus();
    view.innerHTML = match.page.render(state, match.page.local, currentParams);
    document.title = match.page.title(state, match.page.local, currentParams);
    restoreFocus(snapshot);
    renderNav(state);
    scheduleNotificationRotation(state);
    refreshHover();

    // Give the page a chance to wire up persistent widgets (e.g. the live
    // video grid) that must survive future rerenders untouched. Pages that
    // don't need this simply don't define afterRender.
    if (lastRenderedPage && lastRenderedPage !== match.page && lastRenderedPage.onLeave) {
      lastRenderedPage.onLeave();
    }
    if (match.page.afterRender) {
      match.page.afterRender(view, state, match.page.local, currentParams);
    }
    lastRenderedPage = match.page;
  }

  function renderNav(state) {
    const openAlerts = state.alerts.filter((a) => a.status === "open").length;
    navList.innerHTML = NAV.map((item) => {
      const active =
        item.to === "/"
          ? currentPath === "/"
          : currentPath === item.to || currentPath.indexOf(item.to + "/") === 0;
      return (
        '<li><a href="#' +
        item.to +
        '" class="' +
        (active ? "active" : "") +
        '" data-tip="' +
        esc(item.label) +
        '">' +
        window.icon(item.icon) +
        '<span class="sidebar-label">' +
        esc(item.label) +
        "</span>" +
        (item.to === "/alerts" && openAlerts > 0
          ? '<span class="nav-badge">' + openAlerts + "</span>"
          : "") +
        "</a></li>"
      );
    }).join("");

    const dot = document.getElementById("conn-dot");
    const label = document.getElementById("conn-label");
    dot.className = "dot live-dot " + (state.connection === "connected" ? "bg-ok" : "bg-accent");
    label.textContent = state.connection === "connected" ? "Realtime live" : "Realtime down";
  }

  pinToggle.innerHTML = window.icon("chevronsRight");
  pinToggle.setAttribute("data-tip", "Pin expanded navigation");
  pinToggle.addEventListener("click", () => {
    pinned = !pinned;
    sidebar.classList.toggle("pinned", pinned);
    pinToggle.innerHTML = window.icon(pinned ? "chevronsLeft" : "chevronsRight");
    const label = pinned ? "Unpin expanded navigation" : "Pin expanded navigation";
    pinToggle.setAttribute("aria-label", label);
    pinToggle.setAttribute("data-tip", label);
    pinToggle.setAttribute("aria-pressed", String(pinned));
    hideTooltip();
  });

  /* ---------- notifications: single inline queue, 7 second window ---------- */

  const notificationTimers = {};
  let rotationTimer = null;
  let rotatingId = null;

  function activeNotification(state) {
    const urgent = state.notifications.filter(
      (n) => n.level === "CRITICAL" || n.level === "HIGH",
    )[0];
    return urgent || state.notifications[state.notifications.length - 1] || null;
  }

  window.activeNotification = activeNotification;

  function scheduleNotificationRotation(state) {
    const current = activeNotification(state);
    if (!current) {
      if (rotationTimer) clearTimeout(rotationTimer);
      rotationTimer = null;
      rotatingId = null;
      return;
    }
    if (rotatingId === current.id && rotationTimer) return;
    if (rotationTimer) clearTimeout(rotationTimer);
    rotatingId = current.id;
    rotationTimer = setTimeout(() => {
      rotationTimer = null;
      rotatingId = null;
      store.actions.dismissNotification(current.id);
    }, 7000);
  }

  /* ---------- tooltips after 3 seconds of hover ---------- */

  let tipTimer = null;
  let tipTarget = null;
  let tipCurrentLabel = "";
  let pointer = { x: -1, y: -1 };

  function tipLabel(el) {
    return (
      el.getAttribute("data-tip") ||
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim()
    );
  }

  function showTooltip(el) {
    const label = tipLabel(el);
    if (!label) return;
    tooltip.textContent = label;
    tooltip.hidden = false;
    const rect = el.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function hideTooltip() {
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = null;
    tipTarget = null;
    tipCurrentLabel = "";
    tooltip.hidden = true;
  }

  function armTooltip(el) {
    if (!el || el === tipTarget) return;
    hideTooltip();
    if (el.disabled) return;
    tipTarget = el;
    tipCurrentLabel = tipLabel(el);
    tipTimer = setTimeout(() => showTooltip(el), 3000);
  }

  /* Re-attach the hover tooltip after a re-render swaps the element out. */
  function refreshHover() {
    if (pointer.x < 0) return;
    const under = document.elementFromPoint(pointer.x, pointer.y);
    const el = under && under.closest ? under.closest("button, a[data-tip], [data-tip]") : null;
    if (!el) {
      if (tipTarget) hideTooltip();
      return;
    }
    if (el === tipTarget) return;
    if (tipLabel(el) === tipCurrentLabel && tipCurrentLabel) {
      tipTarget = el;
      if (!tooltip.hidden) showTooltip(el);
      return;
    }
    armTooltip(el);
  }

  document.addEventListener("mousemove", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
  });

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("button, a[data-tip], [data-tip]");
    if (!el) {
      hideTooltip();
      return;
    }
    armTooltip(el);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("button, a[data-tip], [data-tip]");
    if (!el || el !== tipTarget) return;
    const to = e.relatedTarget;
    if (to && el.contains(to)) return;
    hideTooltip();
  });


  document.addEventListener("focusin", (e) => {
    const el = e.target.closest("button, a[data-tip], [data-tip]");
    if (el) armTooltip(el);
  });

  document.addEventListener("focusout", hideTooltip);
  window.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("resize", hideTooltip);

  /* ---------- event delegation ---------- */

  function context(page) {
    return {
      local: page.local,
      rerender: scheduleRender,
      navigate: navigate,
      params: currentParams,
    };
  }

  function dispatch(type, el, event) {
    const act = el.getAttribute("data-act");
    if (!act) return;
    const match = matchRoute(currentPath);
    const page = match.page;
    const handler = (page.handlers && page.handlers[act]) || GLOBAL_HANDLERS[act];
    if (!handler) return;
    handler(el, event, context(page));
  }

  const GLOBAL_HANDLERS = {
    "dismiss-note": (el) => {
      const id = el.getAttribute("data-id");
      if (notificationTimers[id]) {
        clearTimeout(notificationTimers[id]);
        delete notificationTimers[id];
      }
      if (rotatingId === id && rotationTimer) {
        clearTimeout(rotationTimer);
        rotationTimer = null;
        rotatingId = null;
      }
      store.actions.dismissNotification(id);
    },
    "remove-alert": (el) => store.actions.removeAlert(el.getAttribute("data-id")),
    "toggle-recording": (el) => store.actions.toggleRecording(el.getAttribute("data-id")),
    "toggle-mute": (el) => store.actions.toggleMute(el.getAttribute("data-id")),
    "refresh-camera": (el) => store.actions.refreshCamera(el.getAttribute("data-id")),
    "open-camera": (el) => navigate("/cameras/" + el.getAttribute("data-id")),
    "trigger-breach": () => store.actions.triggerBreach(),
    "acknowledge-alert": (el) => store.actions.acknowledgeAlert(el.getAttribute("data-id")),
    "resolve-alert": (el) => store.actions.resolveAlert(el.getAttribute("data-id")),
    "set-layout": (el) => store.actions.setLayout(el.getAttribute("data-value")),
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.classList.contains("modal-backdrop") && e.target.closest("[data-stop]")) return;
    if (el.tagName === "FORM") return;
    hideTooltip();
    dispatch("click", el, e);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest('g[data-act], [role="button"][data-act]');
    if (!el) return;
    e.preventDefault();
    dispatch("click", el, e);
  });

  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    dispatch("input", el, e);
  });

  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName !== "SELECT") return;
    dispatch("change", el, e);
  });

  document.addEventListener("submit", (e) => {
    const el = e.target.closest("form[data-act]");
    if (!el) return;
    e.preventDefault();
    dispatch("submit", el, e);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const match = matchRoute(currentPath);
    if (match.page.handlers && match.page.handlers["escape"]) {
      match.page.handlers["escape"](null, e, context(match.page));
    }
  });

  /* ---------- clock and boot ---------- */

  setInterval(() => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const date = new Date()
      .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
    document.querySelectorAll("[data-clock-time]").forEach((el) => {
      el.textContent = time;
    });
    document.querySelectorAll("[data-clock-date]").forEach((el) => {
      el.textContent = date + " / UTC+05:30";
    });
    document.querySelectorAll("[data-stamp]").forEach((el) => {
      el.textContent = time;
    });
  }, 1000);

  window.addEventListener("hashchange", () => {
    const next = parseHash();
    const match = matchRoute(next);
    currentPath = next;
    currentParams = match.params;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    hideTooltip();
    window.scrollTo(0, 0);
    render();
  });

  store.subscribe(scheduleRender);
  // Exposed so non-store-driven code (e.g. live-grid.js clicking a tile to
  // go solo) can request a rerender without needing its own store action.
  window._requestRerender = scheduleRender;

  currentPath = parseHash();
  currentParams = matchRoute(currentPath).params;
  render();
  store.startSimulation();
})();
