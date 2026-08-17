@echo off
setlocal EnableExtensions EnableDelayedExpansion

title OviCore - Install User Activity Update V3
color 0A

set "SOURCE=%~dp0"
if "%SOURCE:~-1%"=="\" set "SOURCE=%SOURCE:~0,-1%"
set "PROJECT=C:\Projects\OviCore_Next.js"

echo.
echo ============================================================
echo   OviCore User Activity Update - V3
echo ============================================================
echo.

if not exist "%PROJECT%\backend\app\models.py" (
  echo [ERROR] Project not found at %PROJECT%
  pause
  exit /b 1
)

for %%F in (models.py schemas.py main.py auth.py access.py AuthGate.tsx page.tsx) do (
  if not exist "%SOURCE%\%%F" (
    echo [ERROR] Missing installer source file: %%F
    echo Expected in: %SOURCE%
    pause
    exit /b 1
  )
)

set "AUTHGATE_TARGET=%PROJECT%\frontend\src\AuthGate.tsx"
if not exist "!AUTHGATE_TARGET!" (
  set "AUTHGATE_TARGET="
  for /r "%PROJECT%\frontend\src" %%F in (AuthGate.tsx) do if not defined AUTHGATE_TARGET set "AUTHGATE_TARGET=%%~fF"
)

set "ADMIN_PAGE_TARGET=%PROJECT%\frontend\src\app\admin\page.tsx"
if not exist "!ADMIN_PAGE_TARGET!" (
  set "ADMIN_PAGE_TARGET="
  for /r "%PROJECT%\frontend\src\app" %%F in (page.tsx) do (
    if not defined ADMIN_PAGE_TARGET (
      findstr /L /C:"Users & Access" "%%~fF" >nul 2>&1
      if !errorlevel! EQU 0 set "ADMIN_PAGE_TARGET=%%~fF"
    )
  )
)

if not defined AUTHGATE_TARGET (
  echo [ERROR] Could not find AuthGate.tsx
  pause
  exit /b 1
)
if not defined ADMIN_PAGE_TARGET (
  echo [ERROR] Could not find admin Users page
  pause
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "BACKUP=%PROJECT%\_BACKUP_\UserActivity_!STAMP!"

echo Project:
echo   %PROJECT%
echo.
echo Frontend targets:
echo   AuthGate: !AUTHGATE_TARGET!
echo   Users:    !ADMIN_PAGE_TARGET!
echo.
echo Backup:
echo   !BACKUP!
echo.
choice /C YN /N /M "Install now? [Y/N]: "
if errorlevel 2 goto cancelled

echo.
echo [1/3] Creating backup folders...
md "!BACKUP!\backend\app\routers" 2>nul
md "!BACKUP!\frontend" 2>nul
if not exist "!BACKUP!\backend\app\routers" goto failedmkdir
if not exist "!BACKUP!\frontend" goto failedmkdir

echo [BACKUP] models.py
call :CopyOne "%PROJECT%\backend\app\models.py" "!BACKUP!\backend\app\models.py" || goto failed
echo [BACKUP] schemas.py
call :CopyOne "%PROJECT%\backend\app\schemas.py" "!BACKUP!\backend\app\schemas.py" || goto failed
echo [BACKUP] main.py
call :CopyOne "%PROJECT%\backend\app\main.py" "!BACKUP!\backend\app\main.py" || goto failed
echo [BACKUP] auth.py
call :CopyOne "%PROJECT%\backend\app\routers\auth.py" "!BACKUP!\backend\app\routers\auth.py" || goto failed
echo [BACKUP] access.py
call :CopyOne "%PROJECT%\backend\app\routers\access.py" "!BACKUP!\backend\app\routers\access.py" || goto failed
echo [BACKUP] AuthGate.tsx
call :CopyOne "!AUTHGATE_TARGET!" "!BACKUP!\frontend\AuthGate.tsx" || goto failed
echo [BACKUP] Admin Users page
call :CopyOne "!ADMIN_PAGE_TARGET!" "!BACKUP!\frontend\AdminUsers_page.tsx" || goto failed

echo       Backup complete.
echo.
echo [2/3] Installing backend files...
call :CopyOne "%SOURCE%\models.py" "%PROJECT%\backend\app\models.py" || goto failed
call :CopyOne "%SOURCE%\schemas.py" "%PROJECT%\backend\app\schemas.py" || goto failed
call :CopyOne "%SOURCE%\main.py" "%PROJECT%\backend\app\main.py" || goto failed
call :CopyOne "%SOURCE%\auth.py" "%PROJECT%\backend\app\routers\auth.py" || goto failed
call :CopyOne "%SOURCE%\access.py" "%PROJECT%\backend\app\routers\access.py" || goto failed

echo.
echo [3/3] Installing frontend files...
call :CopyOne "%SOURCE%\AuthGate.tsx" "!AUTHGATE_TARGET!" || goto failed
call :CopyOne "%SOURCE%\page.tsx" "!ADMIN_PAGE_TARGET!" || goto failed

echo.
echo ============================================================
echo   INSTALL COMPLETE
ECHO ============================================================
echo Backup saved to:
echo   !BACKUP!
echo.
echo Next: restart backend and frontend, then log out/in.
pause
exit /b 0

:CopyOne
if not exist "%~1" (
  echo.
  echo [ERROR] SOURCE DOES NOT EXIST:
  echo   %~1
  exit /b 1
)
copy /Y "%~1" "%~2"
if errorlevel 1 (
  echo.
  echo [ERROR] COPY FAILED:
  echo   FROM: %~1
  echo   TO:   %~2
  exit /b 1
)
exit /b 0

:failedmkdir
echo.
echo [ERROR] Could not create backup folders:
echo   !BACKUP!
echo Try right-clicking the BAT and choosing Run as administrator.
pause
exit /b 1

:failed
echo.
echo ============================================================
echo   INSTALL STOPPED
ECHO ============================================================
echo The exact failed file should be shown immediately above.
echo Backup folder:
echo   !BACKUP!
echo.
echo No further files were copied after the failure.
pause
exit /b 1

:cancelled
echo.
echo Installation cancelled.
pause
exit /b 0
