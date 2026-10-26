# PCB Defect Inspector — Frontend (React + Vite)

Giao diện web trực quan phục vụ việc soi chiếu, giám sát và kiểm định lỗi bo mạch PCB bằng AI (Hỗ trợ tải file ảnh, Webcam trực tiếp và Xuất báo cáo PDF).

## Tính năng chính:
- **Tải ảnh kiểm định**: Hỗ trợ kéo thả ảnh PCB độ nét cao (JPG, PNG).
- **Webcam trực tiếp**: Soi bo mạch trực tiếp từ camera, bắt khung và chụp phân tích tức thì.
- **Trực quan hóa Bounding Box**: Hiển thị ảnh phát hiện lỗi với viền màu riêng biệt cho 6 loại lỗi vi mạch PCB.
- **Chọn cấu hình đã huấn luyện**: B0 (YOLOv8s), B1 (YOLOv8s-P2), B2 (B0 + ngưỡng theo lớp) hoặc Proposed (B1 + ngưỡng theo lớp). Danh sách và trạng thái checkpoint lấy từ `/api/model-info`.
- **Phân tích chỉ số QA/QC**: Thống kê số box, confidence, cấu hình/ngưỡng thực sự dùng và kết luận `PASS`/`DEFECTIVE`. `PASS` chỉ nghĩa là không phát hiện box vượt ngưỡng, không chứng nhận bo mạch không lỗi.
- **Xuất báo cáo PDF / In phiếu kiểm định**: Tích hợp layout phiếu kiểm tra chất lượng chuẩn A4 có chữ ký KTV và Quản lý chất lượng.

## Cách chạy cục bộ (Development):

```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt tại: `http://localhost:5173`

*(Vite đã cấu hình proxy tự động chuyển tiếp các request `/api` sang FastAPI Backend tại `http://localhost:8000`)*.

Backend đọc checkpoint từ `runs/` và cấu hình tại `configs/threshold_yolov8s.yaml` ở thư mục gốc dự án; tham khảo `backend/README.md`. Giao diện sẽ vô hiệu hóa cấu hình nếu checkpoint không tồn tại/không đúng SHA256.

## Build bản Production:

```bash
cd frontend
npm run build
```
Thư mục xuất bản: `frontend/dist/`.
