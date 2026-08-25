@echo off
echo ============================================================
echo OVICORE BROILER BACKEND SEARCH V2
echo ============================================================
echo.

echo --- BACKEND PYTHON FILES ---
dir /S /B backend\*.py

echo.
echo --- FILES CONTAINING broilers/performance ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"broilers/performance" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING mortality_front ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"mortality_front" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING cull_legs ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"cull_legs" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING feed_kg ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"feed_kg" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING APIRouter ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"APIRouter" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING include_router ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"include_router" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo --- FILES CONTAINING UploadFile ---
for /R backend %%F in (*.py) do (
    findstr /I /C:"UploadFile" "%%F" >nul 2>&1
    if not errorlevel 1 echo %%F
)

echo.
echo ============================================================
echo DONE
echo ============================================================
pause