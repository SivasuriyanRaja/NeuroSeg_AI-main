"""
NeuroSeg AI — Backend integration tests.
Uses an in-memory SQLite database. Fixtures are synthetic software tests only.
"""
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PIL import Image

from app.main import app
from app.database import get_db
from app.models import Base, ModelVersion
import uuid

# ─── Test database setup ─────────────────────────────────────────────────────

from sqlalchemy.pool import StaticPool

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _make_png_bytes(w=64, h=64) -> bytes:
    """Synthetic PNG fixture — software test only, not a real MRI."""
    img = Image.new("L", (w, h), 128)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _seed_model(db) -> str:
    m = ModelVersion(
        id=str(uuid.uuid4()),
        name="Test Model",
        architecture="unet_baseline",
        version_tag="test",
        checkpoint_path=None,
        input_size=64,
        is_active=True,
    )
    db.add(m)
    db.commit()
    return m.id


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert "disclaimer" in r.json()


def test_create_case():
    png = _make_png_bytes()
    r = client.post(
        "/api/cases/",
        files={"file": ("test.png", png, "image/png")},
        data={"label": "Test Case", "notes": ""},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["label"] == "Test Case"
    assert any(a["asset_type"] == "original" for a in data["assets"])
    assert any(a["asset_type"] == "thumbnail" for a in data["assets"])
    return data["id"]


def test_list_cases():
    # Create one first
    png = _make_png_bytes()
    client.post(
        "/api/cases/",
        files={"file": ("a.png", png, "image/png")},
        data={"label": "Alpha"},
    )
    r = client.get("/api/cases/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_search_cases():
    png = _make_png_bytes()
    for label in ["alpha", "beta", "gamma"]:
        client.post(
            "/api/cases/",
            files={"file": (f"{label}.png", png, "image/png")},
            data={"label": label},
        )
    r = client.get("/api/cases/?search=beta")
    assert r.status_code == 200
    data = r.json()
    assert any(c["label"] == "beta" for c in data)


def test_duplicate_job_submission():
    db = TestSession()
    model_id = _seed_model(db)
    db.close()

    png = _make_png_bytes()
    case_r = client.post(
        "/api/cases/",
        files={"file": ("dup.png", png, "image/png")},
        data={"label": "Dup"},
    )
    case_id = case_r.json()["id"]

    # First submission should succeed
    r1 = client.post(f"/api/jobs/{case_id}/submit",
                     json={"model_version_id": model_id, "threshold": 0.5})
    assert r1.status_code == 202

    # Duplicate submission should be rejected
    r2 = client.post(f"/api/jobs/{case_id}/submit",
                     json={"model_version_id": model_id, "threshold": 0.5})
    assert r2.status_code == 409


def test_update_case_notes():
    png = _make_png_bytes()
    case_r = client.post(
        "/api/cases/",
        files={"file": ("notes.png", png, "image/png")},
        data={"label": "Notes Test"},
    )
    case_id = case_r.json()["id"]
    r = client.patch(f"/api/cases/{case_id}", json={"notes": "Updated note text."})
    assert r.status_code == 200
    assert r.json()["notes"] == "Updated note text."


def test_delete_case():
    png = _make_png_bytes()
    case_r = client.post(
        "/api/cases/",
        files={"file": ("del.png", png, "image/png")},
        data={"label": "Delete me"},
    )
    case_id = case_r.json()["id"]
    r = client.delete(f"/api/cases/{case_id}")
    assert r.status_code == 204
    r2 = client.get(f"/api/cases/{case_id}")
    assert r2.status_code == 404


def test_reject_oversized_image():
    # Create a large buffer (> 50 MB) — does not need to be a valid image
    large = b"X" * (51 * 1024 * 1024)
    r = client.post(
        "/api/cases/",
        files={"file": ("big.png", large, "image/png")},
        data={"label": "Too big"},
    )
    assert r.status_code == 422


def test_dashboard():
    r = client.get("/api/dashboard/")
    assert r.status_code == 200
    data = r.json()
    assert "total_cases" in data


def test_models_endpoint():
    r = client.get("/api/models/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
