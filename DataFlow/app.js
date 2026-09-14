/**
 * V.I.E.W Architecture Visualization — Application Controller
 *
 * Renders interactive flowchart topology from VIEW_DATA.
 * Features: tab switching, SVG connections with animated flow,
 * node click → detail panel, node hover → highlight connections.
 */

(function () {
  'use strict';

  /* ── State ── */
  let activeTab = 'topology';
  let selectedNode = null;

  /* ── DOM References ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const tabBar      = $('#tab-bar');
  const canvasInner = $('#canvas-inner');
  const detailPanel = $('#detail-panel');
  const detailBody  = $('#detail-body');

  /* ═══════════════════════════════════
   *  INITIALIZATION
   * ═══════════════════════════════════ */
  function init() {
    renderTabs();
    switchTab('topology');
    startClock();
  }

  /* ── Clock ── */
  function startClock() {
    const el = $('#header-clock');
    if (!el) return;
    const tick = () => {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ═══════════════════════════════════
   *  TABS
   * ═══════════════════════════════════ */
  function renderTabs() {
    tabBar.innerHTML = '';
    VIEW_DATA.tabs.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (tab.id === activeTab ? ' active' : '');
      btn.dataset.tab = tab.id;
      btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span>${tab.label}</span>`;
      btn.addEventListener('click', () => switchTab(tab.id));
      tabBar.appendChild(btn);
    });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    selectedNode = null;

    // Update tab buttons
    $$('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Render canvas
    renderCanvas();
    renderDetailEmpty();
  }

  /* ═══════════════════════════════════
   *  CANVAS RENDERING
   * ═══════════════════════════════════ */
  function renderCanvas() {
    const nodes       = VIEW_DATA.nodes[activeTab] || [];
    const connections  = VIEW_DATA.connections[activeTab] || [];
    const groups       = VIEW_DATA.groups[activeTab] || [];

    canvasInner.innerHTML = '';

    // Calculate canvas size
    let maxX = 1100, maxY = 700;
    nodes.forEach((n) => {
      maxX = Math.max(maxX, n.x + 240);
      maxY = Math.max(maxY, n.y + 120);
    });
    groups.forEach((g) => {
      maxX = Math.max(maxX, g.x + g.w + 40);
      maxY = Math.max(maxY, g.y + g.h + 40);
    });
    canvasInner.style.minWidth  = maxX + 'px';
    canvasInner.style.minHeight = maxY + 'px';

    // 1. Render groups
    groups.forEach((g) => renderGroup(g));

    // 2. Render SVG connections
    renderConnections(nodes, connections);

    // 3. Render nodes
    nodes.forEach((n, i) => renderNode(n, i));

    // 4. Render legend
    renderLegend();
  }

  /* ── Group Regions ── */
  function renderGroup(g) {
    const div = document.createElement('div');
    div.className = 'group-region';
    div.style.cssText = `
      left: ${g.x}px; top: ${g.y}px;
      width: ${g.w}px; height: ${g.h}px;
      border-color: ${g.color}30;
      background: ${g.color}06;
    `;
    div.innerHTML = `<span class="group-label" style="color:${g.color}; border: 1px solid ${g.color}30;">${g.label}</span>`;
    canvasInner.appendChild(div);
  }

  /* ── Nodes ── */
  function renderNode(n, index) {
    const div = document.createElement('div');
    div.className = 'node fade-in';
    div.dataset.id = n.id;
    div.style.cssText = `
      left: ${n.x}px; top: ${n.y}px;
      animation-delay: ${index * 0.04}s;
    `;
    div.innerHTML = `
      <div class="node-status ${n.status || 'active'}"></div>
      <div class="node-icon">${n.icon}</div>
      <div class="node-text">
        <div class="node-label">${n.label}</div>
        <div class="node-subtitle">${n.subtitle}</div>
      </div>
    `;

    // Click → show detail
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectNode(n, div);
    });

    // Hover → highlight connections
    div.addEventListener('mouseenter', () => highlightConnections(n.id, true));
    div.addEventListener('mouseleave', () => highlightConnections(n.id, false));

    canvasInner.appendChild(div);
  }

  /* ── SVG Connections ── */
  function renderConnections(nodes, connections) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('connections-svg');
    svg.setAttribute('id', 'connections-svg');

    // Build a node position map (center points)
    const nodeMap = {};
    nodes.forEach((n) => {
      nodeMap[n.id] = {
        cx: n.x + 100,  // center x (node-w / 2)
        cy: n.y + 36,   // center y (node-h / 2)
        x:  n.x,
        y:  n.y,
        w:  200,
        h:  72,
      };
    });

    // Defs for animated dots
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    connections.forEach((conn, i) => {
      const fromN = nodeMap[conn.from];
      const toN   = nodeMap[conn.to];
      if (!fromN || !toN) return;

      const proto  = VIEW_DATA.protocols[conn.protocol] || VIEW_DATA.protocols.internal;

      // Calculate connection points (best ports)
      const { x1, y1, x2, y2 } = getBestPorts(fromN, toN);

      // Build bezier path
      const path = buildBezierPath(x1, y1, x2, y2);

      // SVG group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.from = conn.from;
      g.dataset.to = conn.to;

      // Path element
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', path);
      pathEl.setAttribute('class', 'conn-line');
      pathEl.setAttribute('stroke', proto.color);
      if (proto.dash) {
        pathEl.setAttribute('stroke-dasharray', '6 4');
        pathEl.style.animation = 'flowDash 1s linear infinite';
      }
      g.appendChild(pathEl);

      // Animated flow dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'flow-dot');
      circle.setAttribute('fill', proto.color);
      circle.setAttribute('r', '3');

      const animMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      animMotion.setAttribute('dur', (2 + Math.random() * 2).toFixed(1) + 's');
      animMotion.setAttribute('repeatCount', 'indefinite');
      animMotion.setAttribute('path', path);
      circle.appendChild(animMotion);
      g.appendChild(circle);

      // Label
      if (conn.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 8;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mx);
        text.setAttribute('y', my);
        text.setAttribute('class', 'conn-label');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = conn.label;
        g.appendChild(text);
      }

      svg.appendChild(g);
    });

    // Arrow marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
    arrowPath.setAttribute('fill', 'var(--text-muted)');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    canvasInner.appendChild(svg);
  }

  /* Calculate the best edge ports for connection */
  function getBestPorts(fromN, toN) {
    const ports = [];

    // From each edge of 'from' to best edge of 'to'
    const fromEdges = [
      { x: fromN.cx,          y: fromN.y,                dir: 'top' },
      { x: fromN.cx,          y: fromN.y + fromN.h,      dir: 'bottom' },
      { x: fromN.x,           y: fromN.cy,               dir: 'left' },
      { x: fromN.x + fromN.w, y: fromN.cy,               dir: 'right' },
    ];
    const toEdges = [
      { x: toN.cx,            y: toN.y,                  dir: 'top' },
      { x: toN.cx,            y: toN.y + toN.h,          dir: 'bottom' },
      { x: toN.x,             y: toN.cy,                 dir: 'left' },
      { x: toN.x + toN.w,     y: toN.cy,                 dir: 'right' },
    ];

    let bestDist = Infinity;
    let best = null;

    fromEdges.forEach((fe) => {
      toEdges.forEach((te) => {
        const d = Math.hypot(fe.x - te.x, fe.y - te.y);
        if (d < bestDist) {
          bestDist = d;
          best = { x1: fe.x, y1: fe.y, x2: te.x, y2: te.y, fromDir: fe.dir, toDir: te.dir };
        }
      });
    });

    return best || { x1: fromN.cx, y1: fromN.cy, x2: toN.cx, y2: toN.cy };
  }

  /* Build a cubic bezier SVG path */
  function buildBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const offset = Math.max(40, Math.min(dx, dy) * 0.5);

    // Determine control points based on direction
    let cp1x, cp1y, cp2x, cp2y;

    if (Math.abs(y2 - y1) > Math.abs(x2 - x1)) {
      // Mostly vertical
      cp1x = x1;
      cp1y = y1 + (y2 > y1 ? offset : -offset);
      cp2x = x2;
      cp2y = y2 + (y2 > y1 ? -offset : offset);
    } else {
      // Mostly horizontal
      cp1x = x1 + (x2 > x1 ? offset : -offset);
      cp1y = y1;
      cp2x = x2 + (x2 > x1 ? -offset : offset);
      cp2y = y2;
    }

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }

  /* Highlight connections on hover */
  function highlightConnections(nodeId, on) {
    const svg = $('#connections-svg');
    if (!svg) return;

    svg.querySelectorAll('g').forEach((g) => {
      const isRelated = g.dataset.from === nodeId || g.dataset.to === nodeId;
      const line  = g.querySelector('.conn-line');
      const label = g.querySelector('.conn-label');

      if (line) line.classList.toggle('highlighted', on && isRelated);
      if (label) label.classList.toggle('highlighted', on && isRelated);
    });
  }

  /* ── Legend ── */
  function renderLegend() {
    const div = document.createElement('div');
    div.className = 'legend fade-in';

    let html = '<div class="legend-title">Link Protocol</div>';
    Object.values(VIEW_DATA.protocols).forEach((p) => {
      const dashClass = p.dash ? ' dashed' : '';
      html += `
        <div class="legend-item">
          <div class="legend-line${dashClass}" style="background-color:${p.color}; color:${p.color};"></div>
          <span>${p.label}</span>
        </div>
      `;
    });

    div.innerHTML = html;
    canvasInner.appendChild(div);
  }

  /* ═══════════════════════════════════
   *  DETAIL PANEL
   * ═══════════════════════════════════ */
  function selectNode(node, domEl) {
    // Deselect previous
    $$('.node.selected').forEach((n) => n.classList.remove('selected'));

    // Select new
    selectedNode = node;
    domEl.classList.add('selected');
    detailPanel.classList.remove('collapsed');

    renderDetail(node);
  }

  function renderDetail(node) {
    const d = node.detail;
    if (!d) { renderDetailEmpty(); return; }

    let html = `
      <div class="detail-header">
        <h2>${d.title}</h2>
        <button class="detail-close-btn" id="detail-close" title="Close panel">✕</button>
      </div>
      <div class="detail-body">
    `;

    // Tech badges
    if (d.tech && d.tech.length) {
      html += '<div class="detail-section"><div class="detail-section-label">⚡ Tech Stack</div><div class="tech-badges">';
      d.tech.forEach((t) => { html += `<span class="tech-badge">${t}</span>`; });
      html += '</div></div>';
    }

    // Description
    if (d.description) {
      html += `<div class="detail-section"><div class="detail-section-label">📝 Description</div><div class="detail-description">${d.description}</div></div>`;
    }

    // Bullets
    if (d.bullets && d.bullets.length) {
      html += '<div class="detail-section"><div class="detail-section-label">▸ Details</div><ul class="detail-bullets">';
      d.bullets.forEach((b) => { html += `<li>${b}</li>`; });
      html += '</ul></div>';
    }

    // Ports
    if (d.ports && d.ports.length) {
      html += '<div class="detail-section"><div class="detail-section-label">🔌 Ports</div><div class="info-pills">';
      d.ports.forEach((p) => { html += `<span class="info-pill">${p}</span>`; });
      html += '</div></div>';
    }

    // Env vars
    if (d.env && d.env.length) {
      html += '<div class="detail-section"><div class="detail-section-label">🔧 Environment</div><div class="info-pills">';
      d.env.forEach((e) => { html += `<span class="info-pill env">${e}</span>`; });
      html += '</div></div>';
    }

    html += '</div>';
    detailPanel.innerHTML = html;

    // Close button
    const closeBtn = detailPanel.querySelector('#detail-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        detailPanel.classList.add('collapsed');
        $$('.node.selected').forEach((n) => n.classList.remove('selected'));
        selectedNode = null;
      });
    }
  }

  function renderDetailEmpty() {
    detailPanel.innerHTML = `
      <div class="detail-empty">
        <div class="empty-icon">◎</div>
        <p><strong>Select a node</strong> to view its<br>technical details, tech stack,<br>and configuration.</p>
      </div>
    `;
    detailPanel.classList.remove('collapsed');
  }

  /* ── Canvas click to deselect ── */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.node') && !e.target.closest('.detail-panel')) {
      $$('.node.selected').forEach((n) => n.classList.remove('selected'));
      selectedNode = null;
      renderDetailEmpty();
    }
  });

  /* ═══════════════════════════════════
   *  BOOT
   * ═══════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

})();
