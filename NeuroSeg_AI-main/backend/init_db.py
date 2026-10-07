"""
NeuroSeg AI — Database initialisation script.
Run once: python init_db.py
"""
from app.database import init_db
from app.models import ModelVersion
from app.database import SessionLocal
import uuid

def seed_models():
    """Register the bundled model configurations (no weights yet)."""
    db = SessionLocal()
    try:
        if db.query(ModelVersion).count() == 0:
            models = [
                ModelVersion(
                    id=str(uuid.uuid4()),
                    name="U-Net Baseline",
                    architecture="unet_baseline",
                    version_tag="v1.0",
                    checkpoint_path=None,
                    input_size=256,
                    normalization_mean=0.5,
                    normalization_std=0.5,
                    threshold=0.5,
                    description=(
                        "Standard U-Net with 4 encoder/decoder levels. "
                        "BCE + soft Dice loss, AdamW optimiser. "
                        "Baseline for brain tumour binary segmentation."
                    ),
                    dataset_provenance="No checkpoint bundled. Train with ml/train.py.",
                    is_active=True,
                ),
                ModelVersion(
                    id=str(uuid.uuid4()),
                    name="Compact Encoder-Decoder",
                    architecture="compact_encoder_decoder",
                    version_tag="v1.0",
                    checkpoint_path=None,
                    input_size=256,
                    normalization_mean=0.5,
                    normalization_std=0.5,
                    threshold=0.5,
                    description=(
                        "Narrower encoder-decoder using depthwise-separable convolutions. "
                        "Lower parameter count; speed vs quality trade-off documented "
                        "after comparison with same splits and training budget."
                    ),
                    dataset_provenance="No checkpoint bundled. Train with ml/train.py.",
                    is_active=True,
                ),
            ]
            db.add_all(models)
            db.commit()
            print(f"Seeded {len(models)} model versions.")
        else:
            print("Models already seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    print("Initialising database…")
    init_db()
    seed_models()
    print("Done.")
