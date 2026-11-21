@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo   Bilingual Scripture Reader - Windows Launcher
echo ==================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found in PATH.
    echo Please install Node.js 20+ from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\tsx.cmd" (
    echo Installing dependencies ^(first-time setup^)...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install failed. Check the output above.
        pause
        exit /b 1
    )
    echo.
)

echo Starting server on http://localhost:3000 ...
echo Press Ctrl+C in this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server exited with an error.
    pause
)
