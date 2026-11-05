@echo off
setlocal
cd /d "%~dp0"
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
 echo Instalo Node.js 24 ose me te ri.
 pause
 exit /b 1
)
if not exist "node_modules\.bin\tsc.cmd" goto install
if not exist "node_modules\@pdf-lib\fontkit\package.json" goto install
goto start
:install
call npm ci --include=dev
if errorlevel 1 (
 echo Instalimi deshtoi. Mbyll serveret e vjeter. Perdor dosje te re jashte OneDrive.
 pause
 exit /b 1
)
:start
set "APP_URL=http://localhost:5173"
set "PORT=3001"
echo Hap http://localhost:5173 dhe provo te dhenat shembull.
call npm run dev
pause
