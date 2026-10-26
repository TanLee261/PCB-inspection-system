# Legacy Model Weights

Thư mục này lưu trữ trọng số mô hình đã huấn luyện xong để phục vụ FastAPI Backend suy luận (Inference):

### File hiện tại:
- **`best.pt`**: checkpoint YOLO11s-P2 B1.
- Nguồn: `experiences/B1_yolo11s_p2_100ep/weights/best.pt`.
- SHA-256: `b7e52ae54483d1797b0c7f4c632d69b7ad0fe1b8a914f28c09621eaaa2dd81bf`.
- Threshold thử nghiệm B1: `0.25` cho toàn bộ sáu lớp.

### Luồng nạp trọng số hiện tại

Checkpoint YOLO11s-P2 `best.pt` ở đây là artifact cũ, được giữ nguyên để đối chiếu. API hiện dùng hai checkpoint YOLOv8s và YOLOv8s-P2 trong `runs/`, theo đường dẫn/hash tại `configs/threshold_yolov8s.yaml`; xem `backend/README.md`.
