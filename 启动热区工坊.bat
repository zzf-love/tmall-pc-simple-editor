@echo off
setlocal
title PC Storefront Editor - Tmall Edition
set "PUTU_NODE="

if exist "%~dp0runtime\node.exe" set "PUTU_NODE=%~dp0runtime\node.exe"
if not defined PUTU_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PUTU_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if defined PUTU_NODE goto run

where node >nul 2>nul
if errorlevel 1 goto missing
set "PUTU_NODE=node"

:run
"%PUTU_NODE%" "%~dp0serve.mjs"
set "PUTU_EXIT=%ERRORLEVEL%"
if "%PUTU_EXIT%"=="0" goto end
echo.
echo The editor failed to start. Error code: %PUTU_EXIT%
echo Keep this window open and send the error above to Codex.
echo.
pause
goto end

:missing
echo.
echo Node.js was not found, so the editor cannot start.
echo Install Node.js from https://nodejs.org/ and try again.
echo.
pause

:end
endlocal

