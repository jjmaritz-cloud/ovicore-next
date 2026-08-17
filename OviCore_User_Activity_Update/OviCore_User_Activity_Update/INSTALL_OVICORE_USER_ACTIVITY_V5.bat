@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OviCore User Activity Update - V5

set "PROJECT=C:\Projects\OviCore_Next.js"
set "PKG=%~dp0"

echo.
echo ============================================================
echo   OviCore User Activity Update - V5
echo ============================================================
echo.

if not exist "%PROJECT%\frontend" (
  echo [ERROR] Project not found:
  echo   %PROJECT%
  pause
  exit /b 1
)

rem ------------------------------------------------------------
rem Find live frontend files
rem ------------------------------------------------------------
set "AUTHGATE="
for /f "delims=" %%F in ('where /r "%PROJECT%\frontend\src" AuthGate.tsx 2^>nul') do (
  if not defined AUTHGATE set "AUTHGATE=%%F"
)

set "USERPAGE=%PROJECT%\frontend\src\app\admin\page.tsx"

rem ------------------------------------------------------------
rem Find backend route folder name safely: routes or routers
rem ------------------------------------------------------------
set "AUTHROUTE="
for /f "delims=" %%F in ('where /r "%PROJECT%\backend\app" auth.py 2^>nul') do (
  if not defined AUTHROUTE set "AUTHROUTE=%%F"
)

set "ACCESSROUTE="
for /f "delims=" %%F in ('where /r "%PROJECT%\backend\app" access.py 2^>nul') do (
  if not defined ACCESSROUTE set "ACCESSROUTE=%%F"
)

if not defined AUTHGATE (
  echo [ERROR] Could not find AuthGate.tsx under:
  echo   %PROJECT%\frontend\src
  pause
  exit /b 1
)

if not exist "%USERPAGE%" (
  echo [ERROR] Could not find Users page:
  echo   %USERPAGE%
  pause
  exit /b 1
)

if not defined AUTHROUTE (
  echo [ERROR] Could not find backend auth.py under:
  echo   %PROJECT%\backend\app
  pause
  exit /b 1
)

if not defined ACCESSROUTE (
  echo [ERROR] Could not find backend access.py under:
  echo   %PROJECT%\backend\app
  pause
  exit /b 1
)

rem ------------------------------------------------------------
rem Check update package files before doing anything
rem ------------------------------------------------------------
for %%F in (models.py schemas.py main.py auth.py access.py AuthGate.tsx page.tsx) do (
  if not exist "%PKG%%%F" (
    echo [ERROR] Update package file missing:
    echo   %PKG%%%F
    pause
    exit /b 1
  )
)

for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set "DATESTAMP=%%d%%b%%c"
for /f "tokens=1-3 delims=:., " %%a in ("%time%") do set "TIMESTAMP=%%a%%b%%c"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP=%PROJECT%\_BACKUP_\UserActivity_%DATESTAMP%_%TIMESTAMP%"

echo Project:
echo   %PROJECT%
echo.
echo Live frontend targets:
echo   AuthGate: %AUTHGATE%
echo   Users:    %USERPAGE%
echo.
echo Live backend targets:
echo   Auth:     %AUTHROUTE%
echo   Access:   %ACCESSROUTE%
echo.
echo Update package:
echo   %PKG%
echo.
echo Backup:
echo   %BACKUP%
echo.

choice /C YN /N /M "Install now? [Y/N]: "
if errorlevel 2 exit /b 0

echo.
echo [1/3] Creating backup...
mkdir "%BACKUP%\backend\app" >nul 2>&1
mkdir "%BACKUP%\backend\routes" >nul 2>&1
mkdir "%BACKUP%\frontend" >nul 2>&1

call :backup "%PROJECT%\backend\app\models.py" "%BACKUP%\backend\app\models.py" || goto :fail
call :backup "%PROJECT%\backend\app\schemas.py" "%BACKUP%\backend\app\schemas.py" || goto :fail
call :backup "%PROJECT%\backend\app\main.py" "%BACKUP%\backend\app\main.py" || goto :fail
call :backup "%AUTHROUTE%" "%BACKUP%\backend\routes\auth.py" || goto :fail
call :backup "%ACCESSROUTE%" "%BACKUP%\backend\routes\access.py" || goto :fail
call :backup "%AUTHGATE%" "%BACKUP%\frontend\AuthGate.tsx" || goto :fail
call :backup "%USERPAGE%" "%BACKUP%\frontend\admin-page.tsx" || goto :fail

echo.
echo [2/3] Installing backend files...
call :install "%PKG%models.py" "%PROJECT%\backend\app\models.py" || goto :fail
call :install "%PKG%schemas.py" "%PROJECT%\backend\app\schemas.py" || goto :fail
call :install "%PKG%main.py" "%PROJECT%\backend\app\main.py" || goto :fail
call :install "%PKG%auth.py" "%AUTHROUTE%" || goto :fail
call :install "%PKG%access.py" "%ACCESSROUTE%" || goto :fail

echo.
echo [3/3] Installing frontend files...
call :install "%PKG%AuthGate.tsx" "%AUTHGATE%" || goto :fail
call :install "%PKG%page.tsx" "%USERPAGE%" || goto :fail

echo.
echo ============================================================
echo   INSTALL COMPLETE
echo ============================================================
echo Backup saved at:
echo   %BACKUP%
echo.
echo Restart the backend and frontend, then log out and log back in.
echo.
pause
exit /b 0

:backup
echo [BACKUP] %~nx1
if not exist "%~1" (
  echo.
  echo [ERROR] LIVE SOURCE DOES NOT EXIST:
  echo   %~1
  exit /b 1
)
copy /Y "%~1" "%~2"
if errorlevel 1 (
  echo.
  echo [ERROR] BACKUP COPY FAILED
  echo FROM: %~1
  echo TO:   %~2
  exit /b 1
)
exit /b 0

:install
echo [INSTALL] %~nx2
if not exist "%~1" (
  echo.
  echo [ERROR] PACKAGE SOURCE DOES NOT EXIST:
  echo   %~1
  exit /b 1
)
copy /Y "%~1" "%~2"
if errorlevel 1 (
  echo.
  echo [ERROR] INSTALL COPY FAILED
  echo FROM: %~1
  echo TO:   %~2
  exit /b 1
)
exit /b 0

:fail
echo.
echo ============================================================
echo   INSTALL STOPPED
echo ============================================================
echo No further files were copied after the failure.
echo Backup folder:
echo   %BACKUP%
echo.
pause
exit /b 1
