import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "NeuroSeg_AI-main" / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.chdir(str(backend_dir))

from app.database import init_db
from app.models import ModelVersion
import uuid

def seed_models():
    """Register the single unified NeuroSeg Fusion Engine."""
    legacy_names = ["U-Net Baseline", "Compact Encoder-Decoder", "DenseNet121 Classifier"]
    for name in legacy_names:
        try:
            existing = ModelVersion.objects(name=name).first()
            if existing:
                existing.delete()
                print(f"Removed legacy model: {name}")
        except Exception as e:
            pass

    try:
        if not ModelVersion.objects(name="NeuroSeg Fusion Engine").first():
            fusion = ModelVersion(
                id=str(uuid.uuid4()),
                name="NeuroSeg Fusion Engine",
                architecture="fusion_engine",
                version_tag="v3.0",
                checkpoint_path=None,
                input_size=256,
                normalization_mean=0.5,
                normalization_std=0.5,
                threshold=0.5,
                description=(
                    "Unified AI engine combining GPT-4o Vision (classification + bbox) "
                    "with OpenCV GrabCut segmentation for pixel-perfect masks. "
                    "Handles all tumor types: glioblastoma, glioma, meningioma, "
                    "metastasis, pituitary, low-grade glioma."
                ),
                dataset_provenance="GPT-4o Vision API + OpenCV GrabCut. No local checkpoint required.",
                is_active=True,
            )
            fusion.save()
            print("Seeded NeuroSeg Fusion Engine.")
        else:
            print("NeuroSeg Fusion Engine already exists.")
    except Exception as e:
        print(f"Model seed notice: {e}")

if __name__ == "__main__":
    print("Initialising database from root...")
    try:
        init_db()
        seed_models()
        print("Database initialisation complete.")
    except Exception as e:
        print(f"Database init notice: {e}")
