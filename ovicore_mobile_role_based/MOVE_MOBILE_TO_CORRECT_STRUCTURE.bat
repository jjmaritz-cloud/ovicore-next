@echo off
setlocal
cd /d C:\Projects\OviCore_Next.js\frontend

echo.
echo Moving OviCore mobile files into the existing src-based Next.js app...
echo.

if not exist src\app\mobile mkdir src\app\mobile
if not exist src\lib mkdir src\lib

if exist app\mobile\page.tsx move /Y app\mobile\page.tsx src\app\mobile\page.tsx
if exist app\mobile\layout.tsx move /Y app\mobile\layout.tsx src\app\mobile\layout.tsx
if exist app\mobile\mobile.module.css move /Y app\mobile\mobile.module.css src\app\mobile\mobile.module.css
if exist lib\mobileHouseSheetDb.ts move /Y lib\mobileHouseSheetDb.ts src\lib\mobileHouseSheetDb.ts

echo.
echo Removing only the accidental empty root app/lib folders...
if exist app\mobile rmdir app\mobile 2>nul
if exist app\layout.tsx del /Q app\layout.tsx
if exist app rmdir app 2>nul
if exist lib rmdir lib 2>nul

echo.
echo Done. Now run:
echo npm.cmd run build
echo.
pause
