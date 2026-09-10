"""
runtime/services/redis_publisher.py
Publishes AI detection events to Redis channels.
Node.js backend subscribes and handles DB writes + alerting.

Channels:
  ai:human    → human/troop detection events
  ai:vehicle  → vehicle/ANPR events
  ai:fence    → virtual fence intrusion events
  ai:alert    → high-priority alerts (all pipelines)
"""

import json
import asyncio
import logging
import redis.asyncio as aioredis
import os

log = logging.getLogger("redis_publisher")

_client: aioredis.Redis | None = None


async def connect_redis() -> None:
    global _client
    _client = aioredis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        password=os.getenv("REDIS_PASSWORD") or None,
        decode_responses=True,
    )
    await _client.ping()
    log.info("Redis publisher connected")


async def publish(channel: str, payload: dict) -> None:
    if _client is None:
        raise RuntimeError("Redis not connected — call connect_redis() first")
    message = json.dumps(payload)
    await _client.publish(channel, message)
    log.debug(f"Published to {channel}: {message[:120]}")


# ── Typed publish helpers ─────────────────────────────────────────────────

async def publish_human_event(payload: dict) -> None:
    await publish("ai:human", payload)

async def publish_vehicle_event(payload: dict) -> None:
    await publish("ai:vehicle", payload)

async def publish_fence_event(payload: dict) -> None:
    await publish("ai:fence", payload)

async def publish_alert(payload: dict) -> None:
    await publish("ai:alert", payload)
