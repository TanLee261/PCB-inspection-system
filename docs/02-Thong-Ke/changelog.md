# Changelog

Chưa có phiên bản phát hành sản phẩm chính thức. Các lần train/evaluation là run nghiên cứu và được ghi trong `experiences/`, `evaluation/` cùng `docs/01-Reports/decision_log.md`; không xem chúng là release version.

## v1.0-models — checkpoint cho demo

- GitHub Release lưu checkpoint B0 YOLOv8s và B1 YOLOv8s-P2 dưới hai tên phân biệt. Hash SHA256 và ngưỡng validation được khóa trong `configs/threshold_yolov8s.yaml`.
- Không bao gồm dataset PKU gốc; hướng dẫn tải checkpoint và chạy Docker ở `README.md`.
