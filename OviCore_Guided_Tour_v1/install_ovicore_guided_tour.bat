@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM OviCore Guided Tour v1 - Install, Build and Deploy
REM
REM HOW TO USE:
REM 1. Extract OviCore_Guided_Tour_v1.zip
REM 2. Put this .bat file inside the extracted folder
REM    (the folder that contains README.txt and "frontend")
REM 3. Double-click this file
REM
REM Project target:
REM   C:\Projects\OviCore_Next.js
REM ============================================================

set "PROJECT=C:\Projects\OviCore_Next.js"
set "SOURCE=%~dp0"
set "FRONTEND=%PROJECT%\frontend"

echo.
echo ============================================================
echo   OviCore Guided Tour v1 Installer
echo ============================================================
echo.
echo Source:
echo   %SOURCE%
echo.
echo Target:
echo   %PROJECT%
echo.

REM ------------------------------------------------------------
REM Validate source package
REM ------------------------------------------------------------
if not exist "%SOURCE%frontend\src\components\OviCoreTour.tsx" (
    echo ERROR: OviCoreTour.tsx was not found.
    echo.
    echo Put this batch file inside the extracted
    echo OviCore_Guided_Tour_v1 folder and run it again.
    echo.
    pause
    exit /b 1
)

if not exist "%SOURCE%frontend\src\app\tour\page.tsx" (
    echo ERROR: Guided Tour page was not found in the source folder.
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------------------------
REM Validate project
REM ------------------------------------------------------------
if not exist "%FRONTEND%\package.json" (
    echo ERROR: OviCore project was not found at:
    echo   %PROJECT%
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------------------------
REM Create timestamped backup folder
REM ------------------------------------------------------------
for /f "tokens=1-4 delims=/ " %%a in ("%date%") do (
    set "DATEPART=%%d%%c%%b"
)
for /f "tokens=1-3 delims=:., " %%a in ("%time%") do (
    set "TIMEPART=%%a%%b%%c"
)
set "TIMEPART=%TIMEPART: =0%"
set "BACKUP=%PROJECT%\guided_tour_backup_%DATEPART%_%TIMEPART%"

echo Creating backup folder:
echo   %BACKUP%
mkdir "%BACKUP%" >nul 2>&1

REM ------------------------------------------------------------
REM Backup files that will be replaced
REM ------------------------------------------------------------
call :backup "frontend\src\app\home\page.tsx"
call :backup "frontend\src\app\broilers\page.tsx"
call :backup "frontend\src\app\broilers\intelligence\page.tsx"
call :backup "frontend\src\app\planning\page.tsx"
call :backup "frontend\src\app\compliance\page.tsx"

REM ------------------------------------------------------------
REM Create destination folders
REM ------------------------------------------------------------
if not exist "%FRONTEND%\src\components" mkdir "%FRONTEND%\src\components"
if not exist "%FRONTEND%\src\app\tour" mkdir "%FRONTEND%\src\app\tour"
if not exist "%FRONTEND%\src\app\broilers\intelligence" mkdir "%FRONTEND%\src\app\broilers\intelligence"
if not exist "%FRONTEND%\src\app\planning" mkdir "%FRONTEND%\src\app\planning"
if not exist "%FRONTEND%\src\app\compliance" mkdir "%FRONTEND%\src\app\compliance"

REM ------------------------------------------------------------
REM Copy Guided Tour files
REM ------------------------------------------------------------
echo.
echo Copying Guided Tour files...

call :copyfile "frontend\src\components\OviCoreTour.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\tour\page.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\home\page.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\broilers\page.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\broilers\intelligence\page.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\planning\page.tsx"
if errorlevel 1 goto :copyfailed

call :copyfile "frontend\src\app\compliance\page.tsx"
if errorlevel 1 goto :copyfailed

echo.
echo Files copied successfully.

REM ------------------------------------------------------------
REM Build frontend
REM ------------------------------------------------------------
echo.
echo ============================================================
echo   Running Next.js build
echo ============================================================
echo.

cd /d "%FRONTEND%"

call npm run build
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   BUILD FAILED - NOTHING HAS BEEN PUSHED
    echo ============================================================
    echo.
    echo Your previous files were backed up here:
    echo   %BACKUP%
    echo.
    echo Fix the build error before deploying.
    echo.
    pause
    exit /b 1
)

echo.
echo Build passed successfully.

REM ------------------------------------------------------------
REM Show git status before committing
REM ------------------------------------------------------------
cd /d "%PROJECT%"

echo.
echo ============================================================
echo   Git status
echo ============================================================
git status --short

echo.
choice /C YN /N /M "Build passed. Commit and push to sandbox via GitHub now? [Y/N]: "
if errorlevel 2 goto :done_no_push

REM ------------------------------------------------------------
REM Git deploy
REM ------------------------------------------------------------
echo.
echo Adding files...
git add .

echo.
echo Committing...
git commit -m "Add OviCore guided tour"
if errorlevel 1 (
    echo.
    echo NOTE: Git did not create a commit.
    echo This usually means there were no new changes to commit.
    echo.
)

echo.
echo Pushing to origin main...
git push origin main
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   PUSH FAILED
    echo ============================================================
    echo.
    echo The local build passed, but Git could not push.
    echo Run this later from:
    echo   %PROJECT%
    echo.
    echo   git push origin main
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   DONE
echo ============================================================
echo.
echo Guided Tour installed, build passed and changes pushed.
echo Vercel should now deploy the sandbox automatically.
echo.
echo Backup:
echo   %BACKUP%
echo.
pause
exit /b 0

:done_no_push
echo.
echo ============================================================
echo   DONE - NOT PUSHED
echo ============================================================
echo.
echo Guided Tour files are installed and the build passed.
echo No Git commit or push was performed.
echo.
echo When ready, run:
echo   cd /d %PROJECT%
echo   git add .
echo   git commit -m "Add OviCore guided tour"
echo   git push origin main
echo.
pause
exit /b 0

:copyfailed
echo.
echo ERROR: A file could not be copied.
echo Nothing has been pushed.
echo.
pause
exit /b 1

:backup
set "REL=%~1"
if exist "%PROJECT%\%REL%" (
    for %%F in ("%REL%") do set "BDIR=%BACKUP%\%%~dpF"
    if not exist "!BDIR!" mkdir "!BDIR!" >nul 2>&1
    copy /Y "%PROJECT%\%REL%" "%BACKUP%\%REL%" >nul
)
exit /b 0

:copyfile
set "REL=%~1"
for %%F in ("%REL%") do set "DESTDIR=%PROJECT%\%%~dpF"
if not exist "!DESTDIR!" mkdir "!DESTDIR!" >nul 2>&1

copy /Y "%SOURCE%%REL%" "%PROJECT%\%REL%" >nul
if errorlevel 1 (
    echo FAILED: %REL%
    exit /b 1
)

echo   Copied: %REL%
exit /b 0
