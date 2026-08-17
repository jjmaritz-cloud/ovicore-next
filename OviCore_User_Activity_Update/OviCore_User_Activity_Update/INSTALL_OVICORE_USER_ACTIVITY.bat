@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =============================================================
REM OviCore User Activity Installer
REM - Finds the OviCore project root
REM - Backs up every file it replaces
REM - Installs backend + frontend User Activity files
REM =============================================================

title OviCore - Install User Activity Update
color 0A

set "SOURCE=%~dp0"
if "%SOURCE:~-1%"=="\" set "SOURCE=%SOURCE:~0,-1%"

 echo.
 echo ============================================================
 echo   OviCore User Activity Update
 echo ============================================================
 echo.

REM -------------------------------------------------------------
REM Find project root. First try walking upward from this BAT.
REM -------------------------------------------------------------
set "PROJECT="
set "CHECK=%SOURCE%"

:find_root
if exist "%CHECK%\backend\app\models.py" if exist "%CHECK%\frontend\src" (
    set "PROJECT=%CHECK%"
    goto root_found
)

for %%I in ("%CHECK%\..") do set "PARENT=%%~fI"
if /I "%PARENT%"=="%CHECK%" goto root_not_found
set "CHECK=%PARENT%"
goto find_root

:root_not_found
REM Fall back to the known local project path.
if exist "C:\Projects\OviCore_Next.js\backend\app\models.py" (
    set "PROJECT=C:\Projects\OviCore_Next.js"
    goto root_found
)

echo [ERROR] Could not find the OviCore project root.
echo.
echo Expected a folder containing:
echo   backend\app\models.py
 echo   frontend\src
 echo.
echo Move this update folder somewhere inside OviCore_Next.js
 echo or edit PROJECT in this batch file.
echo.
pause
exit /b 1

:root_found
echo Project found:
echo   %PROJECT%
echo.

REM -------------------------------------------------------------
REM Make timestamped backup folder outside the live app folders.
REM -------------------------------------------------------------
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "BACKUP=%PROJECT%\_BACKUP_\UserActivity_%STAMP%"
mkdir "%BACKUP%\backend\app\routers" >nul 2>&1
mkdir "%BACKUP%\frontend" >nul 2>&1

REM -------------------------------------------------------------
REM Check update package files exist.
REM -------------------------------------------------------------
for %%F in (models.py schemas.py main.py auth.py access.py AuthGate.tsx page.tsx) do (
    if not exist "%SOURCE%\%%F" (
        echo [ERROR] Missing update file: %%F
        echo Nothing has been installed.
        pause
        exit /b 1
    )
)

REM -------------------------------------------------------------
REM Locate frontend target files from their contents/names.
REM AuthGate: find exact AuthGate.tsx under frontend\src.
REM Admin page: find page.tsx containing title "Users ^& Access".
REM -------------------------------------------------------------
set "AUTHGATE_TARGET="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "$f=Get-ChildItem -Path '%PROJECT%\frontend\src' -Filter 'AuthGate.tsx' -File -Recurse -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty FullName; if($f){$f}"`) do set "AUTHGATE_TARGET=%%F"

if not defined AUTHGATE_TARGET (
    echo [ERROR] Could not locate the live AuthGate.tsx under frontend\src.
    pause
    exit /b 1
)

set "ADMIN_PAGE_TARGET="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "$f=Get-ChildItem -Path '%PROJECT%\frontend\src\app' -Filter 'page.tsx' -File -Recurse -ErrorAction SilentlyContinue ^| Where-Object { Select-String -Path $_.FullName -SimpleMatch 'Users & Access' -Quiet } ^| Select-Object -First 1 -ExpandProperty FullName; if($f){$f}"`) do set "ADMIN_PAGE_TARGET=%%F"

if not defined ADMIN_PAGE_TARGET (
    echo [ERROR] Could not locate the Global Admin Users ^& Access page.
    echo The installer searched for a page.tsx containing "Users ^& Access".
    pause
    exit /b 1
)

echo Frontend targets:
echo   AuthGate: %AUTHGATE_TARGET%
echo   Users:    %ADMIN_PAGE_TARGET%
echo.

REM -------------------------------------------------------------
REM Confirmation
REM -------------------------------------------------------------
echo A backup will be created at:
echo   %BACKUP%
echo.
choice /C YN /N /M "Install the User Activity update now? [Y/N]: "
if errorlevel 2 goto cancelled

REM -------------------------------------------------------------
REM Backup existing files
REM -------------------------------------------------------------
echo.
echo [1/3] Backing up current files...
copy /Y "%PROJECT%\backend\app\models.py" "%BACKUP%\backend\app\models.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\schemas.py" "%BACKUP%\backend\app\schemas.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\main.py" "%BACKUP%\backend\app\main.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\routers\auth.py" "%BACKUP%\backend\app\routers\auth.py" >nul || goto failed
copy /Y "%PROJECT%\backend\app\routers\access.py" "%BACKUP%\backend\app\routers\access.py" >nul || goto failed

for %%I in ("%AUTHGATE_TARGET%") do set "AUTHGATE_NAME=%%~nxI"
for %%I in ("%ADMIN_PAGE_TARGET%") do set "ADMIN_PAGE_NAME=%%~nxI"
copy /Y "%AUTHGATE_TARGET%" "%BACKUP%\frontend\AuthGate.tsx" >nul || goto failed
copy /Y "%ADMIN_PAGE_TARGET%" "%BACKUP%\frontend\AdminUsers_page.tsx" >nul || goto failed

echo       Backup complete.

REM -------------------------------------------------------------
REM Install backend files
REM -------------------------------------------------------------
echo [2/3] Installing backend files...
copy /Y "%SOURCE%\models.py" "%PROJECT%\backend\app\models.py" >nul || goto failed
copy /Y "%SOURCE%\schemas.py" "%PROJECT%\backend\app\schemas.py" >nul || goto failed
copy /Y "%SOURCE%\main.py" "%PROJECT%\backend\app\main.py" >nul || goto failed
copy /Y "%SOURCE%\auth.py" "%PROJECT%\backend\app\routers\auth.py" >nul || goto failed
copy /Y "%SOURCE%\access.py" "%PROJECT%\backend\app\routers\access.py" >nul || goto failed

REM -------------------------------------------------------------
REM Install frontend files
REM -------------------------------------------------------------
echo [3/3] Installing frontend files...
copy /Y "%SOURCE%\AuthGate.tsx" "%AUTHGATE_TARGET%" >nul || goto failed
copy /Y "%SOURCE%\page.tsx" "%ADMIN_PAGE_TARGET%" >nul || goto failed

echo.
echo ============================================================
echo   INSTALL COMPLETE
 echo ============================================================
echo.
echo Backup:
echo   %BACKUP%
echo.
echo Next steps:
echo   1. Restart the FastAPI backend.
echo   2. Restart/rebuild the Next.js frontend.
echo   3. Log out and back in once.
echo   4. Open Global Admin ^> Users ^& Access.
echo.
echo The backend startup will add the new activity schema automatically.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Installation stopped because a file operation failed.
echo Your backup folder is:
echo   %BACKUP%
echo.
echo Check the paths above and try again.
pause
exit /b 1

:cancelled
echo.
echo Installation cancelled. No live files were changed.
pause
exit /b 0
