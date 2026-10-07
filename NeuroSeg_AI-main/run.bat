@echo off
echo ========================================
echo  NeuroSeg AI — Full Stack Launcher
echo ========================================

REM Kill any old instances on these ports first
echo [1/3] Cleaning up old processes on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" 2^>nul') do taskkill /f /pid %%a 2>nul

REM Seed DB in case it's empty
echo [2/3] Seeding database...
cd backend
C:\Users\sivas\AppData\Local\Programs\Python\Python313\python.exe init_db.py
cd ..

REM Start backend API
echo [3/3] Starting Backend API on port 8000...
start "NeuroSeg Backend" cmd /k "cd backend && C:\Users\sivas\AppData\Local\Programs\Python\Python313\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

REM Wait 3 seconds for backend to be up before starting worker
ping 127.0.0.1 -n 4 > nul

REM Start inference worker
echo [4/4] Starting Inference Worker...
start "NeuroSeg Worker" cmd /k "cd backend && C:\Users\sivas\AppData\Local\Programs\Python\Python313\python.exe -m app.worker"

REM Start frontend
echo [5/5] Starting Frontend...
cd frontend
npm run dev
