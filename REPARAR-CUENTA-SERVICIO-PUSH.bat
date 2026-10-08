@echo off
cd /d "%~dp0"
rem El lanzador valida el proyecto antes de ejecutar configure-firebase-push.mjs.
call CONFIGURAR-NOTIFICACIONES-PUSH.bat "%~1"
