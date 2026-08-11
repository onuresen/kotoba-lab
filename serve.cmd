@echo off
REM ---------------------------------------------------------------------------
REM  Kotoba Lab — start the app.
REM
REM  Double-click this file, or run it from a terminal:
REM
REM      serve.cmd              serve this folder and open the browser
REM      serve.cmd 8080         use a specific port
REM
REM  Why this is needed: index.html loads ES modules and fetches its
REM  dictionaries from data\. A browser blocks both when the page is opened
REM  straight off disk (file://), so the page loads but nothing responds —
REM  pasting does nothing and the tabs don't switch. Serving it over http is the
REM  fix, and that is all this does.
REM
REM  Ctrl+C stops the server.
REM ---------------------------------------------------------------------------

setlocal
cd /d "%~dp0"

where node >nul 2>&1
if not errorlevel 1 (
  node serve.mjs %*
  if errorlevel 1 pause
  exit /b 0
)

REM No Node. Python can serve a folder too — it just won't open the browser or
REM pick a free port for us, so say where to go.
where py >nul 2>&1 && set "PY=py"
if not defined PY where python >nul 2>&1 && set "PY=python"

if defined PY (
  set "PORT=%~1"
  if not defined PORT set "PORT=5506"
  echo.
  echo   Node was not found, so falling back to Python.
  echo   Open  http://localhost:%PORT%/  once it says "Serving HTTP".
  echo.
  start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/'"
  %PY% -m http.server %PORT% --bind 127.0.0.1
  if errorlevel 1 pause
  exit /b 0
)

echo.
echo   Neither Node.js nor Python was found on PATH, so the app cannot be served.
echo.
echo   Install Node.js from https://nodejs.org and run this again.
echo   ^(Opening index.html by double-clicking it will NOT work — the browser
echo    blocks the module scripts and the dictionary files.^)
echo.
pause
exit /b 1
