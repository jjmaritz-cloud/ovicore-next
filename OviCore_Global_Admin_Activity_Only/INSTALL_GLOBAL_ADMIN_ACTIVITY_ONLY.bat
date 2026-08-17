@echo off
setlocal EnableExtensions
title OviCore - Global Admin Activity Only

set "PROJECT=C:\Projects\OviCore_Next.js"
set "PKG=%~dp0"
set "TARGET=%PROJECT%\frontend\src\app\admin\page.tsx"

echo.
echo ============================================================
echo   OviCore - Restrict User Activity to Global Admin
echo ============================================================
echo.

if not exist "%PKG%page.tsx" (
  echo [ERROR] page.tsx is missing beside this batch file.
  pause
  exit /b 1
)

if not exist "%TARGET%" (
  echo [ERROR] Live Users page not found:
  echo   %TARGET%
  pause
  exit /b 1
)

for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set "D=%%d%%b%%c"
for /f "tokens=1-3 delims=:., " %%a in ("%time%") do set "T=%%a%%b%%c"
set "T=%T: =0%"
set "BACKUP=%PROJECT%\_BACKUP_\GlobalAdminActivityOnly_%D%_%T%"

echo Live file:
echo   %TARGET%
echo.
echo Backup:
echo   %BACKUP%
echo.
echo This will:
echo   - Hide ALL user activity columns from Company Admins
echo   - Hide the User Activity panel from Company Admins
echo   - Hide activity KPIs from Company Admins
echo   - Stop Company Admin browsers requesting activity endpoints
echo   - Keep activity available to Global Admin only
echo.
choice /C YN /N /M "Install now? [Y/N]: "
if errorlevel 2 exit /b 0

mkdir "%BACKUP%" >nul 2>&1

echo.
echo [1/2] Backing up current Users page...
copy /Y "%TARGET%" "%BACKUP%\page.tsx"
if errorlevel 1 goto :fail

echo.
echo [2/2] Installing updated Users page...
copy /Y "%PKG%page.tsx" "%TARGET%"
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo   COMPLETE
echo ============================================================
echo Company Admins will no longer see User Activity.
echo Global Admin retains the full activity view.
echo.
echo Backup:
echo   %BACKUP%
echo.
echo Restart the frontend, then test with a Company Admin account.
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Installation failed.
echo Your original page is backed up at:
echo   %BACKUP%
pause
exit /b 1
