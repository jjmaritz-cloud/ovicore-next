@echo off
setlocal

cd /d C:\Projects\OviCore_Next.js

echo.
echo ==========================================
echo OviCore Project Backup
echo ==========================================
echo.

set BACKUP_ROOT=C:\Projects\OviCore_Next.js\_BACKUP_

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set TIMESTAMP=%%i

set BACKUP_DEST=%BACKUP_ROOT%\OviCore_Backup_%TIMESTAMP%

echo Backup destination:
echo %BACKUP_DEST%
echo.

if not exist "%BACKUP_ROOT%" (
    mkdir "%BACKUP_ROOT%"
)

echo Creating backup...
echo.

robocopy "C:\Projects\OviCore_Next.js" "%BACKUP_DEST%" /E /XD "_BACKUP_" /R:1 /W:1 /MT:8 /TEE /LOG:"%BACKUP_DEST%_backup_log.txt"

set ROBOCOPY_EXIT=%ERRORLEVEL%

echo.
echo ==========================================
echo Backup finished
echo ==========================================
echo.

if %ROBOCOPY_EXIT% LEQ 7 (
    echo Backup completed successfully.
    echo.
    echo Saved to:
    echo %BACKUP_DEST%
) else (
    echo Backup completed with errors.
    echo Robocopy exit code: %ROBOCOPY_EXIT%
    echo Check the log file:
    echo %BACKUP_DEST%_backup_log.txt
)

echo.
pause