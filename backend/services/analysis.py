"""Build a factual inspection summary from detector output."""

from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4


def generate_analysis(detections: list[dict], filename: str) -> dict:
    counts = Counter(item["class_name"] for item in detections)
    confidences = [item["confidence"] for item in detections]
    has_detections = bool(detections)

    return {
        "inspection_id": f"PCB-{uuid4().hex[:12].upper()}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": filename,
        "total_detections": len(detections),
        "highest_confidence": max(confidences, default=0.0),
        "average_confidence": sum(confidences) / len(confidences) if confidences else 0.0,
        "distribution": dict(counts),
        "status": "DEFECTIVE" if has_detections else "PASS",
        "recommendation": (
            "Đã phát hiện vùng nghi lỗi. Vui lòng đối chiếu ảnh gốc và kiểm tra thủ công "
            "trước khi quyết định chất lượng bo mạch."
            if has_detections
            else "Không phát hiện lỗi ở ngưỡng hiện tại. Kết quả AI không thay thế "
            "quy trình kiểm tra chất lượng thủ công."
        ),
    }
