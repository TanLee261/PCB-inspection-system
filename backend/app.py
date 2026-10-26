"""FastAPI entry point for six-class PKU PCB inspection."""

import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from predictor import CLASS_NAMES, ModelUnavailable, Predictor
from services.analysis import generate_analysis
from utils import read_image


BASE_DIR = Path(__file__).resolve().parent
RESULTS_DIR = BASE_DIR / "results"
app = FastAPI(title="PCB Inspection API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "PCB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

predictor = Predictor()


def get_predictor() -> Predictor:
    return predictor


@app.get("/")
def home():
    return {"message": "PCB Inspection API", "api": "/api/health"}


@app.get("/api/health")
def health(model: Predictor = Depends(get_predictor)):
    return {"status": "online", **model.status()}


@app.get("/api/model-info")
def model_info(model: Predictor = Depends(get_predictor)):
    return model.info()


@app.post("/api/predict")
async def predict(
    file: UploadFile = File(...),
    profile: str | None = Form(None),
    model: Predictor = Depends(get_predictor),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Chưa chọn ảnh PCB.")
    image = await read_image(file)
    try:
        annotated, detections, model_metadata = await run_in_threadpool(model.predict, image, profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Không thể phân tích ảnh PCB.") from exc

    image_id = uuid4()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / f"{image_id}.jpg").write_bytes(annotated)
    filename = Path(file.filename.replace("\\", "/")).name
    return {
        "status": "success",
        "analysis": generate_analysis(detections, filename),
        "model": model_metadata,
        "detections": detections,
        "image_width": image.width,
        "image_height": image.height,
        "classes": list(CLASS_NAMES),
        "annotated_image_url": f"/api/results/{image_id}.jpg",
    }


@app.get("/api/results/{image_id}.jpg", name="result_image")
def result_image(image_id: UUID):
    path = RESULTS_DIR / f"{image_id}.jpg"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh kết quả.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
