# Methodology and Experiment Plan

## Objective
To develop a robust, local-first research workspace for 2D brain MRI tumour segmentation. The ML pipeline aims to compare a standard U-Net baseline with a custom Compact Encoder-Decoder architecture to evaluate the trade-off between parameter count, inference latency, and segmentation quality (Dice/IoU).

## Data Processing
- **Input:** 2D grayscale MRI slices (PNG/JPEG).
- **Preprocessing:** 
  - Aspect-preserving resize with zero-padding to square dimensions (e.g., 256x256).
  - Intensity normalization using predefined mean and standard deviation.
- **Augmentation (Training only):**
  - Spatial: Random horizontal/vertical flips, random rotation (±15°).
  - Intensity: Random brightness and contrast adjustment.
- **Post-processing:**
  - Probability maps are cropped to remove padding and resized back to the original image dimensions using Lanczos interpolation before thresholding to produce binary masks.

## Architectures

1. **U-Net Baseline**:
   - Standard 4-level encoder-decoder with skip connections.
   - Uses standard 3x3 convolutions with Batch Normalization and ReLU.
   - Reference: Ronneberger et al. (2015).

2. **Compact Encoder-Decoder**:
   - Designed to reduce parameter count and potentially lower inference latency.
   - Replaces standard convolutions with **Depthwise-Separable Convolutions**.
   - Uses a narrower channel profile (starting at 32 features instead of 64).

## Training Strategy
- **Loss Function**: Combined Binary Cross Entropy (BCE) and Soft Dice Loss (weighted equally). This handles class imbalance inherent in medical imaging.
- **Optimizer**: AdamW with learning rate scheduling (Cosine Annealing).
- **Validation**: Early stopping based on Validation Dice Score.
- **Checkpointing**: Both the 'latest' and the 'best' models (by Val Dice) are saved. 
- **Splits**: Strict Train/Val/Test splits defined programmatically and frozen into a JSON manifest to prevent data leakage. Patient identity splitting is recommended if metadata is available.

## Evaluation Metrics
- **Segmentation Quality**: Dice Coefficient, Intersection over Union (IoU), Precision, Recall.
- **Efficiency**: Total parameter count, peak memory usage (if measurable), and 95th percentile (p95) inference latency.

## Experiment Plan
1. **Data Acquisition**: Secure a public paired 2D MRI segmentation dataset (e.g., BraTS slices, or similar).
2. **Baseline Training**: Train `unet_baseline` for 50 epochs.
3. **Candidate Training**: Train `compact_encoder_decoder` using the *exact same data splits* and random seed.
4. **Comparison**: Generate test metrics for both. Document whether the reduced parameter count in the compact model translates to a statistically meaningful latency reduction on CPU, and what penalty is paid in Dice/IoU.
