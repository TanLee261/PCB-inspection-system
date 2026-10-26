#!/usr/bin/env python3
"""
pack_kaggle_compare_bundle.py
=============================
Đóng gói toàn bộ các thông số, cấu hình ngưỡng và trọng số model cần thiết
để chạy notebook 17_compare_B0_B1_B2_Proposed_yolov8s.ipynb trên Kaggle.

Bundle bao gồm:
  - configs/threshold_yolov8s.yaml (Cấu hình ngưỡng bị khóa tau_critical & tau_regular)
  - configs/base.yaml
  - configs/yolov8s-p2.yaml
  - data/splits/test.txt (480 ảnh test độc lập)
  - data/splits/val.txt
  - data/splits/train.txt
  - data/data.yaml
  - runs/B0_yolov8s_100ep_batch16/weights/best.pt (Checkpoint B0 đã khóa hash)
  - runs/B1_yolov8s_p2_100ep/weights/best.pt (Checkpoint B1-P2 đã khóa hash)
  - evaluation/B0_yolov8s/test_eval_split.txt (Dùng để verify tính toàn vẹn test split)
  - evaluation/B0_yolov8s/test_metrics.json (Artifact B0 trước đó)
  - split_info.json (MD5 & SHA256 checksums)

Cách dùng:
  python scripts/pack_kaggle_compare_bundle.py

Output:
  dist/pcb_compare_yolov8s_bundle.zip (~38 MB)
  -> Upload file này lên Kaggle dưới dạng "New Dataset" (ví dụ đặt tên: pcb-compare-yolov8s-bundle)
"""

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

BUNDLE_NAME = "pcb_compare_yolov8s_bundle"
DIST_DIR = PROJECT_ROOT / "dist"
OUT_ZIP = DIST_DIR / f"{BUNDLE_NAME}.zip"

# Danh sách các file cấu hình và dữ liệu
REQUIRED_FILES = [
    PROJECT_ROOT / "configs" / "threshold_yolov8s.yaml",
    PROJECT_ROOT / "configs" / "base.yaml",
    PROJECT_ROOT / "configs" / "yolov8s-p2.yaml",
    PROJECT_ROOT / "data" / "splits" / "test.txt",
    PROJECT_ROOT / "data" / "splits" / "val.txt",
    PROJECT_ROOT / "data" / "splits" / "train.txt",
    PROJECT_ROOT / "data" / "data.yaml",
    PROJECT_ROOT / "runs" / "B0_yolov8s_100ep_batch16" / "weights" / "best.pt",
    PROJECT_ROOT / "runs" / "B1_yolov8s_p2_100ep" / "weights" / "best.pt",
    PROJECT_ROOT / "evaluation" / "B0_yolov8s" / "test_eval_split.txt",
    PROJECT_ROOT / "evaluation" / "B0_yolov8s" / "test_metrics.json",
]

# Kiểm tra sự tồn tại của tất cả các file
for f in REQUIRED_FILES:
    if not f.is_file():
        raise FileNotFoundError(f"Thiếu file bắt buộc: {f}")

def sha256sum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def md5sum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

# Kiểm tra tính khớp nối với configs/threshold_yolov8s.yaml
import yaml
thresh_cfg = yaml.safe_load((PROJECT_ROOT / "configs" / "threshold_yolov8s.yaml").read_text())
b0_hash = sha256sum(PROJECT_ROOT / "runs" / "B0_yolov8s_100ep_batch16" / "weights" / "best.pt")
b1_hash = sha256sum(PROJECT_ROOT / "runs" / "B1_yolov8s_p2_100ep" / "weights" / "best.pt")

assert b0_hash == thresh_cfg['models']['B0']['checkpoint_sha256'], "Hash B0 không khớp threshold_yolov8s.yaml!"
assert b1_hash == thresh_cfg['models']['B1']['checkpoint_sha256'], "Hash B1 không khớp threshold_yolov8s.yaml!"

manifest = {
    "bundle_name": BUNDLE_NAME,
    "description": "Bundle đầy đủ cho thí nghiệm so sánh B0, B1, B2 và Proposed (YOLOv8s) trên Kaggle.",
    "checkpoints": {
        "B0_yolov8s": {
            "path": "runs/B0_yolov8s_100ep_batch16/weights/best.pt",
            "sha256": b0_hash,
            "tau_critical": thresh_cfg['models']['B0']['tau_critical'],
            "tau_regular": thresh_cfg['models']['B0']['tau_regular'],
        },
        "B1_yolov8s_p2": {
            "path": "runs/B1_yolov8s_p2_100ep/weights/best.pt",
            "sha256": b1_hash,
            "tau_critical": thresh_cfg['models']['B1']['tau_critical'],
            "tau_regular": thresh_cfg['models']['B1']['tau_regular'],
        }
    },
    "splits": {
        "test_txt_md5": md5sum(PROJECT_ROOT / "data" / "splits" / "test.txt"),
        "test_txt_sha256": sha256sum(PROJECT_ROOT / "data" / "splits" / "test.txt"),
        "test_images_count": 480
    }
}

print("=== Đóng Gói Bundle So Sánh YOLOv8s (B0, B1, B2, Proposed) ===")
print(f"B0 checkpoint SHA256 : {b0_hash[:16]}... (Khớp locked config)")
print(f"B1 checkpoint SHA256 : {b1_hash[:16]}... (Khớp locked config)")
print(f"Test split images    : 480 ảnh (md5={manifest['splits']['test_txt_md5'][:8]}...)")

DIST_DIR.mkdir(parents=True, exist_ok=True)
if OUT_ZIP.exists():
    OUT_ZIP.unlink()
    print(f"⚠️  Xóa bundle cũ: {OUT_ZIP.name}")

with zipfile.ZipFile(OUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for f in REQUIRED_FILES:
        rel_path = f.relative_to(PROJECT_ROOT)
        arcname = f"{BUNDLE_NAME}/{rel_path}"
        zf.write(f, arcname)
        print(f"  + {arcname} ({f.stat().st_size / 1024:.1f} KB)")
        
    zf.writestr(
        f"{BUNDLE_NAME}/split_info.json",
        json.dumps(manifest, indent=2, ensure_ascii=False)
    )

with zipfile.ZipFile(OUT_ZIP) as zf:
    bad = zf.testzip()
    if bad:
        raise RuntimeError(f"ZIP lỗi tại: {bad}")
    members = sorted(zf.namelist())

size_mb = OUT_ZIP.stat().st_size / 1e6
print(f"\n✅ Đóng gói thành công: {OUT_ZIP}")
print(f"   Kích thước bundle: {size_mb:.2f} MB")
print(f"   Tổng số files    : {len(members)}")

print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║  HƯỚNG DẪN ĐƯA LÊN KAGGLE ĐỂ CHẠY                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  1. Vào Kaggle: https://www.kaggle.com/datasets/new                          ║
║  2. Upload file vừa tạo: dist/pcb_compare_yolov8s_bundle.zip                 ║
║  3. Đặt Title: pcb-compare-yolov8s-bundle  (Private -> Create)              ║
║                                                                              ║
║  Trong Kaggle Notebook (chạy file 17_compare_B0_B1_B2_Proposed_yolov8s.ipynb)║
║  - Add Input 1: Dataset ảnh PKU (liuxiaolong1/pcb-defect-detection-dataset)  ║
║  - Add Input 2: Dataset bundle vừa upload (pcb-compare-yolov8s-bundle)       ║
║  - Accelerator: GPU T4 x2 (hoặc GPU T4)                                      ║
║  - Bấm Run All!                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
""")
