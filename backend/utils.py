"""Validate and orient user-supplied PCB images before inference."""

from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 30_000_000
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


async def read_image(file: UploadFile) -> Image.Image:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.")

    payload = bytearray()
    try:
        while chunk := await file.read(1024 * 1024):
            payload.extend(chunk)
            if len(payload) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Ảnh vượt quá giới hạn 12 MB.")
    finally:
        await file.close()

    if not payload:
        raise HTTPException(status_code=400, detail="Tệp ảnh trống.")
    try:
        with Image.open(BytesIO(payload)) as original:
            if original.format not in ALLOWED_FORMATS:
                raise HTTPException(status_code=415, detail="Định dạng ảnh không hợp lệ.")
            if original.width * original.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Ảnh vượt quá 30 triệu pixel.")
            return ImageOps.exif_transpose(original).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Không đọc được tệp ảnh.") from exc
