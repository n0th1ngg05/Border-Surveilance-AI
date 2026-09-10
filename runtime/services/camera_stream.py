"""
runtime/services/camera_stream.py
Reads RTSP/IP camera streams and demultiplexes frames
into three alternating pipeline slots:
  - Frame n   → Human detection pipeline
  - Frame n+1 → Vehicle detection pipeline
  - Frame n+2 → Virtual fence pipeline
"""

import cv2
import asyncio
import logging
from dataclasses import dataclass

log = logging.getLogger("camera_stream")


@dataclass
class CameraConfig:
    camera_id: str
    rtsp_url: str
    enabled: bool = True


class CameraStream:
    """Single camera RTSP stream reader with frame demuxing."""

    def __init__(self, config: CameraConfig):
        self.config = config
        self.cap: cv2.VideoCapture | None = None
        self.frame_index = 0

    def open(self) -> bool:
        self.cap = cv2.VideoCapture(self.config.rtsp_url)
        return self.cap.isOpened()

    def read_frame(self):
        """Read one frame and return (frame, pipeline_slot)."""
        if self.cap is None:
            return None, None
        ret, frame = self.cap.read()
        if not ret:
            return None, None
        slot = self.frame_index % 3  # 0=human, 1=vehicle, 2=fence
        self.frame_index += 1
        return frame, slot

    def release(self):
        if self.cap:
            self.cap.release()


class CameraStreamManager:
    """Manages multiple camera streams."""

    def __init__(self):
        self.streams: list[CameraStream] = []
        # TODO: Load camera configs from DB / Node API on startup

    async def run(self):
        log.info("CameraStreamManager running [PLACEHOLDER — no cameras loaded yet]")
        # TODO:
        # 1. Fetch camera list from Node API (GET /api/cameras)
        # 2. Create CameraStream for each
        # 3. Read frames in loop, dispatch to correct pipeline queue
        await asyncio.sleep(0)  # placeholder
