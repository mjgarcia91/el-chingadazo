# caja-cocina: atención completa de mesas

Estado: propietario aprobó el recorrido centrado en Caja y su publicación. CC1–CC4 implementados: Caja → Guardar en espera → mesa → añadir productos → cobro completo → pagada/ocupada → liberar. Ver CAJA-MESAS.md para contrato vigente, evidencias y límites. El rol específico mesero (CC5–CC6) sigue pendiente y no se presenta como entregado.

## Objetivo y alcance

Unificar Caja y Mesas sin duplicar pedidos: desde Caja se elige mesa y se cobra ahora o se agrega a cuenta; desde una mesa se abre automáticamente la cuenta al confirmar su primer consumo y se agregan productos usando el catálogo existente. Mantener precios, opciones y validaciones autoritativas del servidor.

Configuración productiva vigente: mesas 1–2 Primer nivel, 3–10 Segundo nivel, Barra 1–3; 11–20 desactivadas y Plaza configurable. Nunca reinicializar ni reemplazar ese salón.

## Reglas propuestas

- Separar visita/ocupación de cuenta financiera. Pagar no libera físicamente la mesa: mostrar Pagada · ocupada; liberar explícitamente al retirarse el cliente y quedar sin saldo ni operaciones pendientes.
- Una visita puede contener ventas ya pagadas y una cuenta pendiente por nuevos consumos. Nuevos consumos después de pagar no modifican ventas anteriores.
- Caja ofrece Cobrar ahora y Agregar a cuenta con mesa visible; no convertir silenciosamente un borrador de venta en consumo de otra mesa. Confirmar el destino antes de guardar.
- Cada envío genera una comanda incremental e identificable; cocina recibe solo productos nuevos, nunca la cuenta completa reenviada. Preparación y pago son estados diferentes. Sin pantalla no afirmar recepción: mostrar pendiente y permitir comprobante/manual.
- Mesero puede consultar mesas, agregar/enviar consumos y trasladar cuentas abiertas. No puede cobrar, administrar personal, configurar salón, anular consumos enviados ni consultar cierres financieros. Caja/admin cobran con turno válido.
- Sin red: conservar borrador e identificador en el dispositivo; no declarar confirmado un envío, traslado o pago. No sincronizar ficticiamente varios dispositivos desconectados. Reiniciar sin red puede impedir acceso hasta recuperar sesión.
- Sin unión/división de cuentas, cobros parciales, propina nueva, reembolsos ni cambios tributarios en esta entrega. Anulaciones de consumos enviados requieren un flujo administrativo auditado, nunca borrado directo.

## Contrato técnico y compatibilidad

Contrato CC1–CC2 implementado: POST `/api/dining` con `action: consume`, `tableId`, `accountId` (vacío solamente si la mesa sigue libre), `items`, `operationId`, `expectedRevision`. Cada línea exige `productId`, `qty` entero 1–50, `unit` esperado, `mods` y `note`; hasta 50 líneas por envío y 200 por cuenta. El servidor verifica catálogo y opciones mediante `access.quoteItems`, también usado por pedidos habituales, y rechaza precio cambiado. Respuesta: vista privada del salón y `operationId`. Repetición exacta aceptada aunque cambie el menú; revisión/payload distinto produce 409. Sin habilitación explícita, 409 sin escritura.

Las comandas viven en `accounts[id].batches`, dentro de la misma transacción que cuenta, total e idempotencia: no hay proyección parcial a `/orders`. `GET /api/dining/kitchen` entrega solo comanda, destino actual, productos/notas y estado; no precios, perfiles ni registros internos. `POST` con `action: batchStatus`, `accountId`, `batchId`, `status`, `operationId`, `expectedRevision`: transiciones nuevo → preparacion → listo → servido; cocina solo las primeras dos, Caja/admin pueden marcar servido. 401 sin sesión, 403 por permisos, 400 entradas inválidas, 404 referencia inexistente, 409 conflicto, 413 cuerpo excesivo. Cuerpo máximo 12 KB; salón máximo 4 MiB, sin purga silenciosa.

Borradores del compositor se guardan por usuario/mesa/cuenta en localStorage con Web Lock exclusivo durante la edición; no incluyen credenciales. Solo se borran por confirmación del mismo identificador de borrador. La intención exacta usa el diario existente; una respuesta desconocida mantiene borrador e intención. La actualización del salón conserva el formulario que está en preparación. El guardado local sigue sujeto a disponibilidad del dispositivo y almacenamiento; no equivale al respaldo remoto.

Decisión CC1–CC2: mantener cocina en el mismo nodo evita crear una segunda venta por comanda y elimina una escritura distribuida antes de que exista el cobro. El paso de liquidación futura hacia `/orders` sí requerirá reserva/reconciliación. No dar de alta consumos reales con este incremento aislado.

Servidor: validar catálogo/opciones/cantidades y calcular importes; snapshot del precio al aceptar cada consumo. No confiar en precio o total del navegador ni recalcular retroactivamente líneas enviadas al cambiar el menú.

Persistir comando, revisión y resultado bajo una frontera transaccional del salón. Reintentos con mismo actor/identificador/contenido devuelven el mismo efecto; diferencias o revisión antigua rechazan sin sobrescribir. Identificadores estables para cuenta, comanda y venta. Recuperar una respuesta perdida por el mismo identificador.

Comandas y facturación usan referencias al mismo consumo, no dos ventas contables. El adaptador de cocina debe excluir comprobantes de liquidación para no duplicar preparación; reportes e inventario deben contabilizar cada venta una vez. Registrar tareas pendientes de proyección cuando se escriba fuera de la transacción y reconciliarlas idempotentemente; no depender de que el navegador siga abierto.

Reserva de cobro congela versión/contenido. La confirmación exige venta persistida, importe exacto y turno autorizado; un fallo posterior no permite cobrar otra vez. Revisar el contrato interno complete existente: hoy libera automáticamente, incompatible con ocupación física propuesta. Una cuenta cobrada queda inmutable y la visita puede continuar.

Modelo aditivo con versión explícita y lectura compatible del estado anterior, sin borrar /dining ni historial. Proteger rutas generales de orders para que no permitan eludir las invariantes de mesas. Reversión debe bloquear nuevas operaciones incompatibles conservando cuentas/pendientes.

## Entorno, comandos y estructura

JavaScript ES modules, Cloudflare Worker y Firebase Realtime Database existentes; sin dependencias nuevas. Interfaz HTML/CSS/JavaScript; pruebas Node y jsdom existentes.

- Build: `npm run build`
- Suite: `npm test`
- Empaquetado: `npm run check:deploy`
- Publicación independiente, solo tras verificación: `npm run deploy`
- Servicio: server/dining.js, server/access.js, _worker.js.
- UI: js/dining.js, js/app.js, js/continuity.js, css/dining.css.
- Pruebas: tests/*.cjs; navegador con datos sintéticos aislados antes de producción.

Estilo: reutilizar servicios pequeños e inyección de dependencias; no efectos externos dentro de callbacks reintentables. Ejemplo existente: `const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };`

## Verificación y criterios de éxito

1. Caja → mesa → cobrar ahora: una venta, una comanda y mesa pagada/ocupada.
2. Mesa → productos → enviar → agregar más → cobrar: cuenta acumulada correcta; cocina recibe dos tandas distintas y Caja una liquidación.
3. Aperturas, consumos, traslados y cobros concurrentes no pierden datos ni duplican efectos. Respuesta perdida, cuota local agotada, sesión/turno vencido y recuperación tras cierre tienen pruebas negativas.
4. Mesero/cocina/cliente no pueden cobrar ni ampliar privilegios mediante solicitudes directas.
5. Precio cambiado no altera consumos aceptados; productos inválidos, extras inválidos y efectivo insuficiente se rechazan.
6. Cobro confirmado y fallo al actualizar salón recuperan sin repetir venta; la mesa no se libera hasta acción explícita sin saldo.
7. Suite existente, pruebas nuevas, build y empaquetado pasan. Verificar celulares/tablets y ambos recorridos completos sin ventas sintéticas productivas; documentar límites de cortes físicos.

## Límites de ejecución

Siempre: pruebas antes de código de comportamiento, validación remota, respaldo previo, conservar datos y configuración.
Revisar primero: nuevo esquema/estado de ocupación y permisos del rol mesero descritos aquí; cualquier ampliación de alcance o servicios con costo.
Nunca: modificar Típicos, exponer secretos, crear ventas reales de prueba, borrar cuentas para corregir conflictos, debilitar pruebas o seguridad para publicar.
