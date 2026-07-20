@echo off
setlocal

REM ============================================================
REM Lecture Poster Generator - one-click launcher
REM
REM Usage:
REM   1. Double-click this file, or run it in cmd.
REM   2. The script cd's to the project folder automatically.
REM   3. It detects port conflicts and picks a free port.
REM   4. Next.js starts both the frontend and backend API routes.
REM   5. The default browser opens after the service is ready.
REM   6. Close this window to stop the dev server.
REM ============================================================

set "PROJECT_DIR=C:\Users\sangu\Documents\Codex\2026-05-31\files-mentioned-by-the-user-222e2ac9252eb153876e248c89502f8"
set "LAUNCHER=%PROJECT_DIR%\launch-poster-generator.ps1"

cd /d "%PROJECT_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%"

if errorlevel 1 (
  echo.
  echo Launch failed. Please check the messages above.
  pause
)

endlocal
