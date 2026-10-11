import sys
import os
from pathlib import Path

# Automatically inject backend directory into sys.path for any python or uvicorn command
backend_dir = Path(__file__).resolve().parent / "NeuroSeg_AI-main" / "backend"
if backend_dir.exists() and str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
