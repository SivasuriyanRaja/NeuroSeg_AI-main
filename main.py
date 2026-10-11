import sys
import os
from pathlib import Path

# Add backend directory to sys.path so 'app' imports resolve correctly
backend_dir = Path(__file__).resolve().parent / "NeuroSeg_AI-main" / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Change current working directory to backend so relative paths (like data/, uploads/, models/) resolve
os.chdir(str(backend_dir))

from app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
