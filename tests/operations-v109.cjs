const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('js/app.js'),worker=read('_worker.js'),access=read('server/access.js'),printer=read('js/printer.js'),styles=read('css/styles.css');

assert.match(app,/toggleDelivery/);
assert.match(app,/Delivery PAUSADO/);
assert.match(app,/Disponible para llevar/);
assert.match(worker,/operations\/settings/);
assert.match(access,/deliveryEnabled===false/);

assert.match(worker,/closeShiftSecure/);
assert.match(worker,/RESEND_API_KEY/);
assert.match(worker,/env.SHIFT_REPORT_TO\|\|settings.shiftReportEmail/);
assert.match(worker,/Detalle de transacciones/);
assert.match(app,/Reintentar correo/);

assert.match(app,/staffDirectory/);
assert.match(app,/data-staff-select/);
assert.match(app,/staff-keypad/);
assert.match(app,/salesTotal/);
assert.match(app,/staffAvatarFile/);
assert.match(styles,/staff-login-layout/);

assert.match(printer,/navigator\.usb\.requestDevice/);
assert.match(printer,/releaseInterface/);
assert.match(printer,/0x70/);
assert.match(printer,/0x56/);
assert.match(app,/Conectar impresora integrada/);
assert.match(app,/Facturar sin imprimir/);
assert.match(app,/STAFF_DEVICE_MODE/);
assert.match(app,/Entrar como administrador con correo/);
assert.match(app,/data-staff-pin-form/);
assert.doesNotMatch(app,/data-open-staff/);
assert.match(app,/PERSONAL_PATH/);
assert.match(worker,/resetStaffPin/);
assert.match(worker,/profileId/);
assert.match(read('sw.js'),/chingadazo-v131/);

console.log('PASS base v109: recuperación administrativa y PIN migrable conservados en v111.');
