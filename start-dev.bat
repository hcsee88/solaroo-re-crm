@echo off
title Solaroo RE CRM — Dev Server

echo.
echo  =============================================
echo   Solaroo RE CRM — Starting Dev Environment
echo  =============================================
echo.

REM ── Step 1: Try to start PostgreSQL via Docker (optional) ────────────────────
echo [1/3] Attempting to start PostgreSQL (Docker)...
docker start solaroo-postgres >nul 2>&1
if %errorlevel% neq 0 (
  echo       Docker not running or container not found — skipping.
  echo       Make sure PostgreSQL is accessible before logging in.
) else (
  echo       PostgreSQL started via Docker.
)
echo.

REM ── Step 2: Start API in a new terminal window ───────────────────────────────
echo [2/3] Starting API server on port 4000...
start "Solaroo API (port 4000)" cmd /k "cd /d "%~dp0" && pnpm --filter @solaroo/api dev"
echo       API starting — wait for "API running on http://localhost:4000/api"
echo.

REM ── Pause briefly so API gets a head start ───────────────────────────────────
timeout /t 3 /nobreak >nul

REM ── Step 3: Start Frontend in a new terminal window ─────────────────────────
echo [3/3] Starting Frontend on port 3000...
start "Solaroo Web (port 3000)" cmd /k "cd /d "%~dp0" && pnpm --filter @solaroo/web dev"
echo       Frontend starting — wait for "Ready in Xms"
echo.

echo  =============================================
echo   Both servers are starting in separate windows.
echo.
echo   Once ready, open your browser:
echo   http://localhost:3000
echo.
echo   Super Admin:  see@pekatgroup.com / Solaroo123!
echo   Director:     director@pekatgroup.com / Test@1234
echo   PMO Manager:  pmo@pekatgroup.com / Test@1234
echo  =============================================
echo.
echo  You can close this window now.
echo.
pause
