# Caja y mesas — versión 126

Publicado el 28/09/2026: **3db11fed-4203-4570-ae19-f641e91c3f89**. Respaldo privado previo verificado 18:15 Honduras. Página Personal y módulo de Caja HTTP 200, versión 126 confirmada; API privada anónima 401 y archivos internos 404. Al recargar producción se muestra selección de usuario/PIN: la prueba autenticada posterior queda para el propietario, sin crear ventas ficticias productivas. Suite de 68 archivos aprobada y empaquetado verificado.

## Uso

1. En Caja, agrega productos y pulsa **Guardar en espera · asignar mesa**. Selecciona una mesa libre y confirma. Se abre la cuenta y se envía una comanda, sin registrar todavía una venta pagada.
2. En **Mesas en espera**, pulsa **Añadir pedido / cobrar**. El listado superior muestra lo ya enviado; el ticket de Caja contiene únicamente productos nuevos. Usa **Guardar nuevos productos en la mesa** para confirmar otra tanda.
3. Para cobrar, guarda primero todos los productos nuevos. Pulsa **Cobrar cuenta completa**, elige método, indica efectivo recibido si corresponde y confirma únicamente tras recibir el pago. Necesitas tu propio turno abierto.
4. La mesa queda **Pagada · ocupada**. Usa **Liberar mesa** cuando se retiren. Si piden algo después de pagar, abre la mesa y agrega productos: genera una cuenta nueva sin modificar la venta anterior.
5. **Imprimir resumen** no confirma un pago. La impresión física depende del navegador y equipo; verificar con la impresora del restaurante. El comprobante de pago usa la impresión existente y puede consultarse en Órdenes.

Las comandas incrementales aparecen en Recepción y en Cocina. Sin pantalla de cocina, el personal debe comunicar el pedido por su procedimiento manual; guardado en el servidor no significa que el cocinero lo haya visto. No hay impresión automática nueva de comandas en esta entrega.

## Recuperación y límites

- Si aparece una operación pendiente, consulta el mismo intento; **no cobres de nuevo**. La reserva remota impide duplicar la venta y conserva sus precios, operador y turno.
- El proceso automático revisa cobros reservados cada cinco minutos. Si el inventario conserva una operación en curso, su recuperación puede esperar diez minutos conforme al mecanismo existente. Un conflicto de datos requiere revisión; no se borra ni reemplaza automáticamente.
- Sin internet no se confirma pedido ni pago. El borrador local depende del dispositivo, almacenamiento y sesión; no ofrece sincronización entre teléfonos desconectados ni garantía de pérdida cero.
- Esta entrega habilita Caja/administradores y la vista existente de Cocina. El rol específico **mesero** y su interfaz restringida continúan pendientes; no usar credenciales administrativas compartidas como sustituto.
- No incluye pagos parciales, dividir/unir cuentas ni anular consumos enviados. Las cuentas locales antiguas siguen visibles, sin migrarlas ni borrarlas.
- Las pruebas de cobro en la página publicada registran ventas e inventario reales. Para probar sin afectar cifras: `node scripts/preview-cash.mjs`, abrir http://127.0.0.1:4175/personal en este equipo. Datos ficticios en memoria, independientes de Firebase.

## Contrato y decisión

POST `/api/dining`, action `checkout`: accountId, operationId, expectedRevision, shiftId, payment (Efectivo/Tarjeta/Transferencia), payWith numérico. Autenticación Caja/admin; cocina/cliente rechazados. La reserva CAS congela una venta determinista `dining-{accountId}`. La proyección usa los consumos ya validados, no repricia contra el menú actual, no genera otra comanda y usa `manager.recordSale` con su registro idempotente. Estado: open → checkout → paid → closed (liberación explícita). El intento exacto puede recuperarse incluso si el turno ya cerró.

400 entrada inválida, 401 sin sesión, 403 rol no permitido, 409 conflicto de identidad o evidencia que exige revisión, 412 precondición rechazada sin aceptar este cobro, 503 conciliación pendiente. Un 412 permite actualizar y formular un nuevo intento después de revisar. Respuestas inciertas conservan el intento local. POST `release` exige cuenta pagada y ocupación coincidente; no acepta cancelar saldos.

Los métodos internos reserve/complete del contrato anterior no se usan para la liquidación nueva. Se conservan por compatibilidad, sin rutas HTTP. El servicio nuevo mantiene la ocupación hasta la liberación. Las rutas generales no pueden crear IDs reservados de mesas ni modificar esas liquidaciones.

## Verificación y publicación

Pruebas con servicios reales y almacenamiento sintético: dos tandas, precios históricos, turno, una venta, inventario una vez, permisos, efectivo insuficiente, interrupción tras reservar, reintento concurrente y liberación. Navegador con Caja completa: L 50 + L 25 = L 75, recarga, cobro y estado Pagada · ocupada, liberación. Anchos 320/768/1024/1440 sin desbordamiento. No se generaron ventas de prueba en producción.

Sin dependencias nuevas. Auditoría npm del 28/09/2026: cero hallazgos altos/críticos; tres avisos moderados transitivos de undici/miniflare/wrangler (GHSA-3wwx-pv8p-q78v), herramienta de desarrollo, no incorporados al Worker. Se difiere actualización incompatible sugerida por npm; revisar el 05/10/2026. No aplicar `audit fix --force` automáticamente.

Repositorio original sin commits ni identidad de autor; se conservan los archivos anteriores y no se inventa autor. El despliegue tiene su identificador inmutable de Cloudflare. Nunca se modifica Típicos.

Reversión: la versión productiva anterior es c629a5a8-fabd-4307-877f-7b1c7f41b01c. Antes de revertir, detener nuevos consumos y revisar reservas/cuentas abiertas; la versión vieja no sabe cobrarlas. Conservar `/dining` y `/orders`; preferir corrección hacia adelante si existen consumos reales. No restaurar el respaldo sobre ventas posteriores. Bandera DINING_CONSUMPTIONS_ENABLED controla la habilitación; desactivarla también pausa la conciliación programada.
