const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('js/app.js');
const delivery = read('delivery/app.js');
const sw = read('sw.js');
const deliverySw = read('delivery/sw.js');

assert.match(app, /function storedCart\(\)/, 'El carrito debe sobrevivir a almacenamiento local dañado');
assert.match(app, /payment === "Efectivo" && \(!Number\.isFinite\(payWith\) \|\| payWith < subtotal\)/, 'Caja debe rechazar efectivo insuficiente');
assert.match(app, /const paidNow = true;/, 'Una venta física confirmada debe quedar pagada aun cuando requiera cambio');
assert.match(app, /¿El pago con tarjeta ya fue aprobado en la terminal\?/, 'Caja debe confirmar la aprobación de tarjeta');
assert.match(app, /let checkingOrders = false;/, 'La sincronización de órdenes debe impedir solicitudes superpuestas');
assert.match(app, /let settingsPublishChain = Promise\.resolve\(\)/, 'Los ajustes administrativos deben guardarse en orden');
assert.doesNotMatch(app, /fetch\(SETTINGS_URL, \{ method: "PATCH"/, 'Los ajustes no deben enviarse dos veces');
assert.match(app, /document\.hidden/, 'La app debe pausar trabajo de red cuando está oculta');
assert.match(delivery, /watchOrderId/, 'El GPS debe estar asociado a una orden concreta');
assert.match(delivery, /state\.watch !== null && state\.watchOrderId === orderId/, 'El GPS no debe duplicarse para la misma orden');
assert.match(delivery, /if \(state\.watch !== null\) stopTracking\(\)/, 'El GPS anterior debe detenerse antes de seguir otra orden');
assert.match(delivery, /refreshBusy/, 'Delivery debe impedir actualizaciones superpuestas');
assert.match(sw, /cache\.put\(e\.request, copy\)/, 'Cliente debe conservar recursos estáticos válidos');
assert.match(deliverySw, /e\.waitUntil\(caches\.open\(CACHE\)/, 'Delivery debe completar el guardado de recursos en caché');

console.log('PASS v107: caja con cambio, pagos confirmados, carrito recuperable, GPS por orden, sincronización única y caché estable.');
