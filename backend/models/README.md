# Checkpoint YOLOv8s (B0)

`best.pt` trong thư mục này là bản sao cục bộ của checkpoint **YOLOv8s B0** đã huấn luyện trên sáu lớp PKU-Market-PCB.

| Thuộc tính | Giá trị |
|---|---|
| Kiến trúc | YOLOv8s (baseline B0) |
| Nguồn | `runs/B0_yolov8s_100ep_batch16/weights/best.pt` |
| SHA256 | `2b0ec7abf64a4dd976cf10a17c809f017cd42d175ec6ff5e5258b902351afc64` |
| Ảnh đầu vào | `imgsz=1024` |
| Ngưỡng B0 | `0.25` cho sáu lớp |

FastAPI hiện nạp **trực tiếp** hai checkpoint B0/B1 theo đường dẫn và SHA256 trong `configs/threshold_yolov8s.yaml`, không nạp từ `backend/models/best.pt`. Bản sao ở đây chỉ để tiện đối chiếu cục bộ; các tệp `.pt` không lưu trong Git. Khi clone, tải checkpoint B0/B1 từ [GitHub Release](https://github.com/TanLee261/PCB-inspection-system/releases/tag/v1.0-models) theo hướng dẫn ở README gốc.
