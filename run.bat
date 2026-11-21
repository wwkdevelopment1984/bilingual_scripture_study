@echo off
cd /d "%~dp0"
npm install --legacy-peer-deps && npm run dev
if %errorlevel% neq 0 pause
