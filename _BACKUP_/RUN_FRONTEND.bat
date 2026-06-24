@echo off
title OviCore Frontend - Next.js
cd /d "C:\Projects\OviCore_Next.js\frontend"
echo Starting OviCore frontend...
echo.
call npm install
call npm install ag-grid-react ag-grid-community
echo.
echo Frontend starting on http://localhost:3000
echo.
call npm run dev -- -p 3000
echo.
echo Frontend stopped.
pause
