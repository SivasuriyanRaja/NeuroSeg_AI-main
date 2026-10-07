# Demo Checklist & Status

## Software Implementation Checklist
- [x] **Frontend Shell**: React/Vite/Tailwind configured, sidebar, routing.
- [x] **Backend API**: FastAPI framework, SQLAlchemy ORM, SQLite DB setup.
- [x] **API Endpoints**: CRUD for cases, jobs, models, and dashboard stats.
- [x] **Job Queue**: Local SQLite-backed queue with atomic claiming.
- [x] **Analysis Worker**: Dedicated Python process for polling and running inference.
- [x] **ML Pipeline (Training)**: U-Net and Compact model definitions, BCE+Dice loss, `train.py` CLI.
- [x] **ML Pipeline (Inference)**: Inference engine with deterministic pre/post-processing matching training.
- [x] **Viewer Workspace**: Linked zoom/pan image viewer for original/overlay/mask.
- [x] **Reporting**: Deterministic PDF, JSON, CSV generation and ZIP packaging.
- [x] **Tests**: Backend API integration tests and ML unit tests.
- [x] **Startup Script**: `scripts/setup.ps1` for easy local Windows execution.

## Unexecuted ML Runs (Dependent on external data)
Because this workspace is shipped as fresh software without pre-bundled medical images (to respect data licenses and privacy), the following ML steps remain unexecuted:

1. **Dataset Acquisition**: Download a compliant dataset (e.g., BraTS) into `data/train/images` and `data/train/masks`.
2. **Train U-Net Baseline**:
   `python ml/train.py --config ml/configs/unet_baseline.yaml`
3. **Train Compact Model**:
   `python ml/train.py --config ml/configs/compact_model.yaml`
4. **Register Weights**: Update `ModelVersion.checkpoint_path` in the SQLite DB via script or DB browser to point to the resulting `.pt` files.

*Currently, submitting an analysis will use the defined architectures initialized with **random weights** to demonstrate the software pipeline end-to-end without failing. The UI displays a warning when this occurs.*

## Demo Flow
1. Run `.\scripts\setup.ps1` and launch the 3 required terminals (API, Worker, Frontend).
2. Open `http://localhost:5173`.
3. View the **Dashboard** empty state.
4. Go to **Analyze**, drag and drop any test image (PNG/JPEG).
5. Ensure the "U-Net Baseline" is selected. Click **Analyze MRI**.
6. Watch the job status poll (queued -> running -> completed).
7. Upon completion, you will be redirected to the **Case Detail** view.
8. Use the **View Tabs** (Original, Overlay, Mask, Prob Map) and test zoom/pan.
9. Adjust the **Opacity** slider.
10. Click **PDF** in the top right to download a generated research report.
11. Go to **Experiments** to see the registered models (training curves will be empty until real training occurs).
12. Go to **Settings** to verify local storage sizes and CUDA availability.
