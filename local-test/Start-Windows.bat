@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or 24 LTS from https://nodejs.org then reopen this file.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=22?0:1)"
if errorlevel 1 (
  echo Update Node.js to version 22 or 24 LTS, then reopen this file.
  pause
  exit /b 1
)
if exist adapter.ts if exist ..\scripts\start-local.mjs (
  node ..\scripts\start-local.mjs
  pause
  exit /b
)
node start-server.mjs --lan --open
pause
