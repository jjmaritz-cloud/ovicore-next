@echo off
setlocal

set ROOT=C:\Projects\OviCore_Next.js
set BACKEND=%ROOT%\backend
set FRONTEND=%ROOT%\frontend

echo ============================================
echo OviCore Starter
echo ============================================
echo.

if not exist "%BACKEND%\app\main.py" (
    echo ERROR: Cannot find %BACKEND%\app\main.py
    pause
    exit /b 1
)

if not exist "%BACKEND%\app\__init__.py" (
    echo Creating missing %BACKEND%\app\__init__.py
    type nul > "%BACKEND%\app\__init__.py"
)

if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo ERROR: Cannot find backend virtual environment:
    echo %BACKEND%\.venv\Scripts\activate.bat
    pause
    exit /b 1
)

if not exist "%FRONTEND%\package.json" (
    echo ERROR: Cannot find frontend package.json:
    echo %FRONTEND%\package.json
    pause
    exit /b 1
)

echo Starting backend window...
start "OviCore Backend API" cmd /k "cd /d C:\Projects\OviCore_Next.js\backend && call .venv\Scripts\activate.bat && echo Backend starting on http://localhost:8000 && python -m uvicorn app.main:app --reload --port 8000"

timeout /t 2 >nul

echo Starting frontend window...
start "OviCore Frontend" cmd /k "cd /d C:\Projects\OviCore_Next.js\frontend && echo Frontend starting on http://localhost:3000 && npm run dev"

echo.
echo Done. Two windows should now be running.
echo.
echo Test backend:
echo http://localhost:8000/api/health
echo http://localhost:8000/docs
echo http://localhost:8000/api/broilers/performance
echo.
echo Test frontend:
echo http://localhost:3000/broilers/demand-planner
echo.
pause
endlocal
