/* Shared UI helpers: escaping, formatting, and HTML builders. */
(function () {
  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function attrs(map) {
    return Object.keys(map)
      .filter((k) => map[k] !== undefined && map[k] !== null && map[k] !== false)
      .map((k) => k + '="' + esc(map[k]) + '"')
      .join(" ");
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d + "d " + String(h).padStart(2, "0") + "h " + String(m).padStart(2, "0") + "m";
  }

  const levelColor = {
    CRITICAL: "text-accent",
    HIGH: "text-accent",
    MEDIUM: "text-warn",
    LOW: "text-info",
    INFO: "muted",
  };

  const levelDot = {
    CRITICAL: "bg-accent",
    HIGH: "bg-accent",
    MEDIUM: "bg-warn",
    LOW: "bg-info",
    INFO: "bg-idle",
  };

  const statusDot = { active: "bg-ok", warning: "bg-warn", offline: "bg-idle" };
  const serviceDot = { operational: "bg-ok", degraded: "bg-warn", down: "bg-accent" };
  const serviceLabel = { operational: "OPERATIONAL", degraded: "DEGRADED", down: "DOWN" };

  /* ---------- builders ---------- */

  function panel(options) {
    const o = options || {};
    const head =
      o.title || o.action
        ? '<header class="panel-head">' +
          (o.title ? '<h2 class="label-xs strong">' + esc(o.title) + "</h2>" : "<span></span>") +
          (o.action || "") +
          "</header>"
        : "";
    return (
      '<section class="' +
      (o.solid ? "panel-solid" : "panel") +
      (o.className ? " " + o.className : "") +
      '">' +
      head +
      '<div class="panel-body' +
      (o.flush ? " flush" : "") +
      (o.bodyClass ? " " + o.bodyClass : "") +
      '">' +
      (o.body || "") +
      "</div></section>"
    );
  }

  function metric(o) {
    return (
      '<div class="panel metric' +
      (o.className ? " " + o.className : "") +
      '">' +
      '<div class="between" style="align-items:flex-start">' +
      '<div class="label-xs">' +
      esc(o.label) +
      "</div>" +
      (o.headAction || "") +
      "</div>" +
      '<div class="metric-foot">' +
      '<div style="display:flex;align-items:baseline;gap:0.35rem">' +
      '<span class="metric-value ' +
      (o.tone || "") +
      '">' +
      (o.valueHtml || esc(o.value)) +
      "</span>" +
      (o.unit ? '<span class="small muted">' + esc(o.unit) + "</span>" : "") +
      "</div>" +
      (o.chart ? '<div class="metric-spark">' + o.chart + "</div>" : "") +
      "</div>" +
      (o.extra || "") +
      (o.note ? '<div class="metric-note">' + esc(o.note) + "</div>" : "") +
      "</div>"
    );
  }

  function button(o) {
    const classes = ["btn"];
    if (o.variant) classes.push(o.variant);
    if (o.active) classes.push("active");
    if (o.tiny) classes.push("tiny");
    if (o.block) classes.push("block");
    if (o.className) classes.push(o.className);
    return (
      "<button " +
      attrs({
        type: o.type || "button",
        class: classes.join(" "),
        "data-act": o.act,
        "data-id": o.id,
        "data-value": o.value,
        "data-tip": o.tip || o.label,
        disabled: o.disabled ? "disabled" : false,
        "aria-label": o.ariaLabel,
        "aria-expanded": o.ariaExpanded,
      }) +
      ">" +
      (o.icon ? window.icon(o.icon) : "") +
      "<span>" +
      esc(o.label) +
      "</span></button>"
    );
  }

  function iconButton(o) {
    return (
      "<button " +
      attrs({
        type: "button",
        class: "icon-btn" + (o.className ? " " + o.className : ""),
        "data-act": o.act,
        "data-id": o.id,
        "data-value": o.value,
        "data-tip": o.label,
        "aria-label": o.label,
        "aria-expanded": o.ariaExpanded,
        disabled: o.disabled ? "disabled" : false,
      }) +
      ">" +
      window.icon(o.icon) +
      "</button>"
    );
  }

  function select(o) {
    const options = o.options
      .map(
        (opt) =>
          '<option value="' +
          esc(opt.value) +
          '"' +
          (String(opt.value) === String(o.value) ? " selected" : "") +
          ">" +
          esc(opt.label) +
          "</option>",
      )
      .join("");
    return (
      '<span class="select ' +
      (o.className || "") +
      '">' +
      "<select " +
      attrs({
        "data-act": o.act,
        "data-k": o.key || o.act,
        "aria-label": o.ariaLabel || o.label,
      }) +
      ">" +
      options +
      "</select>" +
      window.icon("chevronDown") +
      "</span>"
    );
  }

  function textInput(o) {
    return (
      "<input " +
      attrs({
        class: "input" + (o.className ? " " + o.className : ""),
        type: o.type || "text",
        value: o.value,
        placeholder: o.placeholder,
        maxlength: o.maxLength,
        "data-act": o.act,
        "data-k": o.key || o.act,
        "aria-label": o.ariaLabel || o.label,
      }) +
      " />"
    );
  }

  function searchInput(o) {
    return '<div class="search-wrap">' + window.icon("search") + textInput(o) + "</div>";
  }

  function field(o) {
    return (
      '<label class="field"><span class="label-xs">' +
      esc(o.label) +
      '</span><div class="field-control">' +
      o.control +
      "</div>" +
      (o.hint ? '<span class="hint">' + esc(o.hint) + "</span>" : "") +
      "</label>"
    );
  }

  function segmented(o) {
    return (
      '<div class="segmented" role="group" aria-label="' +
      esc(o.ariaLabel) +
      '">' +
      o.options
        .map(
          (opt) =>
            '<button type="button" data-act="' +
            esc(o.act) +
            '" data-value="' +
            esc(opt.value) +
            '" data-tip="' +
            esc(opt.label) +
            '" aria-pressed="' +
            (String(opt.value) === String(o.value)) +
            '">' +
            esc(opt.label) +
            "</button>",
        )
        .join("") +
      "</div>"
    );
  }

  function dot(toneClass, extraStyle) {
    return (
      '<span class="dot ' + (toneClass || "") + '"' + (extraStyle ? ' style="' + extraStyle + '"' : "") + "></span>"
    );
  }

  function clock() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour12: false });
    const date = now
      .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
    return (
      '<div class="clock"><div class="clock-time" data-clock-time>' +
      esc(time) +
      '</div><div class="label-xs clock-date" data-clock-date>' +
      esc(date) +
      " / UTC+05:30</div></div>"
    );
  }

  function page(o) {
    return (
      '<div class="page">' +
      '<div class="page-head"><div>' +
      '<h1 class="page-title">' +
      esc(o.title) +
      "</h1>" +
      (o.subtitle ? '<p class="page-sub">' + esc(o.subtitle) + "</p>" : "") +
      (o.actions ? '<div class="page-actions">' + o.actions + "</div>" : "") +
      "</div>" +
      clock() +
      "</div>" +
      o.body +
      "</div>"
    );
  }

  function modal(o) {
    return (
      '<div class="modal-backdrop" data-act="' +
      esc(o.closeAct) +
      '">' +
      '<div class="modal panel-solid" role="dialog" aria-modal="true" aria-label="' +
      esc(o.title) +
      '" style="max-width:' +
      (o.width || "34rem") +
      '" data-stop>' +
      '<header class="modal-head"><h2 class="label-xs strong">' +
      esc(o.title) +
      "</h2>" +
      iconButton({ icon: "x", label: "Close", act: o.closeAct, className: "" }) +
      "</header>" +
      '<div class="modal-body">' +
      o.body +
      "</div></div></div>"
    );
  }

  function avatar(name, size) {
    const initials = name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      '<span class="avatar" style="width:' +
      size +
      "px;height:" +
      size +
      'px" aria-hidden="true">' +
      esc(initials) +
      "</span>"
    );
  }

  window.ui = {
    esc,
    attrs,
    formatUptime,
    levelColor,
    levelDot,
    statusDot,
    serviceDot,
    serviceLabel,
    panel,
    metric,
    button,
    iconButton,
    select,
    textInput,
    searchInput,
    field,
    segmented,
    dot,
    clock,
    page,
    modal,
    avatar,
  };
})();
