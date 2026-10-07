import logging
from pathlib import Path
from ml.dataset import PairedSegmentationDataset

logging.basicConfig(level=logging.INFO)

ds = PairedSegmentationDataset(
    image_dir=Path("data/dataset"),
    mask_dir=Path("data/dataset"),
    input_size=256
)

print(f"Total pairs found: {len(ds)}")
if len(ds) > 0:
    print(f"Sample 0: {ds.pairs[0]}")
