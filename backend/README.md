# PCB Inspection API · YOLOv8s / YOLOv8s-P2

API dùng trực tiếp hai checkpoint **đã huấn luyện** từ `runs/`, xác nhận SHA256 và mapping sáu lớp PKU trước khi suy luận. Cấu hình ngưỡng được lấy từ `configs/threshold_yolov8s.yaml` (chọn trên validation). Checkpoint `backend/models/best.pt` thuộc thí nghiệm YOLO11 cũ, **không được API sử dụng**.

| Cấu hình | Checkpoint | Ngưỡng Open_circuit / Short | Ngưỡng bốn lớp còn lại |
|---|---|---:|---:|
| B0 (mặc định) | YOLOv8s B0 | 0.25 | 0.25 |
| B1 | YOLOv8s-P2 B1 | 0.25 | 0.25 |
| B2 | YOLOv8s B0 | 0.02 | 0.58 |
| Proposed | YOLOv8s-P2 B1 | 0.01 | 0.57 |

Suy luận luôn lấy candidates với `conf=0.001`, `imgsz=1024`, NMS IoU `0.7`, `max_det=300`, sau đó lọc theo ngưỡng của cấu hình đã chọn. Tọa độ bbox tính trên ảnh gốc; không có tiling/SAHI. `PASS` chỉ có nghĩa không còn box vượt ngưỡng, không xác nhận PCB không có lỗi (dataset kiểm thử không có ảnh PCB bình thường).

## Chạy cục bộ

Từ thư mục `backend/`:

```bash
python -m pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Cần có `runs/B0_yolov8s_100ep_batch16/weights/best.pt`, `runs/B1_yolov8s_p2_100ep/weights/best.pt` và `configs/threshold_yolov8s.yaml` ở thư mục gốc dự án. `PCB_PROJECT_ROOT` có thể trỏ tới thư mục gốc khác, `PCB_DEVICE` mặc định `cpu` (máy Mac có thể dùng `mps`), `PCB_DEFAULT_PROFILE` mặc định `B0` và `PCB_CORS_ORIGINS` cấu hình origin frontend. Thiếu checkpoint hoặc sai SHA256 sẽ báo `ready: false` và request sử dụng model đó trả HTTP 503; không trả dự đoán giả.

## Docker Compose

Tại thư mục gốc: `docker compose up --build`. Compose mount `./runs` chỉ đọc vào `/app/runs`; build image chứa `configs/threshold_yolov8s.yaml`. Docker mặc định chạy CPU.

## API

- `GET /api/health`: trạng thái hai checkpoint và cấu hình mặc định.
- `GET /api/model-info`: danh sách bốn cấu hình, tên lớp, ngưỡng và trạng thái checkpoint.
- `POST /api/predict`: form-data `file` (JPG/PNG/WebP, ≤12 MB, ≤30 triệu pixel) và `profile` (B0/B1/B2/Proposed; tùy chọn). Trả ảnh đánh dấu, bbox, confidence, `model` (cấu hình thực sự dùng, ngưỡng và thời gian xử lý server) và `analysis.status` (`PASS`/`DEFECTIVE`).
- `GET /api/results/{id}.jpg`: tải ảnh dự đoán sau khi lọc ngưỡng.

Ảnh gốc chỉ xử lý trong bộ nhớ; ảnh kết quả được ghi vào `backend/results/`.
