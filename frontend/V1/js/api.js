/* ═══════════════════════════════════════════════════════════
   V.I.E.W — API & Socket layer  (SIH-26187)
═══════════════════════════════════════════════════════════ */

const API_BASE = '';                       // same origin — served by Hono
let socket = null;
let pingTimer = null;

const api = {
  async health() {
    try {
      const r = await fetch(`${API_BASE}/api/health`);
      return await r.json();
    } catch { return null; }
  },

  async summary() {
    const r = await fetch(`${API_BASE}/api/demo/summary`);
    if (!r.ok) throw new Error(`summary ${r.status}`);
    return await r.json();
  },

  async acknowledge(id) {
    const r = await fetch(`${API_BASE}/api/demo/alerts/${id}/acknowledge`, { method: 'POST' });
    if (!r.ok) throw new Error(`ack ${r.status}`);
    return await r.json();
  },

  async triggerBreach() {
    const r = await fetch(`${API_BASE}/api/demo/trigger-breach`, { method: 'POST' });
    if (!r.ok) throw new Error(`breach ${r.status}`);
    return await r.json();
  },
};

/* ── Socket.IO ─────────────────────────────────────────── */
function initSocket(handlers) {
  if (typeof io === 'undefined') { handlers.onUnavailable?.(); return null; }

  socket = io({ transports: ['websocket', 'polling'], reconnectionDelay: 1500 });

  socket.on('connect', () => {
    handlers.onConnect?.();
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      const t0 = performance.now();
      const onPong = () => {
        socket.off('pong', onPong);
        handlers.onLatency?.(Math.round(performance.now() - t0));
      };
      socket.on('pong', onPong);
      socket.emit('ping');
    }, 4000);
  });

  socket.on('disconnect', () => { clearInterval(pingTimer); handlers.onDisconnect?.(); });
  socket.on('demo:init',  (store) => handlers.onInit?.(store));
  socket.on('event:human',   (p) => handlers.onHuman?.(p));
  socket.on('event:vehicle', (p) => handlers.onVehicle?.(p));
  socket.on('event:fence',   (p) => handlers.onFence?.(p));
  socket.on('alert',         (p) => handlers.onAlert?.(p));

  return socket;
}