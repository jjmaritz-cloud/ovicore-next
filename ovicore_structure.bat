@echo off
echo ============================================================
echo OVICORE RELEVANT FILE STRUCTURE
echo ============================================================
echo.

echo --- BROILER APP ---
tree frontend\src\app\broilers /F

echo.
echo --- COMPONENTS ---
dir frontend\src\components /S /B | findstr /I "Broiler Sidebar Daily House Entry Flock Farm Shed"

echo.
echo --- DAILY ENTRY / HOUSE SHEET FILES ---
dir frontend\src /S /B | findstr /I "daily entry house performance"

echo.
echo --- FARM / SHED / FLOCK REFERENCES ---
findstr /S /I /M ^
"farm_name shed_name flock_name placement_plan_id company_id opening_birds mortality_front" ^
frontend\src\*.tsx frontend\src\*.ts

echo.
echo ============================================================
echo DONE
echo ============================================================
pause