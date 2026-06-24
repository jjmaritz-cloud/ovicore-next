@echo off
setlocal

REM ============================================================
REM OviCore Next.js - Start Backend + Frontend
REM Project root: C:\Projects\OviCore_Next.js
REM Backend app module: app.main:app
REM Backend port: 8000
REM Frontend port: 3000
REM ============================================================

set "ROOT=C:\Projects\OviCore_Next.js"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo.
echo ============================================
echo Starting OviCore Backend and Frontend
echo ============================================
echo Root:     %ROOT%
echo Backend:  %BACKEND%
echo Frontend: %FRONTEND%
echo.

REM Check folders
if not exist "%BACKEND%" (
    echo ERROR: Backend folder not found:
    echo %BACKEND%
    pause
    exit /b 1
)

if not exist "%FRONTEND%" (
    echo ERROR: Frontend folder not found:
    echo %FRONTEND%
    pause
    exit /b 1
)

REM Check backend app package
if not exist "%BACKEND%\app\main.py" (
    echo ERROR: Backend main.py not found:
    echo %BACKEND%\app\main.py
    pause
    exit /b 1
)

REM Ensure app package init exists
if not exist "%BACKEND%\app\__init__.py" (
    echo Creating missing backend app package file:
    echo %BACKEND%\app\__init__.py
    type nul > "%BACKEND%\app\__init__.py"
)

REM Check backend virtual environment
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo ERROR: Backend virtual environment not found:
    echo %BACKEND%\.venv
    echo.
    echo Create it first with:
    echo cd /d %BACKEND%
    echo py -3.12 -m venv .venv
    echo .venv\Scripts\activate
    echo pip install -r requirements.txt
    pause
    exit /b 1
)

REM Start backend in a new window
start "OviCore Backend API" cmd /k ^
"cd /d "%BACKEND%" && call .venv\Scripts\activate.bat && echo Backend starting on http://localhost:8000 && python -m uvicorn app.main:app --reload --port 8000"

REM Start frontend in a new window
start "OviCore Frontend" cmd /k ^
"cd /d "%FRONTEND%" && echo Frontend starting on http://localhost:3000 && npm run dev"

echo.
echo Started both windows.
echo.
echo Backend:
echo http://localhost:8000/api/health
echo http://localhost:8000/docs
echo http://localhost:8000/api/broilers/performance
echo.
echo Frontend:
echo http://localhost:3000
echo http://localhost:3000/broilers/demand-planner
echo http://localhost:3000/broilers/farms
echo http://localhost:3000/broilers/sheds
echo http://localhost:3000/broilers/cycles
echo.
echo You can close this window now.
pause
endlocal
