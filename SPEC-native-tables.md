# Especificación: native-tables

Estado: reglas confirmadas por el propietario: «correcto confirmado, agrega un boton
de liberar mesa». Depende de native-sales según CAPACIDADES-APK-NATIVA.md.
No implica una APK independiente ni autoriza operaciones sobre mesas reales durante pruebas.

## Objetivo

Un salón plano con las mesas actuales (1–30 inicialmente), número y estado claros.
Seleccionar una mesa muestra consumos guardados, saldo pendiente y productos nuevos
por separado. La cuenta guardada no aparece en cero porque el carrito nuevo esté vacío.
Administración puede agregar mesas, cambiar número/posición y trasladar cuentas
respetando los controles existentes. No recrear barras, niveles ni eventos.

## Contratos y comportamiento

- Reutilizar GET/POST /api/dining con identidad verificada, sin acceso Firebase directo.
- GET devuelve initialized, layoutVersion, revision, tables, accounts y
  consumptionsEnabled. Si falta configuración, informar; no inicializar/migrar en silencio.
- Comandos admitidos en este módulo: consume, transfer, saveTable y cancelEmpty.
  release se coordina con native-checkout; no equivale a borrar la cuenta.
- Mostrar «Liberar mesa» en el detalle de la mesa. Habilitarlo solo con cuenta
  pagada confirmada, orderId presente y ocupación coincidente, sin operación en
  curso. Con saldo pendiente mostrar el motivo y acceso a cobrar, no una liberación
  forzada. Si ya está libre, indicarlo sin enviar otra orden. Al terminar, actualizar
  el salón y conservar íntegros el comprobante y el historial.
- Cada comando guarda antes de enviar un operationId, expectedRevision, propietario
  y cuerpo exacto en un diario privado cifrado. No sustituir el ID tras un timeout.
- consume envía solo el lote nuevo: productId, qty, unit, mods, note. Respetar
  el límite de 12000 bytes del endpoint y 50 líneas, sin truncar datos. El servidor
  recalcula precios y rechaza diferencias; conservar el borrador para revisión.
- Tras confirmación del operationId, limpiar únicamente el borrador asociado al lote
  confirmado. Persistir confirmación y limpieza de manera recuperable tras un cierre.
- Un conflicto de revisión exige actualizar; nunca sobrescribir otra caja ni
  reintentar con la revisión nueva sin revisión del operador.
- Borradores por operador y contexto (mostrador o cuenta). Migrar el borrador
  previo del operador a mostrador sin borrarlo. Cambiar mesa no mueve consumos.
- Sin red: conservar selección y borradores, marcar estado desactualizado; no afirmar
  envío, traslado o liberación. No cancelar una cuenta con consumos para liberarla.

## Tecnología, archivos y estilo

Java 8 / API23, vistas nativas, sin dependencias nuevas. Fuentes en
android/src/hn/chingadazo/pos/; pruebas puras en android/test/ y contratos en tests/.
Extender rutas permitidas y sesión sin entregar tokens a vistas. Red/disco fuera de UI.
Ejemplo: `if (!operationId.equals(replyId)) throw new IOException("Resultado sin confirmar.");`

## Comandos y pruebas

Desde EL-CHINGADAZO: `npm test` y `./android/build.ps1 -NativePos`.
Fixtures aislados basados en tests/dining-fixture.js; nada contra producción.
Probar cuenta existente con carrito vacío, lote nuevo, doble toque, caída antes/después
de confirmación, sesión cambiada, revisión obsoleta, disco lleno y respuesta corrupta.
Comprobar selección/scroll/reapertura en Android antes de entregar.

## Aceptación y fronteras

- Saldo existente correcto, cuenta nueva separada y navegación sin pérdida.
- Enviar una vez, recuperar el mismo intento y no duplicar consumos.
- Administración edita distribución sin alterar cuentas ni permisos.
- Siempre conservar historial, revisiones y roles del servidor.
- Consultar antes de cambiar esquemas, dependencias o datos productivos.
- Nunca borrar cuentas pendientes, ocultar conflictos o cobrar desde este módulo.

