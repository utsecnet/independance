@echo off
setlocal
cd /d "%~dp0"
set "INDEPENDANCE_DATA_DIR=%~dp0data"
set "CLIENT_DIST_DIR=%~dp0client"
if "%PORT%"=="" set "PORT=5175"
start "independance server" /min "%~dp0node\node.exe" "%~dp0server\server.cjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%"
