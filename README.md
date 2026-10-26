# PCB-DetectionImprove

Hệ thống Phát hiện và Cải tiến Nhận diện Lỗi Mạch in PCB (PCB Defect Detection & Inspection System) — Khóa Luận Tốt Nghiệp.

---

## 📁 Cấu trúc Thư mục Dự án (Monorepo Architecture)

```text
PCB-DetectionImprove/
├── frontend/           # React/Vite: Tải ảnh, Webcam soi mạch, Trực quan hóa BBox, Xuất PDF
├── backend/            # FastAPI: suy luận YOLOv8s / YOLOv8s-P2 theo cấu hình đã khóa
│   ├── models/         # Checkpoint YOLO11 cũ, không dùng cho API hiện tại
│   ├── services/       # Phân tích kết quả, thống kê QA/QC
│   ├── uploads/        # Lưu trữ tạm
│   ├── app.py          # FastAPI server entrypoint
│   ├── predictor.py    # Module suy luận YOLO
│   └── test_predictor.py # Unit tests kiểm tra backend
├── configs/            # Cấu hình thí nghiệm và threshold_yolov8s.yaml
├── data/               # Dữ liệu ảnh PKU gốc và split đã khóa chống rò rỉ (train/val/test)
├── scripts/            # Notebooks huấn luyện & đánh giá (B0, B1, Kaggle)
├── evaluation/         # Bảng metrics và biểu đồ đánh giá (PR curve, F1, Confusion Matrix)
├── docs/               # Quyết định thiết kế, báo cáo kiểm chứng rò rỉ (leakage_report.md)
├── Dockerfile          # Đóng gói container cho Backend
├── .dockerignore       # Loại trừ dữ liệu thừa khi build image Docker
├── experiences/        # Nhật ký và log thí nghiệm
├── runs/               # Checkpoint B0 YOLOv8s và B1 YOLOv8s-P2 được API sử dụng
├── results/            # Kết quả thống kê dataset
├── screenshots/        # Ảnh chụp giao diện / kết quả thử nghiệm
├── test_images/        # Ảnh phục vụ kiểm thử nhanh
└── work.md             # Kế hoạch công việc & kiến trúc dự án
```

Roadmap tiến độ nghiên cứu: [docs/02-Thong-Ke/roadmap.md](docs/02-Thong-Ke/roadmap.md). Chỉ mục tài liệu: [docs/README.md](docs/README.md).

---

## 🚀 Hướng Dẫn Vận Hành Hệ Thống

### 1. Khởi động Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
API Documentation có sẵn tại: `http://localhost:8000/docs`

### 2. Khởi động Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Truy cập giao diện Web tại: `http://localhost:5173`

### 3. Chạy Toàn Bộ Hệ Thống (Frontend + Backend) Bằng Docker Compose (Khuyến nghị)
Chỉ với 1 câu lệnh duy nhất từ thư mục gốc:
```bash
docker compose up --build
```
- **Frontend Web UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000` (Swagger docs: `http://localhost:8000/docs`)
- Tự động kết nối Frontend và Backend thông qua mạng bridge nội bộ.
- Checkpoint B0/B1 trong `runs/` được mount chỉ đọc; ngưỡng lấy từ `configs/threshold_yolov8s.yaml`. Trên giao diện có thể chọn B0, B1, B2 hoặc Proposed.

### 4. Chạy Riêng Lẻ Backend Bằng Docker
```bash
# Từ thư mục gốc:
docker build -t pcb-inspection-api .
docker run --rm -p 8000:8000 -v "$(pwd)/runs:/app/runs:ro" pcb-inspection-api
```

### 5. Tải checkpoint sau khi clone

Git không lưu checkpoint `.pt`; hai bản `best.pt` đã khóa được phát hành ở [GitHub Release v1.0-models](https://github.com/TanLee261/PCB-inspection-system/releases/tag/v1.0-models). Từ thư mục gốc repository, tải đúng đường dẫn mà `configs/threshold_yolov8s.yaml` tham chiếu:

```bash
mkdir -p runs/B0_yolov8s_100ep_batch16/weights runs/B1_yolov8s_p2_100ep/weights
curl -fL https://github.com/TanLee261/PCB-inspection-system/releases/download/v1.0-models/B0_yolov8s.pt -o runs/B0_yolov8s_100ep_batch16/weights/best.pt
curl -fL https://github.com/TanLee261/PCB-inspection-system/releases/download/v1.0-models/B1_yolov8s_p2.pt -o runs/B1_yolov8s_p2_100ep/weights/best.pt
docker compose up --build
```

Backend kiểm tra SHA256 của mỗi checkpoint trước khi suy luận. Dataset PKU-Market-PCB không được đưa vào Git; nguồn và quy trình chuẩn bị dữ liệu được mô tả trong `docs/01-Reports/data_audit.md` và các notebook ở `scripts/`. Để train/đánh giá lại, tải dataset từ [Kaggle](https://www.kaggle.com/datasets/liuxiaolong1/pcb-defect-detection-dataset) theo cấu trúc `data/raw/` và dùng split đã lưu ở `data/splits/`.
