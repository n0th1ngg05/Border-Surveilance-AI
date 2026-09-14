/* Inline SVG icon set. Stroke icons only, sized by CSS. */
(function () {
  const wrap = (paths, fill) =>
    '<svg viewBox="0 0 24 24" fill="' +
    (fill || "none") +
    '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths +
    "</svg>";

  const ICONS = {
    grid: wrap('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    monitor: wrap('<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/><path d="M10 8l4 2.5-4 2.5z"/>'),
    cctv: wrap('<path d="M3 7l14-3 1.5 5L4.5 12z"/><path d="M6 12v3a3 3 0 0 0 3 3h9"/><path d="M18 15h3v5h-3z"/>'),
    bell: wrap('<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
    activity: wrap('<path d="M3 12h4l3 8 4-16 3 8h4"/>'),
    map: wrap('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    users: wrap('<path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 20v-2a4 4 0 0 0-3-3.8"/><path d="M16 3.2a3.5 3.5 0 0 1 0 6.8"/>'),
    truck: wrap('<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>'),
    server: wrap('<rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
    settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 15H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.4V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.4a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>'),
    chevronsLeft: wrap('<path d="M11 17 6 12l5-5M18 17l-5-5 5-5"/>'),
    chevronsRight: wrap('<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>'),
    chevronDown: wrap('<path d="m6 9 6 6 6-6"/>'),
    arrowUpRight: wrap('<path d="M7 17 17 7M8 7h9v9"/>'),
    arrowDownLeft: wrap('<path d="M17 7 7 17M16 17H7V8"/>'),
    arrowLeft: wrap('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    plus: wrap('<path d="M12 5v14M5 12h14"/>'),
    search: wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    x: wrap('<path d="M18 6 6 18M6 6l12 12"/>'),
    circle: wrap('<circle cx="12" cy="12" r="6"/>', "currentColor"),
    volume: wrap('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>'),
    volumeOff: wrap('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m17 9 4 6M21 9l-4 6"/>'),
    refresh: wrap('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
    maximize: wrap('<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>'),
    trash: wrap('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    shield: wrap('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v4M12 16h.01"/>'),
  };

  window.ICONS = ICONS;
  window.icon = function (name) {
    return ICONS[name] || "";
  };
})();
