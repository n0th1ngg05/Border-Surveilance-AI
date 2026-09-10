"""
runtime/main.py — Python AI Runtime entry point.

Starts the FastAPI internal server and boots all three
inference pipelines as background async tasks.

Boot sequence:
  1. Load config
  2. Connect to Redis (event publisher)
  3. Load AI models (YOLO, ArcFace, PaddleOCR)
  4. Start camera stream reader(s)
  5. Start frame demultiplexer
  6. Launch pipeline workers: human | vehicle | virtual_fence
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from services.redis_publisher import connect_redis
from services.camera_stream import CameraStreamManager
# from pipelines.human_detection import HumanDetectionPipeline
# from pipelines.vehicle_detection import VehicleDetectionPipeline
# from pipelines.virtual_fence import VirtualFencePipeline

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("runtime")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" SIH-26187 | Python AI Runtime   ")
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # 1. Redis
    await connect_redis()
    log.info("[1/3] Redis publisher connected")

    # 2. TODO: Load models into GPU memory
    # human_pipeline = HumanDetectionPipeline()
    # vehicle_pipeline = VehicleDetectionPipeline()
    # fence_pipeline = VirtualFencePipeline()
    log.info("[2/3] AI models loaded [PLACEHOLDER]")

    # 3. TODO: Start camera streams + frame demux
    # stream_manager = CameraStreamManager()
    # asyncio.create_task(stream_manager.run())
    log.info("[3/3] Camera streams started [PLACEHOLDER]")

    log.info("✅ Python AI Runtime ready")
    yield

    # Shutdown
    log.info("Shutting down AI runtime...")


app = FastAPI(
    title="SIH-26187 AI Runtime",
    description="Internal AI inference service — not publicly exposed",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-runtime"}


@app.get("/pipelines/status")
async def pipeline_status():
    # TODO: return real pipeline health (fps, queue depth, model loaded)
    return {
        "human_detection": {"status": "placeholder", "fps": 0},
        "vehicle_detection": {"status": "placeholder", "fps": 0},
        "virtual_fence": {"status": "placeholder", "fps": 0},
    }
