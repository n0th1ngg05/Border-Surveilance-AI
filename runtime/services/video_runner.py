"""
runtime/services/video_runner.py

Core inference loop for the V.I.E.W prototype demo.

Reads sources.json, opens each enabled video as a looping feed,
and dispatches frames to the correct pipeline via the frame-interleave scheme:

  frame_index % 3 == 0  →  HumanDetectionPipeline
  frame_index % 3 == 1  →  VehicleDetectionPipeline
  frame_index % 3 == 2  →  skip (pattern/virtual-fence — not implemented yet)

Each camera runs in its own asyncio task via asyncio.to_thread for the
blocking cv2.VideoCapture.read() calls. Inference is done on GPU, so
multiple cameras share the same YOLO model instances (thread-safe in YOLOv8).

Config is hot-reloadable — SIGHUP will re-read sources.json without restart.
"""

import asyncio
import json
import logging
import os
import time
from pathlib import Path

import cv2

log = logging.getLogger("video_runner")

# Path to sources.json — relative to THIS file
SOURCES_PATH = Path(__file__).parent.parent / "sources.json"


def load_sources() -> list[dict]:
    """Read and validate sources.json. Returns only enabled sources."""
    with open(SOURCES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    sources = []
    for src in data.get("sources", []):
        if not src.get("enabled", True):
            continue

        source_type = src.get("source_type", "file")

        if source_type == "rtsp":
            # RTSP / IP camera — video_path is already the stream URL, use as-is.
            # OpenCV's VideoCapture handles rtsp:// URLs natively.
            log.info(f"[{src['id']}] RTSP source registered: {src['video_path']}")
            sources.append({**src})
        else:
            # Resolve video_path relative to sources.json location
            vp = Path(SOURCES_PATH.parent / src["video_path"]).resolve()
            if not vp.exists():
                log.warning(f"Video not found for {src['id']}: {vp} — skipping")
                continue
            sources.append({**src, "video_path": str(vp)})

    log.info(f"Loaded {len(sources)} enabled source(s) from sources.json")
    return sources


async def run_camera(
    source: dict,
    human_pipeline,
    vehicle_pipeline,
    infer_every: int,
) -> None:
    """
    Runs one camera source in a continuous loop.
    Opens the video file, reads frames, dispatches to pipelines, loops on EOF.

    infer_every: only run inference every Nth frame (reduces GPU load).
                 Frame numbering is based on the source's own counter, not global.
    """
    cam_id   = source["id"]
    cam_name = source["name"]
    video_path = source["video_path"]
    fps_target = source.get("fps_target", 15)
    frame_delay = 1.0 / fps_target  # seconds per frame

    log.info(f"[{cam_id}] Starting — {video_path}")

    frame_index = 0
    cap = None

    while True:
        # Open / reopen video
        if cap is None or not cap.isOpened():
            cap = await asyncio.to_thread(cv2.VideoCapture, video_path)
            if not cap.isOpened():
                log.error(f"[{cam_id}] Cannot open {video_path} — retrying in 5s")
                await asyncio.sleep(5)
                cap = None
                continue

        t_start = time.monotonic()

        # Read one frame (blocking I/O → thread)
        ret, frame = await asyncio.to_thread(cap.read)

        if not ret:
            if source.get("source_type") == "rtsp":
                # Live stream dropped — close and reconnect
                log.warning(f"[{cam_id}] RTSP stream lost — reconnecting in 3s")
                await asyncio.to_thread(cap.release)
                cap = None
                await asyncio.sleep(3)
            else:
                # End of file — loop back to start
                log.debug(f"[{cam_id}] EOF — looping video")
                await asyncio.to_thread(cap.set, cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        frame_index += 1

        # Only run inference every N frames
        if frame_index % infer_every != 0:
            elapsed = time.monotonic() - t_start
            sleep_for = max(0.0, frame_delay - elapsed)
            if sleep_for:
                await asyncio.sleep(sleep_for)
            continue

        # ── Frame interleave dispatch ─────────────────────────────────────────
        slot = frame_index % 3

        try:
            if slot == 0:
                # Person detection
                await human_pipeline.process(frame, cam_id, cam_name, frame_index)
            elif slot == 1:
                # Vehicle detection
                await vehicle_pipeline.process(frame, cam_id, cam_name, frame_index)
            # slot == 2 → pattern (virtual fence) — skipped for prototype
        except Exception as e:
            log.error(f"[{cam_id}] Pipeline error at frame {frame_index}: {e}")

        elapsed = time.monotonic() - t_start
        sleep_for = max(0.0, frame_delay - elapsed)
        if sleep_for:
            await asyncio.sleep(sleep_for)


async def run_all(
    human_pipeline,
    vehicle_pipeline,
    infer_every: int = 5,
) -> None:
    """
    Entry point — called from main.py lifespan.
    Reads sources.json and spawns one asyncio task per enabled source.
    Tasks run indefinitely (loop on EOF).
    """
    sources = load_sources()
    if not sources:
        log.warning("No enabled video sources found in sources.json — runner idle")
        return

    tasks = [
        asyncio.create_task(
            run_camera(src, human_pipeline, vehicle_pipeline, infer_every),
            name=f"cam-{src['id']}",
        )
        for src in sources
    ]

    log.info(f"Started {len(tasks)} camera task(s): {[s['id'] for s in sources]}")

    # Await all tasks — they loop forever, so this blocks until shutdown
    await asyncio.gather(*tasks, return_exceptions=True)
