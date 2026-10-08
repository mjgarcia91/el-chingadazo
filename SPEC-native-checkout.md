# Especificación: native-checkout

Estado: reglas de cobro, liberación automática y botón manual confirmadas por el
propietario. Depende de native-tables. Una sola entrega integrada.

## Objetivo

Cobrar mostrador y cuentas de mesa con el mismo servidor y turnos del sistema web.
Efectivo, tarjeta o transferencia; recibido/cambio visibles. Dos acciones claras:
«Cobrar e imprimir» y «Cobrar sin imprimir». Ninguna captura datos de tarjeta.

## Contratos y política propuesta

- Sesión de admin/cashier verificada y turno propio abierto. Reutilizar
  GET/PUT /api/data/shifts/{id} y POST /api/close-shift; fondo, arqueo y nota
  conservan validaciones existentes. No abrir/cerrar turno automáticamente.
- Mostrador: PUT /api/data/orders/{id} con ID durable único, productos y total
  revisados, pago recibido y shiftId. El servidor calcula importes y confirma paidAt
  e invoiced. Consultar el mismo pedido tras resultado desconocido, no otro ID.
- Mesa: POST /api/dining action=checkout con accountId, operationId,
  expectedRevision, shiftId, payment, payWith. Mantener cuerpo y propietario del
  intento. Recuperar el resultado registrado antes de permitir otro cobro.
- No confiar solo en HTTP 200: comprobar identidad/ID, importe, contenido y estado
  del comprobante. Respuesta incompleta o discrepante queda pendiente de conciliación.
- No cobrar offline. No limpiar carrito ni mostrar pagado antes de confirmación.
- Política confirmada de simplificación: tras pago confirmado, liberar la mesa con
  action=release y un ID distinto durable. Si falla, mostrar «Pagada · pendiente de
  liberar» y permitir recuperar esa liberación sin repetir cobro. No tratar el
  fallo de impresión/liberación como fallo del pago. Un conflicto exige refrescar
  y verificar que sigue siendo la misma ocupación antes de preparar otro release.
- El botón «Liberar mesa» reutiliza exactamente este flujo y diario. No crea una
  vía alternativa que omita pago, revisión o comprobación de la ocupación.
- Conservar historial y ventas. No liberar otras mesas, anular saldos ni ejecutar
  cambios comerciales reales como pruebas.
- Emitir evento durable para native-printing solo después de confirmación:
  venta/operación, elección de impresión e importe de cambio. No reemitirlo al
  reabrir una pantalla. Los errores de red/disco se muestran sin secretos.

## Tecnología, estructura y estilo

Java 8/API23, sin WebView y sin nuevas dependencias. android/src/hn/chingadazo/pos/
para coordinador y vistas; android/test/ para fallos simulados; tests/ para paridad
con contratos server/access.js y server/dining-checkout.js. Importes locales en
centavos; el servidor es autoridad final. Ejemplo:
`if (!confirmed) return pendingOperation;` (regla, no API implementada).

## Verificación

Desde EL-CHINGADAZO: `npm test`; `./android/build.ps1 -NativePos`.
Probar importe exacto/cambio/insuficiente, tarjeta/transferencia, turno cerrado/ajeno,
doble toque, caída tras pago durable, reinicio, conflicto, liberación fallida,
disco lleno y operador cambiado. Pruebas con servidor/almacenamiento aislados.
Android: teclado, importes, recuperación y navegación. Validación física coordinada
en un momento tranquilo, no exigir personal fuera de horario.

## Aceptación y fronteras

Una venta confirmada por intento; sin duplicados ni pérdidas al reiniciar; mesa
liberada solo tras pago confirmado; pendientes visibles y recuperables. Cuenta actual
operativa intacta hasta validación integrada. Siempre validar permisos/turno/revisión.
Consultar cambios de esquema o política comercial. Nunca marcar pago por un ticket,
inventar confirmación bancaria, almacenar tarjeta, borrar historial o quitar controles.

