@echo off
setlocal enableextensions
cd /d "%~dp0"
title Crackers Shop - Stop

rem Stops ONLY the crackers shop server (its process id is saved in data\server.pid).
rem Other projects on other ports are not touched.
if not exist "data\server.pid" (
  echo Shop server is not running.
  timeout /t 3 >nul
  exit /b 0
)
set /p SPID=<"data\server.pid"
tasklist /FI "PID eq %SPID%" /FI "IMAGENAME eq node.exe" 2>nul | find "node.exe" >nul
if errorlevel 1 (
  echo Shop server was not running. Cleaning up.
  del "data\server.pid" >nul 2>nul
  timeout /t 3 >nul
  exit /b 0
)
taskkill /F /T /PID %SPID% >nul 2>nul
del "data\server.pid" >nul 2>nul
echo [OK] Shop server stopped.
timeout /t 3 >nul
exit /b 0
