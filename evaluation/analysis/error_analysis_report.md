# Phân tích lỗi YOLOv8s và YOLOv8s-P2

## Giao thức và cách tái lập

- B0: YOLOv8s, conf=0.25; B1: YOLOv8s-P2, conf=0.25. B2 dùng B0 với (critical=0.02, regular=0.58); Proposed dùng B1 với (critical=0.01, regular=0.57).
- 480 ảnh test cố định; 2.424 GT; imgsz=1024, inference conf=0.001, NMS IoU=0.7, max_det=300; matching theo lớp, một-một, greedy theo confidence, IoU>=0.5.
- Size bin từ box GT: area640=w_norm × h_norm × 640²; small < 32², medium <= 96², large > 96². Đây không phải kích thước pixel ảnh gốc hoặc imgsz=1024.
- Thiết bị tái chạy: mps; ultralytics==8.4.153; test split SHA256 `488eed2bd670c39988c741d0214df47ef9b5c4f3ff442eb4259c6f3b7163e459`. Checkpoint được kiểm tra SHA256 với cấu hình threshold đã khóa.
- Bảng tuần 10 được tạo trên Kaggle CUDA (notebook cài ultralytics==8.3.40). Hai bảng dưới đây là số liệu *gốc đã khóa*; ảnh và `detection_errors.csv` là kết quả tái chạy ở môi trường hiện tại. Bảng tái chạy nằm ở `per_class_rerun.csv` và `size_bin_rerun.csv`.
- Chạy lại: mở `scripts/analyze_detection_errors.ipynb` và chọn Run All (cần ultralytics, torch, numpy, Pillow, PyYAML và các ảnh/checkpoint hiện có).

## Kết quả theo kích thước

| Bin | GT | B0 Recall | B1 Recall | B2 Recall | Proposed Recall |
|---|---:|---:|---:|---:|---:|
| small | 2235 | 0.9548 | 0.9289 | 0.9329 | 0.9087 |
| medium | 189 | 0.9153 | 0.8995 | 0.8836 | 0.8413 |
| large | 0 | N/A | N/A | N/A | N/A |

## Kết quả theo lớp

| Lớp | GT | B0 TP/FP/FN | B1 TP/FP/FN | B2 TP/FP/FN | Proposed TP/FP/FN |
|---|---:|---:|---:|---:|---:|
| Missing_hole | 408 | 383/196/25 | 345/90/63 | 383/51/25 | 342/68/66 |
| Mouse_bite | 400 | 378/27/22 | 380/15/20 | 366/4/34 | 362/7/38 |
| Open_circuit | 404 | 392/32/12 | 386/8/18 | 397/418/7 | 396/26/8 |
| Short | 404 | 384/282/20 | 374/295/30 | 392/597/12 | 377/692/27 |
| Spur | 404 | 377/20/27 | 369/23/35 | 343/2/61 | 337/8/67 |
| Spurious_copper | 404 | 393/365/11 | 392/343/12 | 371/249/33 | 376/273/28 |

**Sai khác tái lập:** Có 27 ô đếm GT/TP/FP/FN khác kết quả tuần 10 (chi tiết tại `metric_reproduction_differences.csv`). Không dùng số tái chạy để thay thế chỉ số gốc; ảnh lỗi chỉ là ví dụ theo suy luận ở môi trường hiện tại. Khác biệt môi trường là một khả năng, chưa được xác nhận là nguyên nhân duy nhất.

## Phân tích

- B0→B1: recall small 0.9548 → 0.9289, medium 0.9153 → 0.8995; mAP50-95 0.4222 → 0.3999. Trong test này P2 không cải thiện nhất quán lỗi nhỏ. Missing_hole giảm 38 TP (383→345) và tăng 38 FN (25→63) ở ngưỡng 0.25.
- B0→B2: critical recall 0.9604 → 0.9765, nhưng F2 0.8925 → 0.8486. Open_circuit FP tăng 32→418; Spur FN tăng 27→61.
- B1→Proposed: Short FP tăng 295→692 trong khi Short TP chỉ tăng 374→377; F2 0.8831 → 0.8449. Ngưỡng thấp của lớp critical làm tăng detection sai, ngưỡng regular cao loại bớt các TP có confidence thấp. Xem ví dụ cụ thể ở gallery.
- GT large bằng 0 trên test đang đánh giá nên không thể kết luận về hiệu quả trên large. Không dùng thống kê từ một split/định nghĩa kích thước khác để điền giá trị.

## Nhóm dấu hiệu trên kết quả tái chạy

Các đếm sau đây là từ MPS; đối chiếu sai khác với số liệu gốc trước khi trích dẫn.

| Cấu hình | Loại | Dấu hiệu gợi ý | Số trường hợp |
|---|---|---|---:|
| B0 | FN | below_class_threshold | 65 |
| B0 | FN | localization_below_iou | 36 |
| B0 | FN | no_overlapping_detection | 12 |
| B0 | FN | possible_class_confusion | 4 |
| B0 | FP | localization_below_iou | 74 |
| B0 | FP | no_overlapping_gt | 811 |
| B0 | FP | possible_class_confusion | 17 |
| B0 | FP | possible_duplicate_or_competition | 16 |
| B1 | FN | below_class_threshold | 57 |
| B1 | FN | localization_below_iou | 101 |
| B1 | FN | no_overlapping_detection | 15 |
| B1 | FN | possible_class_confusion | 4 |
| B1 | FP | localization_below_iou | 109 |
| B1 | FP | no_overlapping_gt | 651 |
| B1 | FP | possible_class_confusion | 16 |
| B1 | FP | possible_duplicate_or_competition | 4 |
| B2 | FN | below_class_threshold | 121 |
| B2 | FN | localization_below_iou | 36 |
| B2 | FN | no_overlapping_detection | 12 |
| B2 | FN | possible_class_confusion | 4 |
| B2 | FP | localization_below_iou | 67 |
| B2 | FP | no_overlapping_gt | 1077 |
| B2 | FP | possible_class_confusion | 89 |
| B2 | FP | possible_duplicate_or_competition | 87 |
| Proposed | FN | below_class_threshold | 112 |
| Proposed | FN | localization_below_iou | 101 |
| Proposed | FN | no_overlapping_detection | 15 |
| Proposed | FN | possible_class_confusion | 4 |
| Proposed | FP | localization_below_iou | 164 |
| Proposed | FP | no_overlapping_gt | 889 |
| Proposed | FP | possible_class_confusion | 11 |
| Proposed | FP | possible_duplicate_or_competition | 11 |

- `reason_candidate` chỉ là gợi ý dựa trên dự đoán *sau* NMS. Không thể xác nhận box bị NMS loại hay chất lượng nhãn chỉ từ đầu ra này; muốn kết luận về NMS phải thu thập dự đoán trước NMS.
- So sánh B0/B1 không cô lập hoàn toàn tác động P2 vì hai checkpoint đã được huấn luyện riêng (B0 batch 16, B1 batch 8; một seed).

## Ví dụ FP/FN

Màu xanh lá: GT; đỏ: dự đoán vượt ngưỡng; vàng: box đang xem. Ảnh được crop để quan sát; CSV có đường dẫn ảnh gốc, box, IoU và confidence.

- [b0_tp_b1_fn — Missing_hole, localization_below_iou; ảnh `11_missing_hole_01.jpg`](fp_fn_gallery/b0_tp_b1_fn_01_11_missing_hole_01.jpg) (IoU gần nhất 0.471, confidence gần nhất 0.814).
- [b0_tp_b1_fn — Missing_hole, localization_below_iou; ảnh `11_missing_hole_03.jpg`](fp_fn_gallery/b0_tp_b1_fn_02_11_missing_hole_03.jpg) (IoU gần nhất 0.429, confidence gần nhất 0.779).
- [b0_tp_b1_fn — Missing_hole, localization_below_iou; ảnh `11_missing_hole_04.jpg`](fp_fn_gallery/b0_tp_b1_fn_03_11_missing_hole_04.jpg) (IoU gần nhất 0.460, confidence gần nhất 0.783).
- [b0_tp_b1_fn — Missing_hole, localization_below_iou; ảnh `11_missing_hole_05.jpg`](fp_fn_gallery/b0_tp_b1_fn_04_11_missing_hole_05.jpg) (IoU gần nhất 0.486, confidence gần nhất 0.781).
- [b1_tp_proposed_fn — Missing_hole, below_class_threshold; ảnh `11_missing_hole_04_3.jpg`](fp_fn_gallery/b1_tp_proposed_fn_01_11_missing_hole_04_3.jpg) (IoU gần nhất 0.853, confidence gần nhất 0.364).
- [b1_tp_proposed_fn — Mouse_bite, below_class_threshold; ảnh `11_mouse_bite_02_2.jpg`](fp_fn_gallery/b1_tp_proposed_fn_02_11_mouse_bite_02_2.jpg) (IoU gần nhất 0.716, confidence gần nhất 0.563).
- [b1_tp_proposed_fn — Mouse_bite, below_class_threshold; ảnh `11_mouse_bite_04_1.jpg`](fp_fn_gallery/b1_tp_proposed_fn_03_11_mouse_bite_04_1.jpg) (IoU gần nhất 0.651, confidence gần nhất 0.531).
- [b1_tp_proposed_fn — Mouse_bite, below_class_threshold; ảnh `11_mouse_bite_05.jpg`](fp_fn_gallery/b1_tp_proposed_fn_04_11_mouse_bite_05.jpg) (IoU gần nhất 0.722, confidence gần nhất 0.565).
- [proposed_short_fp — Short, no_overlapping_gt; ảnh `12_spur_09_3.jpg`](fp_fn_gallery/proposed_short_fp_01_12_spur_09_3.jpg) (confidence 0.243, IoU gần nhất 0.000).
- [proposed_short_fp — Short, no_overlapping_gt; ảnh `12_mouse_bite_01_3.jpg`](fp_fn_gallery/proposed_short_fp_02_12_mouse_bite_01_3.jpg) (confidence 0.239, IoU gần nhất 0.000).
- [proposed_short_fp — Short, no_overlapping_gt; ảnh `11_spur_04_2.jpg`](fp_fn_gallery/proposed_short_fp_03_11_spur_04_2.jpg) (confidence 0.237, IoU gần nhất 0.000).
- [proposed_short_fp — Short, no_overlapping_gt; ảnh `12_missing_hole_08_1.jpg`](fp_fn_gallery/proposed_short_fp_04_12_missing_hole_08_1.jpg) (confidence 0.233, IoU gần nhất 0.000).

## Giới hạn và liên hệ đề cương

- Toàn bộ ảnh test đều có lỗi; tỷ lệ ảnh sạch → DEFECTIVE không tính được. Không suy diễn đây là 0% false alarm trên bo mạch sạch.
- B1 thực tế là YOLOv8s-P2 (checkpoint riêng), không phải SAHI/tiling cùng checkpoint như đề cương ban đầu. Sửa phần phương pháp/câu hỏi nghiên cứu để nhất quán; không gán suy giảm cho patch boundary khi không có patch.
- Test chỉ dùng mô tả/giải thích kết quả. Không điều chỉnh ngưỡng, NMS, checkpoint hoặc chọn lại cấu hình theo các ví dụ trong gallery.
