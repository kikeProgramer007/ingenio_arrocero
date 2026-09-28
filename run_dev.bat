@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Ingenio Arrozero - Desarrollo
color 0A

cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] No se pudo entrar a la carpeta del script.
    goto halt
)

set "ROOT=%cd%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "HAD_WARNINGS=0"

if /i "%~1"=="build" goto production_build

echo.
echo **********************************************
echo    INGENIO ARROZERO - DESARROLLO LOCAL
echo **********************************************
echo Carpeta: %ROOT%
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta en el PATH.
    echo Instala Node y vuelve a abrir esta ventana.
    goto halt
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta en el PATH.
    echo Reinstala Node.js, incluye npm.
    goto halt
)

if not exist "%BACKEND%\package.json" (
    echo [ERROR] No se encontro backend\package.json
    goto halt
)
if not exist "%FRONTEND%\package.json" (
    echo [ERROR] No se encontro frontend\package.json
    goto halt
)
if not exist "%BACKEND%\src\index.ts" (
    echo [ERROR] No se encontro el codigo fuente del backend.
    goto halt
)
if not exist "%BACKEND%\.env" (
    echo [ERROR] Falta backend\.env con la conexion a la base de datos.
    goto halt
)

if not exist "%BACKEND%\certs\isrgrootx1.pem" (
    echo [ADVERTENCIA] Falta backend\certs\isrgrootx1.pem. TiDB Cloud puede fallar por SSL.
    set "HAD_WARNINGS=1"
)

findstr /i /c:"DB_NAME=sys" "%BACKEND%\.env" >nul 2>&1
if not errorlevel 1 (
    echo [ADVERTENCIA] DB_NAME=sys es un esquema de sistema. Conviene una base propia: db_empresas o test.
    set "HAD_WARNINGS=1"
)

echo [OK] Node y npm disponibles
for /f "tokens=*" %%v in ('node -v') do echo      Node %%v
for /f "tokens=*" %%v in ('npm -v') do echo      npm  %%v
echo.

call :ensure_npm "%BACKEND%" backend
if errorlevel 1 goto halt
call :ensure_npm "%FRONTEND%" frontend
if errorlevel 1 goto halt

echo === Compilando backend: npx tsc ===
pushd "%BACKEND%"
call npx tsc
set "TSC_ERR=!errorlevel!"
popd
if not "!TSC_ERR!"=="0" (
    echo [ERROR] Fallo la compilacion TypeScript del backend.
    goto halt
)
if not exist "%BACKEND%\dist\index.js" (
    echo [ERROR] No se genero backend\dist\index.js. No se puede arrancar el servidor.
    goto halt
)
echo [OK] Backend compilado
echo.

call :check_port 3001 backend
call :check_port 4200 frontend

echo === Levantando procesos ===
start "Backend TS Watcher" /D "%BACKEND%" cmd /k "echo Compilacion en caliente tsc --watch && npm run typescript"
start "Backend Server" /D "%BACKEND%" cmd /k "echo API: http://localhost:3001 && npm run dev"
start "Frontend Server" /D "%FRONTEND%" cmd /k "echo App: http://localhost:4200 && npx ng serve -o --port 4200"

echo.
echo **********************************************
echo    LISTO PARA DESARROLLAR
echo **********************************************
echo  Backend : http://localhost:3001
echo  Frontend: http://localhost:4200
echo.
echo  Se abrieron 3 ventanas. Cierra esas ventanas para detener los servidores.
if "!HAD_WARNINGS!"=="1" echo.
if "!HAD_WARNINGS!"=="1" echo  Hubo advertencias. El sistema se levanto igual. Revisa el texto de arriba.
echo.
pause
exit /b 0

:production_build
echo.
echo === BUILD DE PRODUCCION frontend ===
if not exist "%FRONTEND%\package.json" (
    echo [ERROR] No se encontro frontend\package.json
    goto halt
)
call :ensure_npm "%FRONTEND%" frontend
if errorlevel 1 goto halt
pushd "%FRONTEND%"
call npx ng build --configuration production
set "BUILD_ERR=!errorlevel!"
popd
if not "!BUILD_ERR!"=="0" (
    echo [ERROR] Fallo el build de produccion del frontend.
    goto halt
)
echo [OK] Build en frontend\dist\
echo.
pause
exit /b 0

:ensure_npm
set "DIR=%~1"
set "LABEL=%~2"
if exist "%DIR%\node_modules\" (
    echo [OK] Dependencias de %LABEL% ya instaladas
    exit /b 0
)
echo === Instalando dependencias de %LABEL% ===
pushd "%DIR%"
call npm install
set "NPM_ERR=!errorlevel!"
popd
if not "!NPM_ERR!"=="0" (
    echo [ERROR] npm install fallo en %LABEL%.
    exit /b 1
)
if not exist "%DIR%\node_modules\" (
    echo [ERROR] npm install termino pero no existe %LABEL%\node_modules
    exit /b 1
)
echo [OK] Dependencias de %LABEL% instaladas
echo.
exit /b 0

:check_port
netstat -ano 2>nul | findstr /R /C:":%~1 .*LISTENING" >nul
if not errorlevel 1 (
    echo [ADVERTENCIA] El puerto %~1 ya esta en uso - %~2. Cierra el proceso anterior si hace falta.
    set "HAD_WARNINGS=1"
)
exit /b 0

:halt
echo.
echo El arranque se DETUVO. Corrige el error y vuelve a ejecutar run_dev.bat
echo.
pause
exit /b 1
