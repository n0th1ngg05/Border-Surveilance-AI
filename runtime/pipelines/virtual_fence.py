"""
runtime/pipelines/virtual_fence.py
Pipeline C — Virtual Fence Intrusion Detection.
Processes every (n+2)th frame (slot 2).

Flow:
  Frame → YOLOv8 detect (human+vehicle) → ByteTrack →
  Centroid extraction → Point-in-Polygon test →
  Zone classification → Dwell timer → Alert threshold →
  Publish to Redis (ai:fence / ai:alert)
"""

import logging
from shapely.geometry import Point, Polygon
from services.redis_publisher import publish_fence_event, publish_alert

log = logging.getLogger("pipeline.fence")


class ZoneConfig:
    """Represents a configured virtual fence zone."""
    def __init__(self, zone_id: str, zone_type: str, polygon_coords: list, dwell_threshold: int = 30):
        self.zone_id = zone_id
        self.zone_type = zone_type  # RED | AMBER | GREEN | CORRIDOR
        self.polygon = Polygon(polygon_coords)
        self.dwell_threshold = dwell_threshold  # seconds


class VirtualFencePipeline:
    def __init__(self):
        # TODO: Load models
        # self.detector = YOLO("weights/yolov8n.pt")  # detect humans + vehicles
        # self.tracker  = ByteTracker(...)

        self.zones: list[ZoneConfig] = []          # loaded from DB/Node API
        self.dwell_timers: dict[str, dict] = {}    # track_id → {zone_id, start_time}

        log.info("VirtualFencePipeline initialised [models not yet loaded]")

    def load_zones(self, zone_configs: list[dict]):
        """Load zone polygons from config (called on startup + zone updates)."""
        self.zones = [
            ZoneConfig(
                zone_id=z["zone_id"],
                zone_type=z["zone_type"],
                polygon_coords=z["polygon"],
                dwell_threshold=z.get("dwell_threshold_seconds", 30),
            )
            for z in zone_configs
        ]
        log.info(f"Loaded {len(self.zones)} virtual fence zones")

    def point_in_zone(self, cx: float, cy: float) -> ZoneConfig | None:
        """Ray-casting point-in-polygon test for all registered zones."""
        point = Point(cx, cy)
        for zone in self.zones:
            if zone.polygon.contains(point):
                return zone
        return None

    async def process(self, frame, camera_id: str, timestamp: str):
        """
        TODO: implement full pipeline
        """
        log.debug(f"[{camera_id}] Virtual fence pipeline processing frame [PLACEHOLDER]")

        # Step 1: Object detection (human + vehicle)
        # detections = self.detector(frame)

        # Step 2: ByteTrack — assign persistent track IDs
        # tracks = self.tracker.update(detections)

        # Step 3: For each track → compute centroid → PiP test
        # for track in tracks:
        #     cx, cy = centroid(track.bbox)
        #     zone = self.point_in_zone(cx, cy)

        # Step 4: Dwell timer logic
        #     if zone:
        #         if track.id not in self.dwell_timers:
        #             self.dwell_timers[track.id] = {"zone_id": zone.zone_id, "start": now()}
        #         dwell = elapsed(self.dwell_timers[track.id]["start"])
        #         if dwell >= zone.dwell_threshold or zone.zone_type == "RED":
        #             await publish_fence_event({...})
        #             await publish_alert({...})
        #     else:
        #         self.dwell_timers.pop(track.id, None)

        pass
