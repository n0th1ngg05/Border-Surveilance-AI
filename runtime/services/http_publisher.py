"""
runtime/services/http_publisher.py

Publishes AI detection events directly to the Node.js backend via HTTP POST.
No Redis required — replaces redis_publisher.py for the prototype demo.

Node.js receives at POST /api/ai-event and immediately fans out over Socket.IO.
"""

import json
import asyncio
import logging
import aiohttp
import os

log = logging.getLogger("http_publisher")

NODE_URL = os.getenv("NODE_URL", "http://localhost:3000")
_session: aiohttp.ClientSession | None = None


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        timeout = aiohttp.ClientTimeout(total=3)
        _session = aiohttp.ClientSession(timeout=timeout)
    return _session


async def publish(payload: dict) -> None:
    """POST payload to Node.js /api/ai-event. Fire-and-forget — never blocks the pipeline."""
    try:
        session = await get_session()
        async with session.post(
            f"{NODE_URL}/api/ai-event",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as resp:
            if resp.status not in (200, 201, 204):
                log.warning(f"Node.js rejected event: HTTP {resp.status}")
    except aiohttp.ClientConnectorError:
        log.warning("Node.js unreachable — event dropped (is pnpm dev running?)")
    except asyncio.TimeoutError:
        log.warning("Node.js timed out — event dropped")
    except Exception as e:
        log.error(f"Unexpected publish error: {e}")


# ── Typed helpers (mirror redis_publisher.py API) ─────────────────────────────

async def publish_human_event(payload: dict) -> None:
    await publish({**payload, "pipeline": "human"})

async def publish_vehicle_event(payload: dict) -> None:
    await publish({**payload, "pipeline": "vehicle"})

async def publish_alert(payload: dict) -> None:
    await publish({**payload, "pipeline": "alert"})


async def close() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
        _session = None
