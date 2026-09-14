"""
runtime/pipelines/human_detection.py

Pipeline A — Human / Person Detection.
Runs on every frame where (frame_index % 3 == 0).

Model : YOLOv8n (COCO)
Target classes : person (class_id = 0)
Device : CUDA (GPU)

Publishes to Node.js via http_publisher.
"""

import logging
import torch
from ultralytics import YOLO

from services.http_publisher import publish_human_event, publish_alert

log = logging.getLogger("pipeline.human")

# COCO class IDs for human
PERSON_CLASS = 0

# Confidence threshold — tune for your videos
CONF_THRESHOLD = 0.40


class HumanDetectionPipeline:
    def __init__(self, model_path: str, device: str = "cuda"):
        log.info(f"Loading YOLO model for human detection from {model_path} on {device}")
        self.model = YOLO(model_path)
        self.device = device
        # Warm-up pass so first real inference isn't slow
        dummy = torch.zeros((1, 3, 640, 640), device=device)
        self.model(dummy, verbose=False)
        log.info("HumanDetectionPipeline ready ✅")

    async def process(self, frame, camera_id: str, camera_name: str, frame_index: int) -> None:
        """
        Run YOLOv8n person detection on a single BGR frame (numpy ndarray).
        Publishes event payload to Node.js if any persons found.
        """
        try:
            results = self.model(
                frame,
                classes=[PERSON_CLASS],
                conf=CONF_THRESHOLD,
                device=self.device,
                verbose=False,
            )
        except Exception as e:
            log.error(f"[{camera_id}] Human inference error: {e}")
            return

        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                conf = float(box.conf[0])
                detections.append({
                    "bbox": [round(x1), round(y1), round(x2), round(y2)],
                    "confidence": round(conf, 3),
                    "label": "person",
                })

        if not detections:
            return  # Nothing to report — keep pipeline quiet

        h, w = frame.shape[:2]
        payload = {
            "camera_id":    camera_id,
            "camera_name":  camera_name,
            "frame_index":  frame_index,
            "frame_width":  w,
            "frame_height": h,
            "detections":   detections,
            "verified":     False,          # No face-rec yet in demo
            "entity_id":    f"UNIDENTIFIED-{frame_index % 999:03d}",
            "message":      f"Person detected — {len(detections)} target(s) in frame",
        }

        await publish_human_event(payload)
        log.debug(f"[{camera_id}] Human event published — {len(detections)} person(s) @ frame {frame_index}")

        # Escalate as alert if confidence is high enough on any detection
        if any(d["confidence"] > 0.75 for d in detections):
            await publish_alert({
                "level":       "HIGH",
                "module":      "HUMAN",
                "camera_id":   camera_id,
                "camera_name": camera_name,
                "entity_id":   payload["entity_id"],
                "message":     f"🚨 HIGH-CONF DETECTION: Unknown person — {camera_name}",
                "frame_index": frame_index,
            })
