# Chất lượng–tốc độ: YOLOv8s và YOLOv8s-P2

## Giao thức đo

- Đo lúc 2026-10-26T03:38:13.279483+00:00 trên macOS-15.7-arm64-arm-64bit-Mach-O (arm); PyTorch 2.14.0, Ultralytics 8.4.153, device `mps`.
- Test: 480 ảnh gốc, hash `488eed2bd670c39988c741d0214df47ef9b5c4f3ff442eb4259c6f3b7163e459`; imgsz=1024, batch=1, conf suy luận=0.001, NMS IoU=0.7, max_det=300; warm-up=12, đo 3 lượt/ảnh/checkpoint.
- Đồng bộ thiết bị trước/sau `predict`; end-to-end bao gồm đọc/giải mã ảnh, predict (preprocess, forward, NMS), chuyển box sang CPU và lọc confidence + tạo danh sách kết quả. Không gồm nạp model và warm-up, không gồm ghi CSV/hình.
- Model-only lấy `Results.speed['inference']` của Ultralytics (batch=1), không cộng vào end-to-end lần thứ hai. Median/p95 tính trên 1.440 mẫu ảnh mỗi cấu hình (480 × 3). B0/B2 và B1/Proposed dùng chung suy luận nhưng lọc threshold được bấm giờ độc lập.
- Cột bộ nhớ trên MPS là mức driver allocation cao nhất *được lấy mẫu* trong khi chạy từng checkpoint; không phải GPU peak tuyệt đối.
- Chất lượng (F2, Recall, mAP) giữ nguyên từ `evaluation/B0_B1_yolov8s/week10_primary_metrics.csv` chạy trên Kaggle CUDA. Latency đo trên MPS, nên đây là biểu đồ kết hợp hai môi trường; lần tái chạy tuần trước trên MPS có một số sai khác TP/FP/FN. Không diễn giải biểu đồ thành đánh giá chất lượng và latency đồng thời trên cùng GPU.

## Bảng tổng hợp

| Cấu hình | Model | F2 | R-small | R-critical | mAP50-95 | End-to-end median/p95 (ms) | Model-only median/p95 (ms) | MPS allocation mẫu (MB) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| B0 | B0 | 0.8925 | 0.9548 | 0.9604 | 0.4222 | 85.10 / 116.56 | 40.21 / 50.65 | 1184.5 |
| B1 | B1 | 0.8831 | 0.9289 | 0.9406 | 0.3999 | 99.97 / 138.04 | 49.97 / 68.62 | 1150.9 |
| B2 | B0 | 0.8486 | 0.9329 | 0.9765 | 0.4222 | 85.02 / 116.49 | 40.21 / 50.65 | 1184.5 |
| Proposed | B1 | 0.8449 | 0.9087 | 0.9567 | 0.3999 | 99.89 / 137.97 | 49.97 / 68.62 | 1150.9 |

- Trên MPS, tỷ số latency end-to-end median B1/B0 = **1.17×** (B0 85.10 ms; B1 99.97 ms). P2 không cải thiện Recall small hoặc F2 trên test gốc đã khóa; đánh đổi tăng/giảm latency được mô tả bằng số đo trên phần cứng này.
- B2/Proposed chỉ đổi ngưỡng hậu xử lý; thời gian model-only của mỗi cặp B0/B2 và B1/Proposed là cùng một lần suy luận. Chênh lệch end-to-end nếu có do lượng output và lọc/ngữ cảnh đo, không phải một mạng khác.
- Không áp dụng số patch/ảnh: P2 là thay đổi kiến trúc detection head, không phải SAHI/tiling. Không suy ra FPS thời gian thực nếu chưa đặt ngưỡng ứng dụng.

## Biểu đồ và dữ liệu gốc

- [F2 so với latency](../figures/f2_vs_latency.png)
- [Recall small so với latency](../figures/small_recall_vs_latency.png)
- `per_image_latency.csv`: các thành phần thời gian theo ảnh/lượt/cấu hình.
- `latency_summary.csv`: median/p95 và metric test đã khóa.
- `model_resources.csv`: checkpoint, tham số và bộ nhớ lấy mẫu.
- Tái chạy: mở `scripts/19_benchmark_inference_latency.ipynb` và chọn Run All trong Jupyter. Không thay ngưỡng hay test split.
