@echo off
setlocal enableextensions
cd /d "%~dp0"
call config.bat
title Crackers Shop - Setup
echo ==================================================
echo   Crackers Shop - First Time Setup
echo ==================================================
echo.

rem ---- 1. Check Node.js ----
set NODE_OK=0
where node >nul 2>nul
if errorlevel 1 goto :checked
for /f "tokens=1 delims=." %%v in ('node -v') do set NODEVER=%%v
set NODEVER=%NODEVER:v=%
if %NODEVER% GEQ %REQUIRED_NODE_MAJOR% set NODE_OK=1
:checked

if %NODE_OK%==1 (
  for /f %%v in ('node -v') do echo [OK] Node.js %%v found.
  goto :folders
)

echo [!] Node.js %REQUIRED_NODE_MAJOR% LTS not found on this computer.
where winget >nul 2>nul
if %errorlevel%==0 (
  echo Installing Node.js LTS using winget. Please accept any prompt...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Node.js installed. Please CLOSE this window and run setup.bat again
  echo so that the new Node.js is detected.
  pause
  exit /b 0
)
echo.
echo winget is not available. Please install Node.js 24 LTS manually:
echo     https://nodejs.org/en/download
echo Then run setup.bat again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:folders
rem ---- 2. Create data folders ----
if not exist "data" mkdir "data"
if not exist "data\backups" mkdir "data\backups"
echo [OK] Data folders ready.

rem ---- 3. Quick self-test ----
node -e "require('./seed'); console.log('[OK] Application files are fine.')"
if errorlevel 1 (
  echo [X] Application files are missing or damaged.
  pause
  exit /b 1
)

rem ---- 4. Firewall note ----
echo.
echo ==================================================
echo   Setup complete!
echo.
echo   Start the shop :  double-click  start.bat
echo   Stop the shop  :  double-click  stop.bat
echo.
echo   Shop website   :  http://localhost:%PORT%/
echo   Admin / Billing:  http://localhost:%PORT%/admin
echo   Default admin password: admin123  (change it in Settings)
echo ==================================================
echo.
set /p GO=Start the shop now? (Y/N): 
if /i "%GO%"=="Y" call "%~dp0start.bat"
endlocal
