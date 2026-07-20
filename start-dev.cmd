@echo off
setlocal
set "ROOT=%~dp0"
set "PATH=%ROOT%tools\node-v24.15.0-win-x64;%PATH%"
cd /d "%ROOT%"
npm run dev
