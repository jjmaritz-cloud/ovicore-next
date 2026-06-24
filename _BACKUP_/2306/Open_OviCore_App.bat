@echo off
setlocal

REM ============================================================
REM OviCore Next.js - Open App
REM Starts:
REM   Backend  on http://localhost:8001
REM   Frontend on http://localhost:3000
REM Then opens the Broiler Demand Planner in your browser.
REM ============================================================

set "ROOT=C:\Projects\OviCore_Next.js"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo.
echo ============================================
echo Starting OviCore Next.js
echo ============================================
echo.

REM Check backend
if not exist "%BACKEND%\app\main.py" (
    echo ERROR: Backend app not found:
    echo %BACKEND%\app\main.py
    pause
    exit /b 1
)

REM Check frontend
if not exist "%FRONTEND%\package.json" (
    echo ERROR: Frontend package.json not found:
    echo %FRONTEND%\package.json
    pause
    exit /b 1
)

REM Make sure backend app is a package
if not exist "%BACKEND%\app\__init__.py" (
    echo Creating missing backend package file...
    type nul > "%BACKEND%\app\__init__.py"
)

REM Check backend virtual environment
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo ERROR: Backend virtual environment not found:
    echo %BACKEND%\.venv\Scripts\activate.bat
    echo.
    echo Create it with:
    echo cd /d %BACKEND%
    echo py -3.12 -m venv .venv
    echo .venv\Scripts\activate
    echo pip install -r requirements.txt
    pause
    exit /b 1
)

REM Ensure frontend points to backend port 8001
echo NEXT_PUBLIC_API_BASE_URL=http://localhost:8001>"%FRONTEND%\.env.local"

echo Starting backend on port 8001...
start "OviCore Backend API - 8001" cmd /k "cd /d C:\Projects\OviCore_Next.js\backend && call .venv\Scripts\activate.bat && echo Backend starting on http://localhost:8001 && python -m uvicorn app.main:app --reload --port 8001"

echo Waiting a few seconds for backend...
timeout /t 4 /nobreak >nul

echo Starting frontend on port 3000...
start "OviCore Frontend - 3000" cmd /k "cd /d C:\Projects\OviCore_Next.js\frontend && echo Frontend starting on http://localhost:3000 && npm run dev"

echo Waiting a few seconds for frontend...
timeout /t 6 /nobreak >nul

echo Opening OviCore in browser...
start http://localhost:3000/broilers/demand-planner

echo.
echo ============================================
echo OviCore should now be starting.
echo ============================================
echo.
echo Backend:
echo   http://localhost:8001/api/health
echo   http://localhost:8001/docs
echo   http://localhost:8001/api/broilers/performance
echo.
echo Frontend:
echo   http://localhost:3000/broilers/demand-planner
echo   http://localhost:3000/broilers/farms
echo   http://localhost:3000/broilers/sheds
echo   http://localhost:3000/broilers/cycles
echo   http://localhost:3000/broilers/performance
echo.
echo Leave the Backend and Frontend windows open while using the app.
echo.
pause
endlocal
