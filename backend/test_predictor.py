from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from torch import tensor

import app as api
from predictor import ModelUnavailable, Predictor


class DetectorStub:
    def status(self):
        return {
            "model_loaded": True,
            "model_ready": True,
            "model_error": None,
            "default_profile": "B0",
            "model": "B0 · YOLOv8s (0.25)",
            "models": {"B0": {"ready": True}, "B1": {"ready": True}},
            "classes": list(api.CLASS_NAMES),
        }

    def info(self):
        return {
            **self.status(), "imgsz": 1024, "candidate_confidence": 0.001,
            "nms_iou": 0.7, "selected_on": "validation",
            "profiles": [
                {"id": key, "critical_confidence": tc, "regular_confidence": tr, "ready": True}
                for key, tc, tr in (("B0", .25, .25), ("B1", .25, .25),
                                    ("B2", .02, .58), ("Proposed", .01, .57))
            ],
        }

    def predict(self, image, profile=None):
        if profile not in (None, "B0", "B1", "B2", "Proposed"):
            raise ValueError(f"Cấu hình không hợp lệ: {profile}")
        output = BytesIO()
        image.save(output, format="JPEG")
        return output.getvalue(), [
            {
                "class_id": 0,
                "class_name": "Missing_hole",
                "confidence": 0.92,
                "bbox": [4, 5, 18, 19],
            }
        ], {"profile": profile or "B0", "model": "B0 · YOLOv8s (0.25)",
            "critical_confidence": 0.25, "regular_confidence": 0.25,
            "inference_ms": 12.3}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "RESULTS_DIR", tmp_path)
    api.app.dependency_overrides[api.get_predictor] = lambda: DetectorStub()
    with TestClient(api.app) as test_client:
        yield test_client
    api.app.dependency_overrides.clear()


def image_bytes():
    output = BytesIO()
    Image.new("RGB", (32, 32), "#284d43").save(output, format="PNG")
    return output.getvalue()


def test_predict_returns_real_response_contract_and_annotated_image(client):
    response = client.post(
        "/api/predict",
        files={"file": ("board.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["analysis"]["filename"] == "board.png"
    assert body["analysis"]["status"] == "DEFECTIVE"
    assert body["model"]["profile"] == "B0"
    assert body["analysis"]["distribution"] == {"Missing_hole": 1}
    assert body["detections"][0]["bbox"] == [4, 5, 18, 19]
    assert body["image_width"] == body["image_height"] == 32
    annotated = client.get(body["annotated_image_url"])
    assert annotated.status_code == 200
    assert annotated.headers["content-type"] == "image/jpeg"


def test_missing_model_is_explicit_not_a_demo_prediction(client):
    class Missing(DetectorStub):
        def predict(self, image, profile=None):
            raise ModelUnavailable("Không tìm thấy checkpoint B1")

    api.app.dependency_overrides[api.get_predictor] = lambda: Missing()
    response = client.post(
        "/api/predict",
        files={"file": ("board.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 503
    assert "checkpoint B1" in response.json()["detail"]


@pytest.mark.parametrize(
    ("filename", "payload", "content_type", "expected"),
    [
        ("bad.txt", b"not an image", "text/plain", 415),
        ("bad.png", b"not an image", "image/png", 400),
        ("empty.png", b"", "image/png", 400),
    ],
)
def test_rejects_invalid_images(client, filename, payload, content_type, expected):
    response = client.post(
        "/api/predict",
        files={"file": (filename, payload, content_type)},
    )
    assert response.status_code == expected


def test_pass_does_not_certify_board_quality():
    from services.analysis import generate_analysis

    summary = generate_analysis([], "board.jpg")
    assert summary["status"] == "PASS"
    assert "không thay thế" in summary["recommendation"]


def test_health_check_returns_online_and_model_status(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["model_ready"] is True
    assert data["default_profile"] == "B0"
    assert len(data["classes"]) == 6


def test_model_info_returns_expected_metadata(client):
    response = client.get("/api/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_ready"] is True
    assert data["imgsz"] == 1024
    assert data["candidate_confidence"] == 0.001
    assert len(data["profiles"]) == 4
    assert next(profile for profile in data["profiles"] if profile["id"] == "Proposed")["critical_confidence"] == 0.01
    assert data["nms_iou"] == 0.7


def test_locked_profile_thresholds(monkeypatch):
    monkeypatch.delenv("PCB_DEFAULT_PROFILE", raising=False)
    model = Predictor()
    assert model.thresholds("B0") == model.thresholds("B1") == (.25, .25)
    assert model.thresholds("B2") == (.02, .58)
    assert model.thresholds("Proposed") == (.01, .57)
    assert model.confidence == .001
    assert model.status()["models"]["B0"]["ready"] is True
    assert model.status()["models"]["B1"]["ready"] is True


def test_profile_is_returned_and_invalid_profile_rejected(client):
    response = client.post(
        "/api/predict", data={"profile": "Proposed"},
        files={"file": ("board.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["model"]["profile"] == "Proposed"
    invalid = client.post(
        "/api/predict", data={"profile": "YOLO11"},
        files={"file": ("board.png", image_bytes(), "image/png")},
    )
    assert invalid.status_code == 400


def test_actual_predictor_filters_by_locked_class_thresholds(monkeypatch):
    model = Predictor()
    class FakeYOLO:
        def predict(self, **kwargs):
            assert kwargs["conf"] == 0.001
            assert kwargs["imgsz"] == 1024
            assert kwargs["iou"] == 0.7
            boxes = [
                SimpleNamespace(cls=tensor([cid]), conf=tensor([score]),
                                xyxy=tensor([[1, 1, 12, 12]]))
                for cid, score in ((0, .55), (0, .60), (2, .015), (3, .009))
            ]
            return [SimpleNamespace(boxes=boxes)]

    selected_models = []
    def fake_get_model(key):
        selected_models.append(key)
        return FakeYOLO()

    monkeypatch.setattr(model, "_get_model", fake_get_model)
    image = Image.new("RGB", (32, 32))
    for profile, expected in (("B0", [0, 0]), ("B1", [0, 0]),
                              ("B2", [0]), ("Proposed", [0, 2])):
        annotated, detections, info = model.predict(image, profile)
        assert [d["class_id"] for d in detections] == expected
        assert annotated.startswith(b"\xff\xd8")
        assert info["profile"] == profile
        assert info["model_key"] == ("B1" if profile in ("B1", "Proposed") else "B0")
    assert selected_models == ["B0", "B1", "B0", "B1"]
