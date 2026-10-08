@echo off
cd /d "%~dp0"
title Notificaciones - El Chingadazo
node scripts\guard-deploy.cjs
if errorlevel 1 goto error
echo Selecciona la cuenta de servicio EXCLUSIVA de El Chingadazo.
set "CHINGADAZO_SERVICE_FILE=%~1"
if not "%CHINGADAZO_SERVICE_FILE%"=="" goto selected
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog=New-Object System.Windows.Forms.OpenFileDialog; $dialog.Filter='JSON (*.json)|*.json'; if($dialog.ShowDialog() -eq 'OK'){$dialog.FileName}"`) do set "CHINGADAZO_SERVICE_FILE=%%F"
:selected
node scripts\configure-firebase-push.mjs "%CHINGADAZO_SERVICE_FILE%"
if errorlevel 1 goto error
call npx wrangler secret put FIREBASE_WEB_VAPID_KEY --name el-chingadazo
pause
exit /b 0
:error
echo Configuracion incompleta. Revisa las indicaciones anteriores.
pause
exit /b 1
