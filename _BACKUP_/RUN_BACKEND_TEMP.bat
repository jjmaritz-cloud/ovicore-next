@echo off
cd /d "C:\Projects\OviCore_Next.js\backend"
if not exist .venv py -3.12 -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Starting FastAPI on http://localhost:8000
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
