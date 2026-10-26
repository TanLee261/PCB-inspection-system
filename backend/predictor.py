"""Inference for the locked YOLOv8s and YOLOv8s-P2 PKU experiments."""

import hashlib
import os
from io import BytesIO
from pathlib import Path
from threading import RLock
from time import perf_counter

import numpy as np
import yaml
from PIL import Image, ImageDraw


CLASS_NAMES = (
    "Missing_hole", "Mouse_bite", "Open_circuit", "Short", "Spur", "Spurious_copper"
)
CLASS_COLORS = ("#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0284c7", "#9333ea")
CRITICAL_CLASS_IDS = frozenset({2, 3})
PROFILE_MODELS = {"B0": "B0", "B1": "B1", "B2": "B0", "Proposed": "B1"}
PROFILE_LABELS = {
    "B0": "B0 · YOLOv8s (0.25)",
    "B1": "B1 · YOLOv8s-P2 (0.25)",
    "B2": "B2 · YOLOv8s + ngưỡng theo lớp",
    "Proposed": "Proposed · YOLOv8s-P2 + ngưỡng theo lớp",
}
PREDICT_CONF = 0.001
IMGSZ = 1024
MAX_DET = 300


class ModelUnavailable(Exception):
    """The locked checkpoint is absent or incompatible with PKU."""


class Predictor:
    def __init__(self) -> None:
        self.root = Path(os.getenv("PCB_PROJECT_ROOT", str(Path(__file__).resolve().parents[1]))).resolve()
        config_path = Path(os.getenv("PCB_THRESHOLD_CONFIG", "configs/threshold_yolov8s.yaml"))
        self.config_path = config_path if config_path.is_absolute() else self.root / config_path
        config = yaml.safe_load(self.config_path.read_text(encoding="utf-8"))
        if config.get("experiment_family") != "YOLOv8s" or config.get("selected_on") != "validation":
            raise ValueError("Cần cấu hình threshold YOLOv8s đã khóa trên validation.")
        self.config = config
        self.device = os.getenv("PCB_DEVICE", "cpu")
        self.imgsz = IMGSZ
        self.confidence = PREDICT_CONF
        self.nms_iou = float(config["selection_rule"]["nms_iou"])
        if not 0 < self.nms_iou < 1:
            raise ValueError("NMS IoU không hợp lệ")
        self.default_profile = os.getenv("PCB_DEFAULT_PROFILE", "B0")
        if self.default_profile not in PROFILE_MODELS:
            raise ValueError("PCB_DEFAULT_PROFILE phải là B0, B1, B2 hoặc Proposed")
        self.checkpoints = {
            key: self.root / config["models"][key]["checkpoint"] for key in ("B0", "B1")
        }
        self._models = {}
        self._verified = {}
        self._load_errors = {}
        # Ultralytics predictors are stateful. Protect loading and inference across requests.
        self._lock = RLock()

    def thresholds(self, profile: str) -> tuple[float, float]:
        if profile not in PROFILE_MODELS:
            raise ValueError(f"Cấu hình không hợp lệ: {profile}")
        if profile in ("B0", "B1"):
            return 0.25, 0.25
        model_key = PROFILE_MODELS[profile]
        info = self.config["models"][model_key]
        return float(info["tau_critical"]), float(info["tau_regular"])

    def _check_checkpoint(self, model_key: str) -> tuple[bool, str | None]:
        path = self.checkpoints[model_key]
        if not path.is_file():
            return False, f"Không tìm thấy checkpoint {model_key}: {path}"
        stat = path.stat()
        signature = (stat.st_mtime_ns, stat.st_size)
        if model_key not in self._verified or self._verified[model_key][0] != signature:
            with path.open("rb") as file:
                digest = hashlib.file_digest(file, "sha256").hexdigest()
            self._verified[model_key] = (signature, digest)
            self._models.pop(model_key, None)
            self._load_errors.pop(model_key, None)
        if self._verified[model_key][1] != self.config["models"][model_key]["checkpoint_sha256"]:
            return False, f"Checkpoint {model_key} không khớp SHA256 đã khóa."
        return True, None

    def status(self) -> dict:
        with self._lock:
            models = {}
            for key in ("B0", "B1"):
                ready, error = self._check_checkpoint(key)
                models[key] = {
                    "ready": ready and key not in self._load_errors,
                    "loaded": key in self._models,
                    "error": error or self._load_errors.get(key),
                }
            selected = PROFILE_MODELS[self.default_profile]
            return {
                "model_ready": models[selected]["ready"],
                "model_loaded": models[selected]["loaded"],
                "model_error": models[selected]["error"],
                "default_profile": self.default_profile,
                "model": PROFILE_LABELS[self.default_profile],
                "models": models,
                "classes": list(CLASS_NAMES),
            }

    def info(self) -> dict:
        state = self.status()
        return {
            **state,
            "imgsz": self.imgsz,
            "candidate_confidence": self.confidence,
            "nms_iou": self.nms_iou,
            "selected_on": "validation",
            "profiles": [
                {
                    "id": name, "label": PROFILE_LABELS[name], "model_key": model_key,
                    "architecture": "YOLOv8s-P2" if model_key == "B1" else "YOLOv8s",
                    "ready": state["models"][model_key]["ready"],
                    "error": state["models"][model_key]["error"],
                    "critical_confidence": self.thresholds(name)[0],
                    "regular_confidence": self.thresholds(name)[1],
                    "checkpoint_sha256": self.config["models"][model_key]["checkpoint_sha256"],
                }
                for name, model_key in PROFILE_MODELS.items()
            ],
        }

    def _get_model(self, model_key: str):
        ready, error = self._check_checkpoint(model_key)
        if not ready:
            raise ModelUnavailable(error)
        if model_key in self._load_errors:
            raise ModelUnavailable(self._load_errors[model_key])
        if model_key not in self._models:
            try:
                from ultralytics import YOLO

                model = YOLO(str(self.checkpoints[model_key]))
                names = model.names
                if len(names) != len(CLASS_NAMES) or tuple(
                    names[index] for index in range(len(CLASS_NAMES))
                ) != CLASS_NAMES:
                    raise ValueError("Checkpoint không có đúng thứ tự sáu lớp PKU.")
                self._models[model_key] = model
            except Exception as exc:
                self._load_errors[model_key] = f"Không nạp được {model_key}: {exc}"
                raise ModelUnavailable(self._load_errors[model_key]) from exc
        return self._models[model_key]

    def predict(self, image: Image.Image, profile: str | None = None) -> tuple[bytes, list[dict], dict]:
        profile = profile or self.default_profile
        if profile not in PROFILE_MODELS:
            raise ValueError(f"Cấu hình không hợp lệ: {profile}")
        model_key = PROFILE_MODELS[profile]
        critical_confidence, regular_confidence = self.thresholds(profile)
        with self._lock:
            model = self._get_model(model_key)
            started = perf_counter()
            prediction = model.predict(
                source=np.asarray(image), imgsz=self.imgsz, conf=self.confidence,
                iou=self.nms_iou, device=self.device, max_det=MAX_DET,
                verbose=False, save=False,
            )[0]
            width, height = image.size
            detections = []
            if prediction.boxes is not None:
                for box in prediction.boxes:
                    class_id = int(box.cls.item())
                    if class_id not in range(len(CLASS_NAMES)):
                        raise ValueError(f"Class ID ngoài sáu lớp PKU: {class_id}")
                    score = float(box.conf.item())
                    limit = critical_confidence if class_id in CRITICAL_CLASS_IDS else regular_confidence
                    if score < limit:
                        continue
                    x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
                    detections.append({
                        "class_id": class_id, "class_name": CLASS_NAMES[class_id],
                        "confidence": round(score, 4),
                        "bbox": [round(max(0, min(x1, width)), 2), round(max(0, min(y1, height)), 2),
                                 round(max(0, min(x2, width)), 2), round(max(0, min(y2, height)), 2)],
                    })

            annotated = image.copy()
            draw = ImageDraw.Draw(annotated)
            for detection in detections:
                color = CLASS_COLORS[detection["class_id"]]
                x1, y1, x2, y2 = detection["bbox"]
                draw.rectangle((x1, y1, x2, y2), outline=color, width=3)
                label = f"{detection['class_name']} {detection['confidence']:.2f}"
                box = draw.textbbox((x1, y1), label)
                top = max(0, y1 - (box[3] - box[1]) - 6)
                draw.rectangle((x1, top, x1 + (box[2] - box[0]) + 6, top + (box[3] - box[1]) + 6), fill=color)
                draw.text((x1 + 3, top + 2), label, fill="white")
            output = BytesIO()
            annotated.save(output, format="JPEG", quality=88, optimize=True)
            elapsed_ms = round((perf_counter() - started) * 1000, 2)
        return output.getvalue(), detections, {
            "profile": profile, "model_key": model_key, "model": PROFILE_LABELS[profile],
            "architecture": "YOLOv8s-P2" if model_key == "B1" else "YOLOv8s",
            "candidate_confidence": self.confidence,
            "critical_confidence": critical_confidence,
            "regular_confidence": regular_confidence,
            "nms_iou": self.nms_iou, "imgsz": self.imgsz,
            "checkpoint_sha256": self.config["models"][model_key]["checkpoint_sha256"],
            "inference_ms": elapsed_ms,
        }
