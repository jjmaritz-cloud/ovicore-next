@echo off
setlocal EnableExtensions EnableDelayedExpansion

title OviCore - Install User Activity Update
color 0A

set "SOURCE=%~dp0"
if "%SOURCE:~-1%"=="\" set "SOURCE=%SOURCE:~0,-1%"
set "PROJECT=C:\Projects\OviCore_Next.js"

echo.
echo ============================================================
echo   OviCore User Activity Update - FIXED INSTALLER
echo ============================================================
echo.

if not exist "%PROJECT%\backend\app\models.py" (
    echo [ERROR] OviCore project was not found at:
    echo   %PROJECT%
    echo.
    pause
    exit /b 1
)

REM Package validation
for %%F in (models.py schemas.py main.py auth.py access.py AuthGate.tsx page.tsx) do (
    if not exist "%SOURCE%\%%F" (
        echo [ERROR] Missing update file: %%F
        echo Put this BAT in the same folder as the update files.
        pause
        exit /b 1
    )
)

REM -------------------------------------------------------------
REM Find AuthGate using CMD recursive search (no PowerShell quoting).
REM -------------------------------------------------------------
set "AUTHGATE_TARGET="
for /r "%PROJECT%\frontend\src" %%F in (AuthGate.tsx) do (
    if not defined AUTHGATE_TARGET set "AUTHGATE_TARGET=%%~fF"
)

REM -------------------------------------------------------------
REM Find the admin Users page by searching page.tsx files for
REM the literal text Users & Access.
REM -------------------------------------------------------------
set "ADMIN_PAGE_TARGET="
for /r "%PROJECT%\frontend\src\app" %%F in (page.tsx) do (
    if not defined ADMIN_PAGE_TARGET (
        findstr /L /C:"Users & Access" "%%~fF" >nul 2>&1
        if !errorlevel! EQU 0 set "ADMIN_PAGE_TARGET=%%~fF"
    )
)

if not defined AUTHGATE_TARGET (
    echo [ERROR] Could not find AuthGate.tsx under:
    echo   %PROJECT%\frontend\src
    echo.
    pause
    exit /b 1
)

if not defined ADMIN_PAGE_TARGET (
    echo [ERROR] Could not find the Users ^& Access page under:
    echo   %PROJECT%\frontend\src\app
    echo.
    echo No live files have been changed.
    pause
    exit /b 1
)

echo Project:
echo   %PROJECT%
echo.
echo Frontend targets found:
echo   AuthGate: !AUTHGATE_TARGET!
echo   Users:    !ADMIN_PAGE_TARGET!
echo.

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "BACKUP=%PROJECT%\_BACKUP_\UserActivity_!STAMP!"

echo Backup will be created at:
echo   !BACKUP!
echo.
choice /C YN /N /M "Install the User Activity update now? [Y/N]: "
if errorlevel 2 goto cancelled

echo.
echo [1/3] Creating backup...
mkdir "!BACKUP!\backend\app\routers" >nul 2>&1
mkdir "!BACKUP!\frontend" >nul 2>&1

copy /Y "%PROJECT%\backend\app\models.py" "!BACKUP!\backend\app\models.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\schemas.py" "!BACKUP!\backend\app\schemas.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\main.py" "!BACKUP!\backend\app\main.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\routers\auth.py" "!BACKUP!\backend\app\routers\auth.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\routers\access.py" "!BACKUP!\backend\app\routers\access.py" >nul || goto failed
copy /Y "!AUTHGATE_TARGET!" "!BACKUP!\frontend\AuthGate.tsx" >nul || goto failed
copy /Y "!ADMIN_PAGE_TARGET!" "!BACKUP!\frontend\AdminUsers_page.tsx" >nul || goto failed

echo       Backup complete.

echo [2/3] Installing backend files...
copy /Y "%SOURCE%\models.py" "%PROJECT%\backend\app\models.py" >nul || goto failed
copy /Y "%SOURCE%\schemas.py" "%PROJECT%\backend\app\schemas.py" >nul || goto failed
copy /Y "%SOURCE%\main.py" "%PROJECT%\backend\app\main.py" >nul || goto failed
copy /Y "%SOURCE%\auth.py" "%PROJECT%\backend\app\routers\auth.py" >nul || goto failed
copy /Y "%SOURCE%\access.py" "%PROJECT%\backend\app\routers\access.py" >nul || goto failed

echo [3/3] Installing frontend files...
copy /Y "%SOURCE%\AuthGate.tsx" "!AUTHGATE_TARGET!" >nul || goto failed
copy /Y "%SOURCE%\page.tsx" "!ADMIN_PAGE_TARGET!" >nul || goto failed

echo.
echo ============================================================
echo   INSTALL COMPLETE
echo ============================================================
echo.
echo Backup:
echo   !BACKUP!
echo.
echo Next:
echo   1. Restart the FastAPI backend.
echo   2. Restart/rebuild the Next.js frontend.
echo   3. Log out and back in.
echo   4. Open Global Admin ^> Users ^& Access.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] A copy operation failed.
echo Backup folder:
echo   !BACKUP!
echo.
echo Installation stopped. Please send me a screenshot of this window.
pause
exit /b 1

:cancelled
echo.
echo Installation cancelled. No live files were changed.
pause
exit /b 0
