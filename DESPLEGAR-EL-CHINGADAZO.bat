@echo off
cd /d "%~dp0"
title Despliegue independiente - El Chingadazo
call npm run deploy
if errorlevel 1 goto error
echo Despliegue de El Chingadazo completado.
pause
exit /b 0
:error
echo Despliegue detenido. Revisa los requisitos indicados.
pause
exit /b 1
