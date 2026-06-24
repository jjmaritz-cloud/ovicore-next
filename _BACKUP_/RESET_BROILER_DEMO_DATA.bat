@echo off
setlocal

title Reset OviCore Broiler Demo Data

set PROJECT_ROOT=C:\Projects\OviCore_Next.js
set BACKEND_DIR=%PROJECT_ROOT%\backend
set DB_FILE=%BACKEND_DIR%\ovicore_dev.db
set ENV_FILE=%BACKEND_DIR%\.env

echo.
echo ==========================================
echo   Resetting OviCore Broiler Demo Data
echo ==========================================
echo.

echo Setting backend database to SQLite...
echo DATABASE_URL=sqlite:///./ovicore_dev.db> "%ENV_FILE%"
echo CORS_ORIGINS=http://localhost:3000>> "%ENV_FILE%"

echo.
echo Removing old SQLite database if it exists...
if exist "%DB_FILE%" (
    del "%DB_FILE%"
    echo Deleted: %DB_FILE%
) else (
    echo No existing SQLite database found.
)

echo.
echo Starting backend so tables and seed data are recreated...
echo Leave this window open.
echo.

cd /d "%BACKEND_DIR%"

if not exist .venv (
    python -m venv .venv
)

call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause