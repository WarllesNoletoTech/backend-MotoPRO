@echo off
setlocal
cd /d "%~dp0"
echo Iniciando MotoPRO BACKEND...
echo.
if not exist node_modules (echo Dependencias nao instaladas. Execute npm install primeiro.&pause&exit /b 1)
npm run dev
pause
