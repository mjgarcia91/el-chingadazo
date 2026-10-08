# Especificación: continuidad-local

Estado: decisión y plan aprobados por el propietario. Primera implementación local y pruebas C1–C2 realizadas; no desplegada. Módulo del mapa `CAPACIDADES-MESAS.md`; depende de resguardo. Evidencia, contrato y pendientes en `CONTINUIDAD-LOCAL.md`.

## Objetivo y supuestos

Evitar perder cuentas en preparación y solicitudes de cobro al recargar o reiniciar la aplicación; reconciliar lo pendiente sin duplicar ventas, puntos ni inventario. Se mantiene la aplicación web existente y Firebase como autoridad central. Solo El Chingadazo; sin servidor local nuevo ni cambios en Típicos.

La primera entrega protege borradores y solicitudes pendientes. No declara operación offline completa ni crea acceso administrativo sin red. El modo de contingencia de una caja principal se completa después de acordar acceso offline y registro de efectivo provisional.

## Evidencia del código actual

- `js/app.js`: `STATE.posTicket`, `pendingPosId` y `pendingPosOrder` viven en memoria. `sellPosTicket` conserva una petición para reintentar durante esa sesión, pero no después de reiniciar.
- El guardado manual `chingadazo_pos_holds` no es guardado automático y no se comparte entre dispositivos.
- `js/store.js` deliberadamente no persiste sesiones, usuarios, órdenes ni turnos en su copia pública. No ampliar esa copia para resolver este módulo.
- El acceso de empleados requiere autenticación remota. Una copia de un rol local no autoriza cobros ni administración.

## Primera entrega propuesta

1. Guardado transaccional local (IndexedDB, sin dependencia nueva) de cada cambio de productos, cantidades, notas, nombre opcional y datos de pago de la cuenta. Estado visible: guardando, guardado en este equipo, error de guardado. No guardar datos de tarjeta, tokens ni PIN.
2. Separar borrador editable de solicitud enviada/incierta. Antes de enviar un cobro, persistir identificador estable y contenido exacto. Una solicitud incierta no se edita ni se reemplaza por otra venta.
3. Al recuperar acceso autenticado, buscar el resultado del mismo identificador en el servidor antes de reenviar. Si existe, recuperar comprobante sin repetir efectos; si no existe, validar rol, turno y contenido antes de reintentar con el mismo identificador.
4. Si sesión o turno vencieron, conservar el pendiente y pedir revisión. No moverlo automáticamente a otro turno, inventar una sesión ni descartar el pendiente por HTTP 401/403.
5. Separar registros por instalación, proyecto y operador. No mostrar datos de otro operador al cambiar de usuario. Un administrador autorizado puede gestionar recuperación mediante una acción explícita; no por simple conocimiento del identificador.
6. Una sola pestaña editora por dispositivo/cuenta; otra pestaña muestra bloqueo y opciones de recuperación controlada. No usar último escritor gana. No sincronizar dispositivos desconectados ni afirmar que cocina recibió un pedido sin confirmación.
7. Si falla almacenamiento, no anunciar guardado ni limpiar la cuenta; bloquear envío cuando no se pueda persistir la solicitud. Avisar que borrar datos del navegador, usar navegación privada o perder el dispositivo puede perder pendientes.
8. Los pendientes se mantienen hasta confirmación/revisión; no se borran por actualizar la app ni por cerrar sesión. Después de confirmación duradera, eliminar solo el contenido sensible innecesario de la cola y conservar lo mínimo para evitar reenvío.

## Decisión operativa confirmada

El propietario eligió conservar consumos y cobrar cuando vuelva internet. No se recibe ni registra efectivo provisional desde la aplicación, no se factura offline y no se imprime una venta como confirmada. Tarjeta/transferencia nunca se consideran aprobadas por estar guardadas localmente. Durante una sesión ya abierta pueden prepararse consumos; una detección de desconexión deshabilita cobro/envío. Si la red cae durante un envío, conservar la solicitud como resultado desconocido para reconciliar antes de cualquier nuevo intento.

Acceso tras reinicio sin red: esta primera entrega no omite el inicio de sesión. El borrador se conserva pero su recuperación dentro de la app puede requerir volver a conectarse. Un desbloqueo offline acotado requiere aprobación y diseño de duración, revocación y protección del dispositivo antes de implementarse.

## Tecnología, estructura y estilo

JavaScript existente, navegador + IndexedDB, Worker Cloudflare y Firebase RTDB. Lógica local en `js/continuity.js`, integración en `js/app.js`, pruebas `tests/continuity*.cjs`; cambios aditivos en API solo después de documentar su contrato. No introducir librerías ni cambiar autenticación incidentalmente.

Convención ilustrativa, no API final:

```js
await Continuity.saveIntent({ id, operatorId, shiftId, order });
// Solo enviar después de confirmar la transacción local.
```

Documentar versión del formato, transición borrador → preparado → enviado/incierto → confirmado/revisión. Una respuesta perdida no demuestra ni éxito ni fracaso. No almacenar credenciales en la cola ni registrar su contenido en consola.

## Pruebas y criterios de aceptación

- Recuperar una cuenta con cantidades, notas y total iguales después de reiniciar.
- Simular cierre justo antes del envío, después del envío y después de que el servidor confirma pero antes de recibir respuesta.
- Repetir el mismo intento no crea dos órdenes ni duplica caja, puntos o inventario. Mismo identificador con otro contenido se rechaza.
- Probar disco lleno, IndexedDB bloqueado, dos pestañas, cambio de usuario, turno cerrado, sesión vencida y actualización de versión.
- Interfaz nunca muestra enviado, pagado o recibido en cocina por una simple escritura local.
- No modificar datos reales para probar: usar cuentas/órdenes sintéticas aisladas y fallos de red controlados.

Comandos: pruebas focales `tests/continuity*.cjs`, suite `npm test`, compilación `npm run build`, empaquetado `npm run check:deploy`. Prueba de navegador con recarga y red desconectada; la vista previa estática actual no prueba APIs reales. Publicación solo después de revisión y pruebas.

## Límites

- Siempre: conservar el intento original, comprobar autorización en servidor, distinguir persistencia local de confirmación remota, mantener respaldo y reversión.
- Consultar antes: acceso offline, cobros provisionales, nuevos esquemas remotos, migración de cuentas o nuevos permisos.
- Nunca: prometer pérdida cero, guardar PIN/tokens en pendientes, dar privilegios por datos locales, restaurar producción automáticamente o tocar Típicos.

## Siguiente puerta

Decisión sobre efectivo y plan aprobados. Punto de control: revisión humana del recorrido C1–C2 antes de preparar la publicación; completar prueba integrada y dispositivos de C3. Mesas y comandas mantienen sus especificaciones separadas.
