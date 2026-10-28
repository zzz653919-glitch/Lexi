@echo off
rem Runs Lexi as a Windows desktop app (needs Node.js from https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing Electron - first run only...
  call npm install
)
call npm start
