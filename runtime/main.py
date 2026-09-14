"""
runtime/main.py — Python AI Runtime entry point.

Startup sequence:
  1. Load config / env
  2. Load YOLOv8n model (shared across both pipelines — thread-safe)
  3. Start video runner (reads sources.json, spawns per-camera tasks)
  4. Expose FastAPI health endpoints

Run with:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from services.http_publisher import close as close_http
from pipelines.human_detection import HumanDetectionPipeline
from pipelines.vehicle_detection import VehicleDetectionPipeline
from services.video_runner import run_all, load_sources

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
log = logging.getLogger("runtime")

# ── Config ────────────────────────────────────────────────────────────────────
MODELS_DIR    = Path(__file__).parent.parent / "models"
MODEL_PATH    = str(MODELS_DIR / "yolov8n.pt")
DEVICE        = os.getenv("YOLO_DEVICE", "cuda")       # "cuda" | "cpu" | "0"
INFER_EVERY   = int(os.getenv("INFER_EVERY", "5"))     # run inference every Nth frame

# Shared pipeline instances (reused across all cameras)
human_pipeline:   HumanDetectionPipeline | None   = None
vehicle_pipeline: VehicleDetectionPipeline | None = None
runner_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global human_pipeline, vehicle_pipeline, runner_task

    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" V.I.E.W · Python AI Runtime · SIH-26187       ")
    log.info(f"  Model  : {MODEL_PATH}")
    log.info(f"  Device : {DEVICE}")
    log.info(f"  Infer every {INFER_EVERY} frame(s) per camera")
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # 1. Check model file exists
    if not Path(MODEL_PATH).exists():
        log.error(f"❌ Model not found at {MODEL_PATH}")
        log.error(f"   → Download yolov8n.pt and place it in: {MODELS_DIR}/")
        log.error(f"   → Run: pip install ultralytics && yolo export model=yolov8n.pt")
        raise FileNotFoundError(f"yolov8n.pt not found at {MODEL_PATH}")

    # 2. Load models (shared — YOLO is thread-safe for inference)
    log.info("[1/2] Loading YOLOv8n models...")
    human_pipeline   = HumanDetectionPipeline(MODEL_PATH, DEVICE)
    vehicle_pipeline = VehicleDetectionPipeline(MODEL_PATH, DEVICE)
    log.info("[1/2] ✅ Models loaded on device: " + DEVICE)

    # 3. Start the video runner as background task
    log.info("[2/2] Starting video runner...")
    runner_task = asyncio.create_task(
        run_all(human_pipeline, vehicle_pipeline, infer_every=INFER_EVERY),
        name="video-runner",
    )
    log.info("[2/2] ✅ Video runner active")
    log.info("🚀 Runtime ready — publishing events to Node.js")

    yield  # ← app is live here

    # ── Shutdown ──────────────────────────────────────────────────────────────
    log.info("Shutting down AI runtime...")
    if runner_task and not runner_task.done():
        runner_task.cancel()
        try:
            await runner_task
        except asyncio.CancelledError:
            pass
    await close_http()
    log.info("Runtime shutdown complete.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="V.I.E.W AI Runtime",
    description="YOLOv8n inference runtime — border surveillance prototype",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    sources = []
    try:
        sources = load_sources()
    except Exception:
        pass
    return {
        "status":         "ok",
        "service":        "ai-runtime",
        "device":         DEVICE,
        "model":          MODEL_PATH,
        "sources_loaded": len(sources),
        "infer_every":    INFER_EVERY,
    }


@app.get("/pipelines/status")
async def pipeline_status():
    return {
        "human_detection": {
            "status": "active" if human_pipeline else "not_loaded",
            "model":  "yolov8n",
            "device": DEVICE,
            "classes": ["person"],
        },
        "vehicle_detection": {
            "status": "active" if vehicle_pipeline else "not_loaded",
            "model":  "yolov8n",
            "device": DEVICE,
            "classes": ["car", "motorcycle", "bus", "truck"],
        },
        "virtual_fence": {
            "status": "skipped — prototype phase",
        },
    }


@app.get("/sources")
async def get_sources():
    """Return the current list of active video sources."""
    try:
        sources = load_sources()
        return {"count": len(sources), "sources": sources}
    except Exception as e:
        return {"error": str(e)}
