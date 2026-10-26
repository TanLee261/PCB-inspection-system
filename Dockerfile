FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PCB_PROJECT_ROOT=/app \
    PCB_DEVICE=cpu

WORKDIR /app

# OpenCV/Ultralytics runtime libraries; CPU inference works without CUDA.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY configs/threshold_yolov8s.yaml ./configs/threshold_yolov8s.yaml

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
