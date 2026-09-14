"""
runtime/pipelines/vehicle_detection.py

Pipeline B — Vehicle Detection + Classification.
Runs on every frame where (frame_index % 3 == 1).

Model : YOLOv8n (COCO)
Target classes : car(2), motorcycle(3), bus(5), truck(7)
Device : CUDA (GPU)

Publishes to Node.js via http_publisher.
Pattern detection (virtual_fence) is skipped for prototype.
"""

import logging
import torch
from ultralytics import YOLO

from services.http_publisher import publish_vehicle_event, publish_alert

log = logging.getLogger("pipeline.vehicle")

# COCO vehicle class IDs
VEHICLE_CLASSES = [2, 3, 5, 7]  # car, motorcycle, bus, truck
VEHICLE_LABELS  = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# Map COCO labels → tactical classification for the HUD
TACTICAL_TYPE = {
    "car":        "Patrol",
    "motorcycle": "Patrol",
    "bus":        "Transport",
    "truck":      "Transport",
}

CONF_THRESHOLD = 0.40


class VehicleDetectionPipeline:
    def __init__(self, model_path: str, device: str = "cuda"):
        log.info(f"Loading YOLO model for vehicle detection from {model_path} on {device}")
        self.model = YOLO(model_path)
        self.device = device
        # Warm-up pass
        dummy = torch.zeros((1, 3, 640, 640), device=device)
        self.model(dummy, verbose=False)
        log.info("VehicleDetectionPipeline ready ✅")

    async def process(self, frame, camera_id: str, camera_name: str, frame_index: int) -> None:
        """
        Run YOLOv8n vehicle detection on a single BGR frame.
        Publishes event payload to Node.js if any vehicles found.
        """
        try:
            results = self.model(
                frame,
                classes=VEHICLE_CLASSES,
                conf=CONF_THRESHOLD,
                device=self.device,
                verbose=False,
            )
        except Exception as e:
            log.error(f"[{camera_id}] Vehicle inference error: {e}")
            return

        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                conf = float(box.conf[0])
                cls  = int(box.cls[0])
                label = VEHICLE_LABELS.get(cls, "vehicle")
                detections.append({
                    "bbox":           [round(x1), round(y1), round(x2), round(y2)],
                    "confidence":     round(conf, 3),
                    "label":          label,
                    "tactical_type":  TACTICAL_TYPE.get(label, "Combat"),
                })

        if not detections:
            return

        h, w = frame.shape[:2]
        # Generate a fake plate for demo (no real OCR yet)
        fake_plate = f"XX-{(frame_index % 9999):04d}-YY"

        payload = {
            "camera_id":    camera_id,
            "camera_name":  camera_name,
            "frame_index":  frame_index,
            "frame_width":  w,
            "frame_height": h,
            "detections":   detections,
            "verified":     False,        # No ANPR/OCR yet in demo
            "entity_id":    fake_plate,
            "model":        detections[0]["tactical_type"] + " vehicle",
            "message":      f"Vehicle detected — {len(detections)} unit(s) in frame",
        }

        await publish_vehicle_event(payload)
        log.debug(f"[{camera_id}] Vehicle event published — {len(detections)} vehicle(s) @ frame {frame_index}")

        # Flagged alert for unverified vehicle
        if any(d["confidence"] > 0.70 for d in detections):
            await publish_alert({
                "level":       "MEDIUM",
                "module":      "VEHICLE",
                "camera_id":   camera_id,
                "camera_name": camera_name,
                "entity_id":   fake_plate,
                "message":     f"⚠️ ANPR FLAG: Unregistered vehicle — {camera_name}",
                "frame_index": frame_index,
            })
