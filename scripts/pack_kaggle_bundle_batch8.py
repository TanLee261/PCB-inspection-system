#!/usr/bin/env python3
"""
pack_kaggle_bundle_batch8.py
============================
Đóng gói project-data bundle cho notebook 17_train_B0_yolo11s_batch8_kaggle.ipynb.

Bundle bao gồm:
  - configs/base.yaml
  - data/splits/train.txt
  - data/splits/val.txt
  - split_info.json   (checksums MD5 của train.txt và val.txt)

Bundle KHÔNG chứa ảnh PKU (dataset ảnh được mount riêng trên Kaggle).

Cách dùng:
  cd /Users/duytan/orca/projects/PCB-DetectionImprove
  python scripts/pack_kaggle_bundle_batch8.py

Output:
  dist/pcb_b0_yolo11s_batch8_project_data.zip
  → Upload file này lên Kaggle dưới dạng "Dataset".
  → Trong Notebook Kaggle, Add Input cả PKU dataset và dataset vừa upload; bật GPU.
"""

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

# ── Đường dẫn project ────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent   # thư mục gốc project

CONFIGS_YAML  = PROJECT_ROOT / "configs" / "base.yaml"
TRAIN_TXT     = PROJECT_ROOT / "data" / "splits" / "train.txt"
VAL_TXT       = PROJECT_ROOT / "data" / "splits" / "val.txt"

BUNDLE_NAME   = "pcb_b0_yolov8s_batch16_project_data"
DIST_DIR      = PROJECT_ROOT / "dist"
OUT_ZIP       = DIST_DIR / f"{BUNDLE_NAME}.zip"

# ── Kiểm tra file nguồn ──────────────────────────────────────────────────────
for p in [CONFIGS_YAML, TRAIN_TXT, VAL_TXT]:
    if not p.is_file():
        raise FileNotFoundError(f"Không tìm thấy: {p}")

# ── Tính checksum MD5 cho split files ────────────────────────────────────────
def md5sum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

split_info = {
    "train_txt_md5": md5sum(TRAIN_TXT),
    "val_txt_md5"  : md5sum(VAL_TXT),
    "description"  : (
        "PCB group-aware split 70/15/15 — train=2416, val=608. "
        "Checksums đảm bảo split không bị sửa đổi khi upload lên Kaggle."
    ),
    "bundle_for"   : "17_train_B0_yolo11s_batch8_kaggle.ipynb",
}

print("=== PCB Kaggle Bundle Packer (YOLOv8s batch 16) ===")
print(f"configs/base.yaml : {CONFIGS_YAML}")
print(f"data/splits/train.txt (md5={split_info['train_txt_md5'][:8]}...)")
print(f"data/splits/val.txt   (md5={split_info['val_txt_md5'][:8]}...)")

# ── Tạo thư mục dist ─────────────────────────────────────────────────────────
DIST_DIR.mkdir(parents=True, exist_ok=True)
if OUT_ZIP.exists():
    OUT_ZIP.unlink()
    print(f"\n⚠️  Xóa bundle cũ: {OUT_ZIP.name}")

# ── Đóng gói ZIP ─────────────────────────────────────────────────────────────
with zipfile.ZipFile(OUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    # configs/base.yaml → pcb_b0_yolo11s_batch8_project_data/configs/base.yaml
    zf.write(CONFIGS_YAML, f"{BUNDLE_NAME}/configs/base.yaml")

    # data/splits/train.txt → pcb_b0_yolo11s_batch8_project_data/data/splits/train.txt
    zf.write(TRAIN_TXT, f"{BUNDLE_NAME}/data/splits/train.txt")

    # data/splits/val.txt → pcb_b0_yolo11s_batch8_project_data/data/splits/val.txt
    zf.write(VAL_TXT, f"{BUNDLE_NAME}/data/splits/val.txt")

    # split_info.json (checksum) → pcb_b0_yolo11s_batch8_project_data/split_info.json
    zf.writestr(
        f"{BUNDLE_NAME}/split_info.json",
        json.dumps(split_info, indent=2, ensure_ascii=False)
    )

# ── Verify ZIP ────────────────────────────────────────────────────────────────
with zipfile.ZipFile(OUT_ZIP) as zf:
    bad = zf.testzip()
    if bad:
        raise RuntimeError(f"ZIP bị hỏng tại: {bad}")

    members = sorted(zf.namelist())

# ── In kết quả ───────────────────────────────────────────────────────────────
size_mb = OUT_ZIP.stat().st_size / 1e6
print(f"\n✅ Bundle tạo thành công: {OUT_ZIP}")
print(f"   Kích thước: {size_mb:.2f} MB")
print("\nNội dung bundle:")
with zipfile.ZipFile(OUT_ZIP) as zf:
    for name in members:
        info = zf.getinfo(name)
        print(f"  {name:65s}  {info.file_size/1024:7.1f} KB")

print("""
╔══════════════════════════════════════════════════════════════════╗
║  HƯỚNG DẪN UPLOAD LÊN KAGGLE                                    ║
╠══════════════════════════════════════════════════════════════════╣
║  1. Vào https://www.kaggle.com/datasets/new                      ║
║  2. Upload file: dist/pcb_b0_yolov8s_batch16_project_data.zip    ║
║  3. Đặt tên dataset (vd: pcb-kaggle-b0-yolov8s-batch16)         ║
║  4. Chọn "Private" → Create                                      ║
║                                                                  ║
║  Trong Kaggle Notebook:                                          ║
║  - Add Input: PKU dataset (liuxiaolong1/pcb-defect-detection...) ║
║  - Add Input: dataset bundle vừa upload                          ║
║  - Bật Accelerator: GPU T4 x2 hoặc P100                         ║
║  - Chạy notebook 17_train_B0_yolo11s_batch8_kaggle.ipynb        ║
╚══════════════════════════════════════════════════════════════════╝
""")
