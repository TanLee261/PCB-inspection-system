# Roadmap PCB Detection Improve

**Cập nhật:** 2026-10-21  
**Phiên bản sản phẩm mới nhất:** chưa phát hành  
**Trạng thái:** ✅ hoàn tất · 🟡 đang làm/một phần · ⬜ chưa làm · 🔑 cần credential · 🏗 subsystem lớn

## Mục lục

1. [Tổng quan tiến độ](#tổng-quan-tiến-độ)
2. [Việc còn lại](#việc-còn-lại)
3. [Ưu tiên tiếp theo](#ưu-tiên-tiếp-theo)
4. [Cách thêm yêu cầu mới](#cách-thêm-yêu-cầu-mới)
5. [Đã hoàn thành](#đã-hoàn-thành)

## Tổng quan tiến độ

| Module | Phạm vi | Trạng thái | Còn lại |
|---|---|---:|---|
| [M1 Data audit và tương thích](#xong-m1) | PKU/DeepPCB audit, mapping nhãn, chất lượng annotation | ✅ | - |
| [M2 Split và chống leakage](#xong-m2) | Grouping, split, manifest, kiểm tra pHash | 🟡 | Xác minh rõ group theo board prefix và đồng bộ output notebook với manifest hiện hành |
| [M3 Baseline B0](#xong-m3) | YOLO11s baseline, train và đánh giá nội miền | ✅ | - |
| [M4 Cải tiến P2 B1](#xong-m4) | YOLO11s-P2, so sánh với B0 | ✅ | - |
| [M5 Threshold và ablation](#xong-m5) | Threshold trên validation, khóa và so sánh bốn cấu hình | 🟡 | Artifact threshold/ablation hiện không có trong working tree; khôi phục/chạy lại và xác minh theo checkpoint hiện có |
| [M6 Phân tích lỗi và latency](#xong-m6) | FN, latency, Pareto và kết luận RQ | ⬜ | Chưa thấy notebook/output phase 6 trong working tree hiện tại |
| [M7 External test DeepPCB](#xong-m7) | Domain shift trên 5 lớp ánh xạ | ⬜ | Chưa thực hiện; không fine-tune, không chọn threshold ở DeepPCB |
| [M8 Demo ứng dụng](#xong-m8) | Frontend/backend inference PCB | 🟡 | Source có trong repo; cần kiểm thử end-to-end và đối chiếu checkpoint/threshold được phát hành |

## Việc còn lại

### 2.1 Làm tiếp trong phạm vi module hiện có

| Mã | Việc | Khu vực | Trạng thái | Còn lại |
|---|---|---|---:|---|
| <a id="m2"></a>M2 | Xác nhận split không chia cùng board prefix qua train/val/test; làm rõ group augmentation và group board là hai khái niệm; chạy lại notebook để output khớp `split_manifest.json` hiện tại | `scripts/09_make_group_split.ipynb`, `scripts/10_verify_split_leakage.ipynb`, `data/splits/`, `docs/` | 🟡 | Báo cáo hiện PASS cho augmentation group và pHash; chưa có assertion PASS độc lập cho giao board prefix |
| <a id="m5"></a>M5 | Khôi phục hoặc tái tạo threshold sweep/ablation từ checkpoint B0/B1 và ngưỡng được chọn trên validation | `configs/threshold.yaml`, `scripts/17–19*.ipynb`, `evaluation/` | 🟡 | Trong working tree hiện không thấy các notebook 17–19 hay output `evaluation/threshold` và `evaluation/ablation`; kiểm tra backup trước khi chạy lại test |
| <a id="m6"></a>M6 | Hoàn thiện error analysis, FN gallery, latency model-only/end-to-end, Pareto plot và trả lời RQ1–RQ4 | `scripts/20–23*.ipynb`, `evaluation/`, `docs/` | ⬜ | Chưa thấy notebook và artifact tương ứng trong working tree hiện tại |
| <a id="m7"></a>M7 | Đánh giá external domain shift trên DeepPCB bằng checkpoint đã khóa | `data/raw/DeepPCB`, `evaluation/` | ⬜ | Chỉ 5 lớp ánh xạ; không fine-tune và giữ nguyên threshold đã chọn trên PKU validation |
| <a id="m8"></a>M8 | Kiểm thử luồng giao diện-upload-inference-kết quả bằng checkpoint/threshold cuối cùng | `frontend/`, `backend/`, `screenshots/` | 🟡 | Cần ghi nhận môi trường, ca kiểm thử và bằng chứng chạy hoàn chỉnh |

### 2.2 Tính năng/nghiên cứu mới

Chưa có yêu cầu mới ngoài kế hoạch hiện tại.

### 2.3 Cần tài khoản hoặc dịch vụ ngoài 🔑

| Mã | Việc | Trạng thái | Còn lại |
|---|---|---:|---|
| - | Chưa có việc phụ thuộc credential được xác định | - | - |

### 2.4 Subsystem lớn 🏗

| Mã | Việc | Trạng thái | Còn lại |
|---|---|---:|---|
| - | Chưa có subsystem mới ngoài demo frontend/backend đang có | - | - |

## Ưu tiên tiếp theo

1. [M2](#m2): làm rõ và xác minh group theo board prefix trên split hiện dùng; không đổi split nếu chưa đánh giá ảnh hưởng tới các kết quả đã train.
2. [M5](#m5): xác nhận nguồn artifact threshold/ablation hiện bị thiếu trước khi quyết định chạy lại.
3. [M6](#m6): hoàn thành phân tích lỗi và latency sau khi kết quả M5 được xác minh.
4. [M7](#m7): chạy DeepPCB external test sau khi checkpoint, mapping 5 lớp và threshold đã khóa.
5. [M8](#m8): kiểm thử demo với artifact cuối cùng.

## Cách thêm yêu cầu mới

- Yêu cầu thuộc module M1–M8: cập nhật hàng M tương ứng, không cấp mã mới.
- Việc mới ngoài roadmap: cấp mã N tiếp theo, hiện là **N1**, thêm anchor duy nhất dạng `<a id="n1"></a>N1`, cập nhật mục này và ưu tiên nếu được yêu cầu.
- Không tái sử dụng mã đã cấp, kể cả khi việc bị bỏ.
- Chỉ chuyển việc sang mục 5 sau khi đã chạy/kiểm chứng và có artifact hoặc bằng chứng rõ ràng.
- Nếu tạo release version, thêm mục tương ứng vào `docs/changelog.md`; không gán version cho mỗi lần train.

## Đã hoàn thành

### <a id="xong-m1"></a>M1 — Data audit và tương thích

- ✅ Có notebook kiểm kê, validate annotation, size distribution, duplicate/group audit và visual check trong `scripts/01–07`.
- ✅ Có nhận xét mapping PKU–DeepPCB trong `docs/data_audit.md`; nêu rõ `Missing_hole` không tương đương `pin-hole` và không merge hai dataset.

### <a id="xong-m2"></a>M2 — Split và chống leakage

- ✅ Có split files, manifest seed 42 và group rule bỏ hậu tố augmentation `_1/_2/_3` trong `data/splits/`.
- ✅ `docs/leakage_report.md` ghi PASS: 0 augmentation group overlap, 0 pHash pair Hamming `<= 5` bắc split, 0 lỗi toàn vẹn.
- 🟡 Bằng chứng hiện tại chưa khẳng định group ID chính là board vật lý; việc kiểm tra board prefix cần được xác nhận riêng như backlog M2.

### <a id="xong-m3"></a>M3 — Baseline B0

- ✅ Notebook train/eval B0 có trong `scripts/12_kaggle_train_B0_yolo11.ipynb` và `scripts/13_eval_B0_yolo11.ipynb`.
- ✅ Có run YOLO11s trong `experiences/B0_yolo11s_100ep/` và metrics trong `evaluation/B0/`.

### <a id="xong-m4"></a>M4 — Cải tiến P2 B1

- ✅ Có kiến trúc YOLO11s-P2 và notebook kiểm chứng/train/eval trong `configs/yolo11s-p2.yaml` và `scripts/14–16`.
- ✅ Có run B1 trong `experiences/B1_yolo11s_p2_100ep/` và so sánh B0/B1 trong `evaluation/B1/`.
- ✅ Metadata ghi B1 dùng batch 8 do giới hạn VRAM; đây là hạn chế khi diễn giải so sánh.

### <a id="xong-m5"></a>M5 — Threshold và ablation

- 🟡 Có `configs/threshold.yaml` và phần ghi chú quyết định trong `docs/decision_log.md`.
- 🟡 Sweep/ablation artifacts được nhắc trong tài liệu nhưng không hiện diện trong working tree hiện tại; chưa đánh dấu hoàn tất cho tới khi khôi phục hoặc tái tạo và xác minh.

### <a id="xong-m6"></a>M6 — Phân tích lỗi và latency

- ⬜ Chưa có artifact phase 6 trong working tree hiện tại; xem backlog M6.

### <a id="xong-m7"></a>M7 — DeepPCB external test

- ⬜ DeepPCB chưa được dùng làm external test; xem backlog M7.

### <a id="xong-m8"></a>M8 — Demo ứng dụng

- 🟡 Có mã frontend/backend, nhưng roadmap chưa có bằng chứng kiểm thử end-to-end gắn với checkpoint và threshold cuối cùng.
