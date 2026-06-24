@echo off
cd /d "C:\Projects\OviCore_Next.js\frontend"
npm install
npm install ag-grid-react ag-grid-community
echo.
echo Starting Next.js on http://localhost:3000
npm run dev -- -p 3000
pause
