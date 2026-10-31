@echo off
setlocal enableextensions
cd /d "%~dp0"
call config.bat
title Crackers Shop - Start

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please run setup.bat first.
  pause
  exit /b 1
)

rem ---- port already in use? ----
set RUNNING=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":%PORT% .*LISTENING"') do set RUNNING=1
if %RUNNING%==1 (
  powershell -NoProfile -Command "try{$r=Invoke-RestMethod http://localhost:%PORT%/api/public -TimeoutSec 3; if($r.settings){exit 0}else{exit 1}}catch{exit 1}" >nul 2>nul
  if not errorlevel 1 (
    echo Shop server is already running on port %PORT%.
    start "" "http://localhost:%PORT%/"
    timeout /t 3 >nul
    exit /b 0
  )
  echo.
  echo [X] Port %PORT% is being used by ANOTHER program.
  echo     Open config.bat and change PORT to a free number, e.g. 5281, then run start.bat again.
  pause
  exit /b 1
)

if not exist "data" mkdir "data"
echo Starting Crackers Shop server on port %PORT% ...
rem Run hidden in background; log goes to data\server.log
start "CrackersShopServer" /min cmd /c "set PORT=%PORT%&& set HOST=%HOST%&& node server.js >> data\server.log 2>&1"

rem ---- wait until the server answers (max ~15 sec) ----
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/public -TimeoutSec 2).StatusCode}catch{exit 1}" >nul 2>nul
if not errorlevel 1 goto :up
if %tries% GEQ 15 goto :fail
timeout /t 1 >nul
goto :wait

:up
echo.
echo [OK] Shop is running!
echo     Website : http://localhost:%PORT%/
echo     Admin   : http://localhost:%PORT%/admin
start "" "http://localhost:%PORT%/"
timeout /t 3 >nul
exit /b 0

:fail
echo.
echo [X] Server did not start. See data\server.log for the reason.
pause
exit /b 1
