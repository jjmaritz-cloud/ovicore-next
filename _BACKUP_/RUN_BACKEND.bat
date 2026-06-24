@echo off
title OviCore Backend - FastAPI SQLite
cd /d "C:\Projects\OviCore_Next.js\backend"
echo Starting OviCore backend...
echo.
if not exist .venv py -3.12 -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Backend starting on http://localhost:8000
echo.
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
echo.
echo Backend stopped.
pause
