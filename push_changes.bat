@echo off
cd /d C:\Projects\OviCore_Next.js

echo.
echo ==========================================
echo OviCore Git Upload
echo ==========================================
echo.

echo Checking changed files...
git status

echo.
set /p MSG=Enter commit message, or press Enter for default: 

if "%MSG%"=="" set MSG=Update OviCore changes

echo.
echo Adding all changed files...
git add .

echo.
echo Committing changes...
git commit -m "%MSG%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ==========================================
echo Done. Vercel should now redeploy dev.ovicore.com.au
echo ==========================================
echo.

pause