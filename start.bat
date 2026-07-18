@echo off
REM One-command launcher for CellCount (Windows).
REM Builds the React UI, then runs the whole app from FastAPI on one port.
REM Open http://localhost:8000 when it's ready.

cd /d "%~dp0"

echo [1/2] Building the frontend...
pushd frontend
call npm install
call npm run build
popd

echo [2/2] Starting the app on http://localhost:8000 ...
call .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
