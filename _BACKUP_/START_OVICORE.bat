@echo off
setlocal EnableExtensions

title OviCore Launcher - SQLite Mode

set "PROJECT_ROOT=C:\Projects\OviCore_Next.js"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "BACKEND_ENV=%BACKEND_DIR%\.env"
set "APP_URL=http://localhost:3000/broilers/demand-planner"

echo.
echo ==================================================
echo   OviCore Broiler Module - SQLite Local Mode
echo ==================================================
echo.

echo Writing backend .env for SQLite local development...
(
    echo DATABASE_URL=sqlite:///./ovicore_dev.db
    echo CORS_ORIGINS=http://localhost:3000
) > "%BACKEND_ENV%"

echo.
echo Stopping old services on ports 8000 and 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

timeout /t 2 /nobreak >nul

echo.
echo Creating backend runner...

(
echo @echo off
echo title OviCore Backend - FastAPI SQLite
echo cd /d "%BACKEND_DIR%"
echo echo Starting OviCore backend...
echo echo.
echo if not exist .venv py -3.12 -m venv .venv
echo call .venv\Scripts\activate
echo python -m pip install --upgrade pip
echo pip install -r requirements.txt
echo echo.
echo echo Backend starting on http://localhost:8000
echo echo.
echo python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
echo echo.
echo echo Backend stopped.
echo pause
) > "%PROJECT_ROOT%\RUN_BACKEND.bat"

echo Creating frontend runner...

(
echo @echo off
echo title OviCore Frontend - Next.js
echo cd /d "%FRONTEND_DIR%"
echo echo Starting OviCore frontend...
echo echo.
echo call npm install
echo call npm install ag-grid-react ag-grid-community
echo echo.
echo echo Frontend starting on http://localhost:3000
echo echo.
echo call npm run dev -- -p 3000
echo echo.
echo echo Frontend stopped.
echo pause
) > "%PROJECT_ROOT%\RUN_FRONTEND.bat"

echo.
echo Starting backend window...
start "OviCore Backend - FastAPI SQLite" "%PROJECT_ROOT%\RUN_BACKEND.bat"

echo Waiting 12 seconds for backend...
timeout /t 12 /nobreak >nul

echo.
echo Starting frontend window...
start "OviCore Frontend - Next.js" "%PROJECT_ROOT%\RUN_FRONTEND.bat"

echo Waiting 15 seconds for frontend...
timeout /t 15 /nobreak >nul

echo.
echo Opening backend API check...
start "" "http://localhost:8000/api/broilers/demand-plans"

echo Opening OviCore Broiler Demand Planner...
start "" "%APP_URL%"

echo.
echo ==================================================
echo   OviCore launched in SQLite mode.
echo ==================================================
echo.
echo Keep these two windows open:
echo   1. OviCore Backend - FastAPI SQLite
echo   2. OviCore Frontend - Next.js
echo.
echo Backend should show:
echo   Uvicorn running on http://127.0.0.1:8000
echo   Application startup complete.
echo.
echo Frontend should show:
echo   Ready in ...
echo.
echo App:
echo   %APP_URL%
echo.
pause