@echo off
setlocal EnableExtensions
title OviCore - Add Competency Assessment

set "PROJECT=C:\Projects\OviCore_Next.js"
set "PKG=%~dp0"
set "TARGET=%PROJECT%\frontend\src\app\compliance\page.tsx"

echo.
echo ============================================================
echo   OviCore - Add Competency Assessment Tab
echo ============================================================
echo.

if not exist "%PKG%page.tsx" (
  echo [ERROR] page.tsx is missing beside this batch file.
  pause
  exit /b 1
)

if not exist "%TARGET%" (
  echo [ERROR] Live Compliance page not found:
  echo   %TARGET%
  pause
  exit /b 1
)

for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set "D=%%d%%b%%c"
for /f "tokens=1-3 delims=:., " %%a in ("%time%") do set "T=%%a%%b%%c"
set "T=%T: =0%"
set "BACKUP=%PROJECT%\_BACKUP_\CompetencyAssessment_%D%_%T%"

echo Live file:
echo   %TARGET%
echo.
echo This adds:
echo   - Competency Assessment tab beside Training
echo   - Placeholder workspace ready for the detailed assessment workflow
echo.
choice /C YN /N /M "Install now? [Y/N]: "
if errorlevel 2 exit /b 0

mkdir "%BACKUP%" >nul 2>&1

echo.
echo [1/2] Backing up current Compliance page...
copy /Y "%TARGET%" "%BACKUP%\page.tsx"
if errorlevel 1 goto :fail

echo.
echo [2/2] Installing updated Compliance page...
copy /Y "%PKG%page.tsx" "%TARGET%"
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo   COMPLETE
echo ============================================================
echo Competency Assessment has been added to People, Safety & Compliance.
echo.
echo Backup:
echo   %BACKUP%
echo.
echo Restart/reload the frontend and open /compliance.
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Installation failed.
echo Backup folder:
echo   %BACKUP%
pause
exit /b 1
