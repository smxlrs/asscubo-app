@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python -m pip install --target "%~dp0.tools" pypandoc_binary==1.17
) else (
  py -3 -m pip install --target "%~dp0.tools" pypandoc_binary==1.17
)
pause
