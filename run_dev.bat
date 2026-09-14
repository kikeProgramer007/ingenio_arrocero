@echo off
title Project Launcher
color 0A

set BACKEND_PATH=backend
set FRONTEND_PATH=frontend

:init
cls
echo **********************************************
echo          LEVANTANDO PROYECTO FULLSTACK
echo **********************************************
echo.
echo [1] Primera ejecucion (despues de clonar)
echo [2] Ejecucion normal (desarrollo)
echo [3] Build de produccion
echo [4] Salir
echo.
set /p choice="Selecciona una opcion (1-4) y presiona Enter: "

if "%choice%"=="1" goto first_run
if "%choice%"=="2" goto normal_run
if "%choice%"=="3" goto production_build
if "%choice%"=="4" exit

echo Opcion invalida: %choice%
echo Por favor selecciona una opcion valida (1-4)
timeout /t 2 >nul
goto init

:first_run
echo.
echo === VERIFICANDO DEPENDENCIAS DEL BACKEND ===
cd %BACKEND_PATH%
if not exist "node_modules" (
    echo Instalando dependencias del backend...
    npm install
) else (
    echo Dependencias del backend ya instaladas. Saltando instalacion...
)
cd ..

echo.
echo === COMPILACION INICIAL DEL BACKEND ===
cd %BACKEND_PATH%
npx tsc
cd ..

echo.
echo === VERIFICANDO DEPENDENCIAS DEL FRONTEND ===
cd %FRONTEND_PATH%
if not exist "node_modules" (
    echo Instalando dependencias del frontend...
    npm install
) else (
    echo Dependencias del frontend ya instaladas. Saltando instalacion...
)
cd ..
goto normal_run

:normal_run
echo.
echo === INICIANDO BACKEND (con recarga en caliente) ===
start "Backend TS Watcher" cmd /k "cd %BACKEND_PATH% && npm run typescript"

echo.
echo === INICIANDO SERVIDOR BACKEND ===
start "Backend Server" cmd /k "cd %BACKEND_PATH% && npm run dev"

echo.
echo === INICIANDO FRONTEND ===
start "Frontend Server" cmd /k "cd %FRONTEND_PATH% && ng serve --o"

echo.
echo Proyectos iniciados correctamente!
echo - Backend: http://localhost:3001
echo - Frontend: http://localhost:4200
echo.
echo Los servidores se estan ejecutando en ventanas independientes.
echo.
echo Presiona cualquier tecla para cerrar ESTA ventana...
pause >nul
exit

:production_build
echo.
echo === BUILD DE PRODUCCION ===
cd %FRONTEND_PATH%
ng build --configuration production
cd ..
echo Build de produccion completado en frontend/dist/
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
exit