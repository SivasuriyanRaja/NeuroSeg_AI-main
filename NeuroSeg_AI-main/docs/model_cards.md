# Dataset & Model Cards

## Dataset Card Template

*If an external dataset is used, fill this out prior to training.*

**Dataset Name:** [e.g., BraTS 2D Slices subset]
**Provenance:** [Link to source, e.g., Kaggle, TCIA]
**License:** [e.g., CC BY-NC-SA 4.0]
**Size:** [Total images, total positive cases]
**Characteristics:**
- Image Modality: [e.g., T1ce MRI]
- Image Dimensions: [e.g., 240x240]
- Annotation Format: [Binary Mask / COCO JSON]

**Known Limitations:**
- Patient splitting constraints (e.g., slice-level splitting may cause data leakage if patient IDs are unknown).
- Missing annotations do not guarantee a healthy scan.

---

## Model Card: U-Net Baseline

**Architecture:** U-Net (4 levels)
**Intended Use:** Research baseline for 2D brain MRI tumor segmentation. **Not for clinical use.**
**Input:** 1-channel Grayscale, 256x256
**Output:** 1-channel Logit map (apply Sigmoid)
**Parameters:** ~7.7M (configurable based on base features)

**Performance:**
*To be filled after running `ml/train.py`.*
- Test Dice: 
- Test IoU: 
- CPU Latency (p95): 

---

## Model Card: Compact Encoder-Decoder

**Architecture:** Custom depthwise-separable encoder-decoder.
**Intended Use:** Edge-device/CPU optimized research model. **Not for clinical use.**
**Input:** 1-channel Grayscale, 256x256
**Output:** 1-channel Logit map (apply Sigmoid)
**Parameters:** ~0.5M (configurable)

**Performance:**
*To be filled after running `ml/train.py`.*
- Test Dice: 
- Test IoU: 
- CPU Latency (p95): 
