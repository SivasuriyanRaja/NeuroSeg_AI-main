# Start the FastAPI Backend Server in the background
Start-Process powershell -ArgumentList "-NoExit -Command `"cd backend; C:\Users\sivas\AppData\Local\Programs\Python\Python313\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`""

# Start the Inference Worker in the background
Start-Process powershell -ArgumentList "-NoExit -Command `"cd backend; C:\Users\sivas\AppData\Local\Programs\Python\Python313\python.exe -m app.worker`""

# Start the React Frontend Server
cd frontend
npm run dev
