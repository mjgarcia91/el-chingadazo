# Especificación: mesas-cuentas

Estado: alcance funcional y distribución inicial confirmados por el propietario («confirmado ejecuta»), 2026-09-28. Plan técnico y tareas preparados para revisión en `tasks/plan.md` y `tasks/todo.md`; todavía no implementado ni publicado. Pertenece a `CAPACIDADES-MESAS.md` y depende de `continuidad-local`. Solo El Chingadazo.

## Objetivo

Administrar mesas numeradas y cuentas abiertas desde celulares, tablets y Caja, manteniendo identidad y consumos al cambiar una cuenta de mesa. Evitar sobrescrituras entre dispositivos y distinguir un cambio visual del plano de un traslado operativo.

Resultado del módulo: zonas y plano editables, catálogo de mesas, apertura de cuenta, consulta de ocupación y traslado seguro. El cobro y las comandas incrementales pertenecen al módulo posterior `caja-cocina`; no presentar mesas como operación completa de restaurante ni publicar un botón de cobro desconectado de ese módulo.

## Confirmado y supuestos para revisión

- Distribución inicial confirmada: 20 mesas, numeradas 1–2 en Primer nivel y 3–20 en Segundo nivel.
- Segundo nivel con barra separada en tres posiciones adicionales a esas 20 mesas: Barra 1, Barra 2 y Barra 3.
- Zona Plaza para mesas temporales de eventos. Administración puede agregar/desactivar mesas sin reconstruir la app; no borrar historial.
- Propuesta: una cuenta activa por mesa y una mesa actual por cuenta. Numeración de mesas única en el restaurante; la barra usa sus propias tres etiquetas. No se crean números iniciales sin confirmar su reparto.
- Propuesta: estados Libre, Ocupada, En cobro y Fuera de servicio, con texto además de color. En cobro depende del contrato con `caja-cocina`.
- Mover en el plano no traslada cuentas; trasladar una cuenta conserva su identificador, consumos e historial. El destino debe estar libre, activo y no reservado por otro traslado.
- Sin división/unión de cuentas, pagos parciales, reservas, turnos de asiento ni transferencia de privilegios en esta entrega.

## Experiencia y permisos

Pestaña Mesas privada, filtros por Primer nivel, Segundo nivel, Barra y Plaza; vista de tarjetas legible en celular y plano editable en modo Administración. Edición con controles accesibles, no solo arrastrar: número, zona y posición. Mostrar número, ocupación, importe confirmado y última actualización; no mostrar importes antiguos como información en vivo durante un corte.

Administración configura zonas, numeración, posición y estado activo. Administración y Caja pueden abrir y trasladar cuentas con conexión. Desactivar una mesa ocupada, asignar un número duplicado, trasladar a un destino ocupado o editar una cuenta en cobro debe fallar sin cambiar datos.

El rol mesero y sus permisos se implementan explícitamente en `caja-cocina`, junto con sus comandas; no reutilizar el rol de administrador o cajero para dar acceso a los meseros. Cocina no recibe acceso de administración del plano.

## Datos e interfaz entre módulos — propuesta aditiva

El servidor es autoridad sobre ocupación y versiones. Proponer un nodo privado nuevo para el salón, sin mover ni renombrar órdenes, usuarios, productos o turnos existentes. Su nombre/esquema final se revisará en el plan técnico después de aprobar esta especificación.

Entidades mínimas:

- Zona: identificador estable, nombre y orden visual.
- Mesa: identificador estable distinto de su número visible, zona, número/etiqueta, posición, tipo mesa/barra, temporal y activa.
- Cuenta: identificador estable, mesa actual, estado, revisión, apertura y actor; referencias a consumos/comandas confirmadas del módulo proveedor correspondiente.
- Operación: identificador estable por intención, actor, revisión esperada, contenido y resultado. El mismo identificador con contenido diferente debe rechazarse.

Contrato del proveedor `mesas-cuentas` hacia `caja-cocina`:

1. Obtener una cuenta autorizada y su revisión, no inferirla por el número visible de mesa.
2. Reservar una cuenta para cobro con revisión esperada e identificador estable; una cuenta reservada no admite traslado ni nuevos consumos.
3. Liberar mesa solo después de que el servicio de cobro confirme duraderamente la misma cuenta/venta. Cobro fallido o desconocido conserva la reserva hasta conciliación; nunca liberar por un temporizador o un éxito exclusivamente local.
4. Liberación y reserva deben ser idempotentes. Si el cobro está confirmado pero falla la liberación, mostrar pendiente de conciliación sin repetir la venta.
5. Conservar referencia histórica de la mesa y cambios de ubicación. Cambiar numeración o posición no cambia ventas anteriores.

No prometer atomicidad entre escrituras separadas de cuenta y orden: el plan debe definir transacción o transición recuperable, con pruebas de cortes entre cada paso, antes de habilitar cobro en mesas.

## Concurrencia y desconexión

Apertura/traslado/configuración requieren conexión y validación en servidor. Dos aperturas de la misma mesa no crean dos cuentas. Traslado modifica ocupación de origen y destino y ubicación de la cuenta en una sola operación atómica; revisar primero y escribir después no es suficiente.

Toda mutación comprueba revisión. Un conflicto conserva el trabajo local y muestra que otro dispositivo cambió la cuenta; no usar último escritor gana. Reintentar la misma operación no abre otra cuenta ni vuelve a trasladarla.

Los borradores desconectados de consumos deberán identificarse por cuenta, operador y dispositivo al integrarse `caja-cocina`. El guardado actual de Caja no está aún vinculado a mesas: no reutilizarlo sin extender y probar esa relación. No permitir apertura, traslado, liberación o cobro offline ni declarar sincronización entre dispositivos desconectados.

## Tecnología, estructura y estilo

Mantener JavaScript, Cloudflare Worker y Firebase RTDB actuales; sin dependencias nuevas. Separar lógica de salón del archivo grande `js/app.js`.

Archivos previstos: `server/dining.js` para dominio/autorización/transacciones, `js/dining.js` para interfaz y conexión; integración limitada en `_worker.js`, `js/app.js`, `personal.html` y `sw.js`; estilos propios en `css/dining.css`; pruebas `tests/dining*.cjs`. Plan y tareas posteriores en `tasks/plan.md` y `tasks/todo.md`, sin borrar pendientes actuales.

Ejemplo de estilo de contrato interno propuesto, no endpoint implementado:

```js
await dining.transfer({ accountId, destinationTableId, expectedRevision, operationId });
// La respuesta del servidor confirma el traslado; un cambio local no lo confirma.
```

## Comandos y pruebas

Desde `EL-CHINGADAZO`:

```text
npm run build
npm test
npm run check:deploy
```

Agregar pruebas Node `.cjs` compatibles con el ejecutor existente. No hay un comando de lint configurado; no inventarlo. Las pruebas nuevas se incorporan a `npm test`.

Casos obligatorios: números duplicados; mesa fuera de servicio; bloqueo de desactivación ocupada; doble apertura simultánea; traslado a libre/ocupada; conflicto de revisión; respuesta perdida y repetida; cambio de zona/número conservando historial; falta de permisos; sesión vencida; sin conexión; cuenta bloqueada para cobro. Ensayos con cuentas sintéticas, nunca ventas reales.

Verificación visual en navegador: celular, tablet y escritorio; texto legible, botones utilizables, estados no dependientes solo del color y edición sin arrastre obligatorio. El recorrido de cobro completo se valida después con `caja-cocina`; no considerarlo aprobado por pruebas aisladas del plano.

## Límites

- Siempre: autorización en servidor, datos de El Chingadazo únicamente, operaciones recuperables, registro de actor y revisión, protección de cuenta ocupada, pruebas de concurrencia y respaldo antes de activar datos nuevos.
- Consultar antes: aprobar esquema privado nuevo, numeración/distribución inicial, permisos de mesero, unión/división, pagos parciales, reglas de cobro y publicación.
- Nunca: tocar Típicos, migrar ventas existentes de forma implícita, borrar cuentas con consumos, operar con roles confiados solo al navegador, cobrar offline, afirmar acuse de cocina sin confirmación.

## Aceptación y siguiente puerta

El propietario ya confirmó alcance y distribución inicial. Sigue la revisión del plan y tareas, antes de construir los incrementos. El módulo no se declara terminado ni se despliega por la mera existencia de esta especificación. `continuidad-local` mantiene pendiente su revisión integrada previa a publicación.
