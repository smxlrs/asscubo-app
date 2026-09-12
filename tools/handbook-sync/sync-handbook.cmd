@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python "%~dp0sync_handbook.py" %*
) else (
  py -3 "%~dp0sync_handbook.py" %*
)
set "sync_exit=%errorlevel%"
echo.
pause
exit /b %sync_exit%
