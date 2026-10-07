# NeuroSeg AI — MRI Segmentation and Research Workspace

> **For research and education only; not for diagnosis or treatment.**

A complete local research workspace for AI-assisted 2D brain MRI tumour segmentation. Upload a scan, run inference, inspect the predicted region, annotate findings, compare model runs and export research reports — all from a polished browser interface backed by a Python API.

---

## Repository Layout

```
NeuroSeg_AI/
├── frontend/        React + TypeScript + Vite + Tailwind CSS
├── backend/         Python FastAPI (API + job queue)
├── ml/              PyTorch U-Net training & inference
├── tests/           Backend and ML unit/integration tests
├── docs/            Architecture, schema, API docs, methodology
├── data/            Managed data directory (gitignored)
└── scripts/         PowerShell helper scripts
```

---

## Quick Start (Windows / PowerShell)

### Prerequisites

| Tool | Tested version |
|------|---------------|
| Python | 3.11 |
| Node.js | 20 LTS |
| npm | 10 |

CUDA is **optional**. CPU inference works out of the box.

### Setup using script

```powershell
cd C:\Users\sivas\Documents\NeuroSeg_AI
.\scripts\setup.ps1
```

Follow the terminal instructions provided by the script to start the API, Worker, and Frontend.

---

## Environment Variables

Settings are in `backend/.env`.

---

## Disclaimer

NeuroSeg AI is a final-year academic project. Model predictions are **not validated for clinical use**. All outputs are for research and education only.
