@echo off
setlocal EnableExtensions
title OviCore - Add Return to Modules Button

set "PROJECT=C:\Projects\OviCore_Next.js"
set "PKG=%~dp0"
set "TARGET=%PROJECT%\frontend\src\app\compliance\page.tsx"

echo.
echo ============================================================
echo   OviCore - Compliance Return to Modules Button
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
set "BACKUP=%PROJECT%\_BACKUP_\ComplianceReturnButton_%D%_%T%"

echo Live file:
echo   %TARGET%
echo.
echo This adds an easy-to-see:
echo   ^<-- Return to Modules
echo button at the top of People, Safety ^& Compliance.
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
echo   INSTALL COMPLETE
echo ============================================================
echo Backup:
echo   %BACKUP%
echo.
echo The button returns users to:
echo   /home
echo.

echo ============================================================
echo   GIT UPLOAD
echo ============================================================
choice /C YN /N /M "Upload this change to GitHub now? [Y/N]: "
if errorlevel 2 goto :done

cd /d "%PROJECT%"
echo.
git status
echo.
git add .
if errorlevel 1 goto :gitfail

git commit -m "Add return to modules button to compliance"
if errorlevel 1 (
  echo.
  echo [INFO] Git commit was not created. This can happen if there are no new changes.
)

git push origin main
if errorlevel 1 (
  echo.
  echo [WARNING] Push to main failed.
  echo If your branch is master, run:
  echo   git push origin master
  goto :done
)

echo.
echo [SUCCESS] Change uploaded to GitHub.

:done
echo.
echo Reload /compliance to check the new button.
pause
exit /b 0

:gitfail
echo.
echo [WARNING] Installation succeeded, but git add failed.
echo Run these manually from:
echo   %PROJECT%
echo.
echo   git status
echo   git add .
echo   git commit -m "Add return to modules button to compliance"
echo   git push origin main
pause
exit /b 1

:fail
echo.
echo [ERROR] Installation failed.
echo Backup folder:
echo   %BACKUP%
pause
exit /b 1
