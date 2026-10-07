# NeuroSeg AI — PowerShell Quick Start (Windows)
# Run from the NeuroSeg_AI root directory

Write-Host "=== NeuroSeg AI — Quick Start ===" -ForegroundColor Cyan
Write-Host "For research and education only." -ForegroundColor Yellow
Write-Host ""

# ─── Backend venv ────────────────────────────────────────────────────────────
Write-Host "Step 1: Setting up backend virtual environment..." -ForegroundColor Green
Set-Location backend
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1

Write-Host "Step 2: Installing backend dependencies..." -ForegroundColor Green
pip install -r requirements.txt --quiet

Write-Host "Step 3: Initialising database and seeding models..." -ForegroundColor Green
python init_db.py

Write-Host ""
Write-Host "=== READY ===" -ForegroundColor Cyan
Write-Host "To start the system, open THREE terminal tabs:" -ForegroundColor White
Write-Host ""
Write-Host "  Tab 1 (API server):" -ForegroundColor Yellow
Write-Host "    cd backend; .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -ForegroundColor Gray
Write-Host ""
Write-Host "  Tab 2 (Analysis worker):" -ForegroundColor Yellow
Write-Host "    cd backend; .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "    python -m app.worker" -ForegroundColor Gray
Write-Host ""
Write-Host "  Tab 3 (Frontend):" -ForegroundColor Yellow
Write-Host "    cd frontend; npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Then open: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Optional — train a model:" -ForegroundColor White
Write-Host "    cd ml; python train.py --config configs/unet_baseline.yaml" -ForegroundColor Gray
Write-Host ""

Set-Location ..
