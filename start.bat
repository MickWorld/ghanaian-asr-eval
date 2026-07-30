@echo off
rem Ghana ASR Workbench — start backend + frontend (Windows)
cd /d "%~dp0"

if not exist .venv (
  echo First run: creating Python venv and installing backend deps...
  python -m venv .venv
  .venv\Scripts\python -m pip install -r backend\requirements.txt
)
if not exist frontend\node_modules (
  echo First run: installing frontend deps...
  pushd frontend && call npm install && popd
)

start "ASR Workbench backend" cmd /k "cd backend && ..\.venv\Scripts\python -m uvicorn app.main:app --port 8000"
start "ASR Workbench frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul
start http://localhost:5173
