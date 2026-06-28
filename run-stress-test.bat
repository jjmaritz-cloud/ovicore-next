@echo off
cd /d C:\Projects\OviCore_Next.js

echo.
echo ==========================================
echo OviCore Sandbox Stress Test
echo ==========================================
echo.

echo Checking for k6...
where k6 >nul 2>nul

if errorlevel 1 (
    echo.
    echo ERROR: k6 is not installed or not found in PATH.
    echo.
    echo Install k6 first:
    echo https://grafana.com/docs/k6/latest/set-up/install-k6/
    echo.
    pause
    exit /b 1
)

echo k6 found.
echo.

if not exist stress-test-ovicore.js (
    echo ERROR: stress-test-ovicore.js was not found in:
    echo C:\Projects\OviCore_Next.js
    echo.
    echo Please create the stress-test-ovicore.js file first.
    echo.
    pause
    exit /b 1
)

echo Running stress test against sandbox...
echo.

k6 run stress-test-ovicore.js

echo.
echo ==========================================
echo Stress test complete
echo ==========================================
echo.

pause