#!/usr/bin/env python3
"""
pack_kaggle_bundle_v8s_p2.py
============================
Đóng gói project-data bundle cho thí nghiệm B1: YOLOv8s-P2 trên Kaggle.

Bundle bao gồm:
  - configs/base.yaml
  - configs/yolov8s-p2.yaml
  - data/splits/train.txt
  - data/splits/val.txt
  - split_info.json   (checksums MD5 của train.txt và val.txt)

Bundle KHÔNG chứa ảnh PKU (dataset ảnh được mount riêng trên Kaggle).

Cách dùng:
  cd /Users/duytan/orca/projects/PCB-DetectionImprove
  python scripts/pack_kaggle_bundle_v8s_p2.py

Output:
  dist/pcb_b1_yolov8s_p2_project_data.zip
  → Upload file này lên Kaggle dưới dạng "New Dataset".
"""

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

PROJECT_ROOT  = Path(__file__).resolve().parent.parent

CONFIGS_BASE  = PROJECT_ROOT / "configs" / "base.yaml"
CONFIGS_P2    = PROJECT_ROOT / "configs" / "yolov8s-p2.yaml"
TRAIN_TXT     = PROJECT_ROOT / "data" / "splits" / "train.txt"
VAL_TXT       = PROJECT_ROOT / "data" / "splits" / "val.txt"

BUNDLE_NAME   = "pcb_b1_yolov8s_p2_project_data"
DIST_DIR      = PROJECT_ROOT / "dist"
OUT_ZIP       = DIST_DIR / f"{BUNDLE_NAME}.zip"

for p in [CONFIGS_BASE, CONFIGS_P2, TRAIN_TXT, VAL_TXT]:
    if not p.is_file():
        raise FileNotFoundError(f"Không tìm thấy: {p}")

def md5sum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

split_info = {
    "train_txt_md5": md5sum(TRAIN_TXT),
    "val_txt_md5"  : md5sum(VAL_TXT),
    "description"  : (
        "PCB group-aware split 70/15/15 — train=2416, val=608. "
        "Checksums đảm bảo split không bị sửa đổi khi upload lên Kaggle."
    ),
    "bundle_for"   : "19_B1_sahi_kaggle.ipynb / YOLOv8s-P2 Training",
}

print("=== PCB Kaggle Bundle Packer (YOLOv8s-P2 B1) ===")
print(f"configs/base.yaml       : {CONFIGS_BASE}")
print(f"configs/yolov8s-p2.yaml : {CONFIGS_P2}")
print(f"data/splits/train.txt   : md5={split_info['train_txt_md5'][:8]}...")
print(f"data/splits/val.txt     : md5={split_info['val_txt_md5'][:8]}...")

DIST_DIR.mkdir(parents=True, exist_ok=True)
if OUT_ZIP.exists():
    OUT_ZIP.unlink()
    print(f"\n⚠️  Xóa bundle cũ: {OUT_ZIP.name}")

with zipfile.ZipFile(OUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.write(CONFIGS_BASE, f"{BUNDLE_NAME}/configs/base.yaml")
    zf.write(CONFIGS_P2,   f"{BUNDLE_NAME}/configs/yolov8s-p2.yaml")
    zf.write(TRAIN_TXT,    f"{BUNDLE_NAME}/data/splits/train.txt")
    zf.write(VAL_TXT,      f"{BUNDLE_NAME}/data/splits/val.txt")
    zf.writestr(
        f"{BUNDLE_NAME}/split_info.json",
        json.dumps(split_info, indent=2, ensure_ascii=False)
    )

with zipfile.ZipFile(OUT_ZIP) as zf:
    bad = zf.testzip()
    if bad:
        raise RuntimeError(f"ZIP bị hỏng tại: {bad}")
    members = sorted(zf.namelist())

size_mb = OUT_ZIP.stat().st_size / 1e6
print(f"\n✅ Bundle tạo thành công: {OUT_ZIP}")
print(f"   Kích thước: {size_mb:.2f} MB")
print("\nDanh sách file trong ZIP:")
for m in members:
    print(f"  • {m}")
