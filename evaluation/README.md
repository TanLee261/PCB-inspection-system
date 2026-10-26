# Thư mục Đánh giá Mô hình (Evaluation)

Thư mục này lưu trữ các kết quả, bảng chỉ số (metrics) và biểu đồ trực quan hóa đánh giá mô hình sau quá trình huấn luyện theo từng thực nghiệm riêng biệt:

### Cấu trúc thư mục theo từng thực nghiệm:
Mỗi thực nghiệm (B0, B1, B2, ...) sở hữu một thư mục con riêng biệt để tránh ghi đè và lưu trữ khoa học:
- **`evaluation/B0/`**: Kết quả đánh giá Baseline B0 (YOLO11s, imgsz=1024, 100 epochs).
  - **`test_metrics.json`**: Chỉ số $mAP_{50}$, $mAP_{50-95}$, Precision, Recall trên tập Test (480 ảnh) khóa chuẩn Group-aware.
  - **`test_per_class.csv`**: Bảng chỉ số chi tiết cho từng lớp khuyết tật.
  - **`mAP_comparison.png`**: Biểu đồ cột so sánh $mAP_{50}$ và $mAP_{50-95}$ của 6 lớp lỗi.
  - **`confusion_matrix_normalized.png`**: Ma trận nhầm lẫn chuẩn hóa.
  - **`pr_curve.png`**: Đường cong Precision-Recall theo từng lớp lỗi.
  - **`predictions/`**: Ảnh dự đoán mẫu trực quan trên tập kiểm tra thực tế (có nhãn và bounding box).
  - **`runs/`**: Chi tiết logs, đường cong và ma trận sinh từ quá trình validate.
  - **`B0_evaluation_results.zip`**: Gói ZIP nén toàn bộ kết quả của thực nghiệm B0.

### Script thực hiện đánh giá:
- Đánh giá mô hình B0 trên tập Test: Chạy notebook [`scripts/13_eval_B0_yolo11.ipynb`](../scripts/13_eval_B0_yolo11.ipynb).
