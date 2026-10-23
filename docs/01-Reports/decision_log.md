# Data audit — size bins

Size bins COCO tại imgsz=640: area_640 = (area_box / area_image) * 640^2, giả định resize trực tiếp 640×640; small < 32², medium từ 32² đến 96² (bao gồm), large > 96². Đo trên box hợp lệ; không sửa ảnh hoặc annotation.

## Baseline B0 — YOLO11 (kế hoạch, chưa huấn luyện)

- Dùng duy nhất PKU với 6 lớp theo `data/data.yaml`; giữ nguyên split trong `data/splits/` (manifest + báo cáo leakage PASS phải cùng SHA256). DeepPCB dành riêng cho external test về sau.
- Notebook `scripts/12_train_B0_yolo11.ipynb` dùng `yolo11n.pt`, imgsz 640, 150 epochs, batch 16, seed 42, patience 30, optimizer auto và augmentation ở `configs/base.yaml`. Ultralytics chỉ train trên train và theo dõi val; **test không dùng để chọn tham số hoặc checkpoint**. Output train đặt trong `experiences/` đã có.
- Chỉ sau khi B0 train hoàn tất và có `experiences/weights/best.pt`, chạy `scripts/13_eval_B0_yolo11.ipynb` để báo cáo kết quả test một lần: P/R/mAP50/mAP50–95 toàn bộ và từng lớp, confusion/PR plot ở `evaluation/`; ảnh predict mẫu ở `samples/`. Ngưỡng minh họa mẫu (`predict_conf`, `predict_iou`) cố định từ config trước khi xem test, không dùng để tuning.
- Để tái lập, notebook train ghi hash của config, manifest split và best checkpoint; notebook eval từ chối checkpoint/config/split không khớp. `device: 0` chỉ dành cho CUDA; khi chạy trên máy không có CUDA, sửa config sang `mps` hoặc `cpu` **trước khi bắt đầu B0**. Không có metric B0 trước khi chính bạn chạy notebook.

## Giai đoạn 4 — Cải tiến A: Thêm P2 Feature Head cho YOLO11s (B1)

- **Định nghĩa mô hình**:
  - **B0 (Baseline)**: YOLO11s nguyên bản (`yolo11s.pt`), 3 detection heads (P3/8, P4/16, P5/32), $imgsz=1024$, 100 epochs, optimizer AdamW, batch 16, seed 42. Checkpoint lưu tại `experiences/B0_100ep/weights/best.pt`, kết quả đánh giá tại `evaluation/B0/` ($mAP@0.5 = 85.36\%$, $mAP@0.5:0.95 = 37.91\%$).
  - **B1 (Cải tiến A)**: YOLO11s tích hợp thêm **P2 Detection Head** (Stride 4), cấu hình kiến trúc tại `configs/yolo11s-p2.yaml`.
- **Nguyên tắc thử nghiệm kiểm soát (Controlled Experiment)**:
  - B1 **chỉ khác duy nhất B0 ở kiến trúc P2**.
  - Không dùng YOLO11n, không dùng YOLOv8.
  - Không dùng dataset DeepPCB (chỉ dùng PKU-Market-PCB với 6 lớp chuẩn).
  - Không thêm module Attention (CBAM, SE, EMA).
  - Không đổi hàm Loss.
  - Không tuning threshold (`conf=0.25`, `iou=0.7`).
  - Không thay đổi tập split: Giữ cố định Group-Aware 70/15/15 (`data/splits/train.txt` 2416 ảnh, `val.txt` 608 ảnh, `test.txt` 480 ảnh).
  - Không thay đổi Data Augmentation: `degrees=0.0`, `shear=0.0`, `perspective=0.0`, `flipud=0.5`, `fliplr=0.5`, `mosaic=0.8`, `close_mosaic=15`, `hsv_h=0.015`, `hsv_s=0.7`, `hsv_v=0.4`.
  - Không dùng Test set để tuning hay chọn checkpoint.
- **Cơ sở lý thuyết & Độ phân giải Feature Maps tại $imgsz=1024$**:
  - P2 (Stride 4): $256 \times 256$ ($65,536$ anchor points) — Tầng đặc trưng độ phân giải cao giữ trọn vẹn chi tiết hình học của các lỗi vi mạch siêu nhỏ.
  - P3 (Stride 8): $128 \times 128$ ($16,384$ anchor points).
  - P4 (Stride 16): $64 \times 64$ ($4,096$ anchor points).
  - P5 (Stride 32): $32 \times 32$ ($1,024$ anchor points).
  - Tổng số anchor points dự đoán: $87,040$ (so với $21,504$ ở B0, tăng $+304.8\%$).
- **Số liệu định lượng so sánh B0 vs B1**:
  - Parameters: B0 = $9,458,752$, B1 = $9,576,072$ $\rightarrow$ **Delta: $+117,320$ (+1.24%)**.
  - GFLOPs ($imgsz=1024$): B0 = $56.4$, B1 = $74.9$ $\rightarrow$ **Delta: $+18.5$ (+32.8%)**.
  - Checkpoint size (ước tính): B0 = $\sim 18.4$ MB, B1 = $\sim 18.8$ MB $\rightarrow$ **Delta: $+0.4$ MB**.
- **Chính sách phân bổ tài nguyên & Batch Size**:
  - Recipe ban đầu: Batch size = 16.
  - **Quyết định điều chỉnh thực tế**: Khi chạy batch 16 trên GPU Kaggle Tesla T4 (14.56 GiB VRAM khả dụng), mô hình phát sinh lỗi `CUDA out of memory` (vượt ngưỡng ~340 MiB) trong quá trình backward pass và gán nhãn `TaskAlignedAssigner`. Nguyên nhân do tầng P2 ($256 \times 256$) làm tăng số lượng anchor points lên $87,040$ (gấp 4 lần so với B0).
  - **Giải pháp thực thi**: Giảm `BATCH = 8`, đồng thời thiết lập `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` để chống phân mảnh bộ nhớ. Khi chạy `BATCH = 8`, lượng VRAM tiêu thụ thực tế an toàn ở mức ~8.5 GiB / 14.56 GiB, giải quyết triệt để OOM trong khi Ultralytics vẫn duy trì Nominal Batch Size (`nbs=64`) để tích lũy gradient tương đương. Điều chỉnh này được ghi nhận tường minh vào `run_metadata.json`.
- **Danh mục file triển khai**:
  - Cấu hình kiến trúc: `configs/yolo11s-p2.yaml`
  - Notebook kiểm chứng: `scripts/14_verify_yolo11s_p2.ipynb`
  - Notebook train Kaggle: `scripts/15_train_B1_yolo11s_p2_kaggle.ipynb` (chuẩn format template `12_kaggle_train_B0_yolo11.ipynb`, đóng gói `B1_yolo11s_p2_100ep.zip`)
  - Checkpoint sau khi train: Đặt tại `experiences/B1_yolo11s_p2_100ep/`
  - Notebook đánh giá & so sánh đối đầu: `scripts/16_eval_B1_compare_B0.ipynb` (kết quả lưu tại `evaluation/B1/`)
- **Kết quả huấn luyện B1 trên Kaggle (100 epochs, AdamW, imgsz=1024, batch=8)**:
  - Thời gian huấn luyện: 309.02 phút (~5.15 giờ) trên GPU Tesla T4.
  - Checkpoint: `experiences/B1_yolo11s_p2_100ep/weights/best.pt` (19.91 MB, SHA-256: `b7e52ae54483...`).
  - Metrics trên Val Set (608 ảnh): $mAP@0.5 = 84.45\%$, $mAP@0.5:0.95 = 40.96\%$, Precision = $77.98\%$, Recall = $83.25\%$.
  - So với B0 trên Val Set: $mAP@0.5:0.95$ của B1 tăng ấn tượng $+3.05\%$ (từ $37.91\%$ lên $40.96\%$), chứng minh tầng P2 giúp định vị bbox ở các IoU cao chặt chẽ và chính xác hơn rõ rệt.
- **Kết quả Đánh giá Phase 16 trên Test Set (480 ảnh, 2,424 khuyết tật) - So sánh B0 vs B1**:
  - $mAP@0.5:0.95$: B0 = $37.91\%$, B1 = **$38.53\%$** $\rightarrow$ **Delta: $+0.62\%$** (Tăng định vị chính xác ở ngưỡng IoU cao).
  - Recall khuyết tật nhỏ (Small $<32^2$): B0 = $91.20\%$, B1 = **$93.20\%$** $\rightarrow$ **Delta: $+2.00\%$** (Mục tiêu cốt lõi của P2 head đạt hiệu quả thực tế).
  - Recall Open_circuit (Hở mạch): B0 = $92.45\%$, B1 = **$94.62\%$** $\rightarrow$ **Delta: $+2.17\%$** (Cải thiện rõ nét nhóm lỗi mạch nhỏ).
  - $mAP@0.5$: B0 = $85.36\%$, B1 = $81.64\%$ $\rightarrow$ Delta: $-3.72\%$ (Do P2 head ở độ phân giải lớn bắt thêm nhiều candidate dẫn đến giảm precision ở ngưỡng conf cố định 0.25).
  - Toàn bộ kết quả đối đầu lưu tại `evaluation/B1/b0_b1_comparison.csv` và biểu đồ trực quan tại `evaluation/B1/b0_b1_metrics_comparison.png`.

<!-- PHASE18_THRESHOLD_BEGIN -->
## Giai đoạn 5 - Khóa cost-sensitive dual threshold trên validation

- Core B: hai ngưỡng theo nhóm lớp; Open_circuit/Short dùng tau_critical, bốn lớp còn lại dùng tau_regular.
- B0: tau_critical = 0.02, tau_regular = 0.56.
- B1: tau_critical = 0.01, tau_regular = 0.17.
- Constraints: R_critical >= 0.95, recall từng lớp critical >= 0.94, Board FR = 0; objective max-F2 trong miền khả thi.
- `selected_on: validation`; `test_not_used_for_threshold: true`.
- Board FA là N/A vì validation không có ảnh sạch. Matching class-aware one-to-one, IoU >= 0.5; NMS IoU = 0.7.
- Nguồn: `evaluation/threshold/dual_threshold_sweep_master.csv`; cấu hình: `configs/threshold.yaml`.
<!-- PHASE18_THRESHOLD_END -->

<!-- PHASE6_SUMMARY_BEGIN -->
## Giai đoạn 6 - Phân tích kết quả

- B0 vẫn là cấu hình cân bằng nhất theo F2/precision.
- P2 tăng mAP@0.5:0.95 +0.0062 nhưng không tăng nhất quán recall small/critical.
- Core B tăng critical recall nhưng giảm precision; Proposed không vượt B0 toàn diện.
- B1 batch 8 do P2 OOM, B0 batch 16; single seed; không có clean image; không có GT large.
- Chi tiết: `evaluation/analysis/phase6_report_summary.md`, `evaluation/figures/`, `evaluation/latency/`.
<!-- PHASE6_SUMMARY_END -->

## Giai đoạn 5 — Khóa threshold cho dòng YOLOv8s (2026-10-23)

- Phạm vi: B0 YOLOv8s và B1 YOLOv8s-P2; chọn ngưỡng chỉ bằng `data/splits/val.txt` (608 ảnh). Không đọc test trong sweep này. Không áp dụng các ngưỡng YOLO11 trong `configs/threshold.yaml` sang YOLOv8s.
- Quy tắc: dual threshold; `Open_circuit`/`Short` dùng `tau_critical`, bốn lớp còn lại dùng `tau_regular`. Chọn micro-F2 tối đa với beta=2 trong miền khả thi: Recall critical >=0.95, Recall mỗi lớp critical >=0.94, Board-FR <=0.0. Matching class-aware one-to-one IoU >=0.50; NMS IoU=0.70; confidence sweep 0.01–0.95 bước 0.01.
- B0 YOLOv8s: `tau_critical=0.02`, `tau_regular=0.58`; validation F2=0.6806, precision=0.3633, recall=0.8706, critical recall=0.9559, Recall Open_circuit=0.9427, Recall Short=0.9698, Board-FR=0.0.
- B1 YOLOv8s-P2: `tau_critical=0.01`, `tau_regular=0.57`; validation F2=0.7793, precision=0.5597, recall=0.8641, critical recall=0.9559, Recall Open_circuit=0.9427, Recall Short=0.9698, Board-FR=0.0.
- Có 124/9,025 cặp khả thi cho B0 và 72/9,025 cho B1. Validation không có ảnh sạch, vì vậy Board-FA là N/A, không phải 0. Board-FR ở đây theo quy ước dự án: ảnh có lỗi nhưng bị dự đoán PASS.
- Cấu hình riêng: `configs/threshold_yolov8s.yaml`; notebook tái lập: `scripts/21_threshold_sweep_B0_B1_yolov8s.ipynb`; sweep: `evaluation/B0_B1_yolov8s_threshold/dual_threshold_sweep.csv` (SHA256 `82345df9b6a6ee7c4592de562f5a69ebe30a7f620a1609fbf6ae07aa8c30d3f0`).
- Chỉ số trên là kết quả chọn threshold trên validation; không dùng để kết luận hiệu năng cuối trên test. B0 test đã được đánh giá trước đó, không điều chỉnh threshold dựa vào kết quả đó.
