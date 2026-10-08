# Continuidad local de Caja

Estado al 2026-09-28: publicado con autorización en `c629a5a8-fabd-4307-877f-7b1c7f41b01c`. No se modificó Típicos ni se crearon ventas reales para las pruebas. Persisten los límites de ensayos físicos y teléfonos reales descritos abajo.

## Qué conserva

La cuenta en preparación de Caja: productos, cantidades, opciones, notas, nombre opcional, canal y forma/importe de pago. Se guarda por empleado en este navegador. No es todavía el módulo de mesas ni comparte borradores entre celulares.

Esperar el aviso «Consumos guardados en este equipo». «Guardando» o un error no garantizan recuperación. Si falla el almacenamiento, no se permite enviar el cobro. Una segunda pestaña del mismo empleado queda bloqueada hasta cerrar la primera y volver a entrar.

Sin internet se conservan consumos; no se registran cobros ni se confirma envío a cocina. Después de cerrar o reiniciar la app, hay que recuperar conexión e iniciar sesión para abrir la cuenta guardada. No se almacenan PIN ni tokens en este mecanismo.

Si hubo un intento de cobro cuya respuesta se perdió, aparece «Consultar venta pendiente». La app busca ese mismo identificador antes de volver a enviarlo. Si el servidor ya confirmó la misma venta, limpia el pendiente local sin repetir impresión ni cobro. Ante otra cuenta, cambio de turno, sesión vencida o error, conserva el intento para revisión. No hay descarte automático ni traslado del pendiente a otro empleado.

No borrar los datos del navegador ni usar navegación privada para una caja operativa. Perder el dispositivo o borrar su almacenamiento puede perder consumos que nunca llegaron al servidor. El respaldo diario del servidor no incluye estos borradores locales. No se promete pérdida cero ante un corte físico.

## Formato y contrato

- IndexedDB `chingadazo-continuity-v1`, almacén `accounts`, versión 1. Clave con proyecto `el-chingadazo-cfe45` y operador autenticado. Transacción con durabilidad estricta; el aviso de éxito espera su finalización.
- Web Lock exclusivo por esa clave. Un rol o registro local no concede permisos; los servicios mantienen su autorización remota.
- Transiciones: borrador → solicitud exacta persistida → resultado incierto/confirmado → borrador vacío después de confirmar en servidor. No se reintenta con otro identificador.
- Se conserva el contrato GET/PUT `/api/data/orders/:id`; no se agregan rutas ni campos remotos. GET puede devolver `null`; 401/403 o conflicto preservan la solicitud.
- Protección adicional del PUT: una orden cobrada no acepta cambios de forma de pago, efectivo, turno o cliente; una colisión de creación de Caja rechaza contenido comercial distinto con 409. Un reintento de la transacción concurrente no repite `onOrderCreated` por un indicador de creación obsoleto.
- Si cambia el precio o el servidor rechaza el intento, la cuenta puede requerir revisión asistida. No existe aún un botón de administración para descartar o reasignar pendientes locales.

## Evidencia y límites de las pruebas

- 55 archivos de pruebas aprobados; compilación y empaquetado sin publicación correctos.
- Pruebas sintéticas: guardar/recuperar, aislamiento entre empleados, cuota agotada, navegador incompatible, bloqueo, solicitud inmutable, consulta tras respuesta perdida, confirmación local fallida, turno cambiado y conflicto de contenido.
- Navegador real aislado: recuperar dos consumos de L 55 y nota «Sin chile» tras recargar; rechazo desde una segunda pestaña real; recuperación desde esa pestaña después de cerrar la primera.
- Inventario y puntos conservan sus pruebas existentes de idempotencia. No se ensayó una interrupción eléctrica física ni una recuperación completa en teléfonos reales.
- La navegación integrada Personal → Mesas → Caja pasó en una prueba sintética con los archivos reales publicados. Se revisaron vistas de celular/tablet; quedan pendientes el recorrido operativo completo en dispositivos reales y las interrupciones físicas. No se efectuó una venta productiva para probar.

## Publicación y reversión

No instalar la primera versión con cuentas antiguas abiertas en memoria: terminar o resguardar esas cuentas primero. La página Personal carga el módulo nuevo; clientes no lo cargan. El caché v124 incluye el módulo y la nueva referencia de aplicación.

Si hace falta revertir, conservar IndexedDB: no borrar cuentas ni solicitudes pendientes. Volver a una versión sin este módulo oculta la recuperación, pero no resuelve ni cancela las ventas. Revisar los pendientes antes de operar con una versión anterior. Mantener respaldos y pedidos públicos cerrados durante la validación.
