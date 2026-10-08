# Tareas — resguardo y módulos posteriores

## Entrega vigente — Caja primero (28/09/2026)

- [x] Propietario confirmó Caja → Guardar en espera → asignar mesa → añadir pedidos → cobro completo y autorizó publicar.
- [x] CC3: integración de Caja, lista remota de cuentas y contexto local persistido; conserva el ticket ante respuesta perdida y reintenta el mismo envío.
- [x] CC4: reserva idempotente, proyección de una venta, inventario compartido, conciliación programada, pagada/ocupada y liberación explícita. Pruebas aisladas y recorrido real del navegador aprobados.
- [x] Publicación de este recorrido: versión 3db11fed-4203-4570-ae19-f641e91c3f89; respaldo previo, suite de 68 archivos, empaquetado y comprobación HTTP posterior. Ver CAJA-MESAS.md.
- [ ] Prueba del propietario tras entrar de nuevo con PIN; impresora física, cortes eléctricos y varios dispositivos reales.
- [ ] CC5–CC6: rol específico mesero/interfaz restringida siguen pendientes; no están incluidos en esta entrega de Caja. Cocina existente y Recepción sí muestran comandas incrementales.

El detalle histórico siguiente conserva las etapas previas; el estado vigente es el de esta sección y CAJA-MESAS.md.

- [x] Inspeccionar persistencia actual y confirmar alcance físico y dispositivos con el propietario.
- [x] Registrar mapa de capacidades y límites del modo de contingencia.
- [x] Aprobar alcance de `SPEC-resguardo.md` y plan inicial.
- [x] Destino autorizado por el propietario: depósito exclusivo `el-chingadazo-private-backups`, creado el 2026-09-28 sin modificar planes. No se garantiza costo cero: uso sujeto a la facturación vigente.
- [x] Verificado acceso r2.dev deshabilitado y ningún dominio público conectado. Binding BACKUPS preparado localmente, todavía no publicado.

## 1. Formato e integridad del respaldo

- [x] Implementado y probado localmente, con corrupción, secretos, tamaño, proyecto ajeno y recuperación sintética de referencias.

- Aceptación: instantánea versionada, proyecto propio obligatorio, checksum validado; secretos excluidos.
- Verificar: `node tests/backups.cjs` con corrupción, proyecto ajeno y datos sintéticos.
- Archivos previstos: `server/backups.js`, `tests/backups.cjs`. Tamaño S. Depende de aprobación.

## 2. Guardado privado y estado verificable

- [x] Adaptador de escritura y relectura verificada probado con almacenamiento simulado.
- [x] Conectar depósito autorizado, autorización admin, API y estado. Publicado manualmente con programación apagada, versión `934db9a8-4887-4a6e-9289-f4cd5af7faa4`.
- [x] Primera copia real verificada desde Personal: 2026-09-28 15:33 Honduras. Anónimo verificado HTTP 401; código privado HTTP 404.

- Aceptación: solo admin; escritura confirmada y verificable; un fallo no actualiza última copia exitosa.
- Verificar: pruebas de permisos y fallos, `npm run build`, `npm test`.
- Archivos previstos: `server/backups.js`, `_worker.js`, `tests/backups.cjs`. Tamaño M. Depende de 1 y destino autorizado.

## 3. Control de respaldo en administración

- [x] Panel con estados, errores, última copia y botones. Pruebas de renderizado aprobadas.
- [x] Prueba autenticada: consultar estado vacío, generar y comprobar última copia verificada desde el panel.

- Aceptación: crear respaldo y consultar estado/antigüedad; sin contenido sensible en pantalla ni links públicos.
- Verificar: pruebas de UI y navegador con una cuenta autorizada, sin restaurar producción.
- Archivos previstos: `js/app.js`, `tests/backups-ui.cjs`, `README.md`. Tamaño M. Depende de 2.

## Punto de control

- [ ] Pruebas completas y compilación correctas; revisión humana del respaldo manual antes de programarlo.

## 4. Ensayo de restauración aislada

- Aceptación: checksum y referencias coinciden; no se escribe en producción; informe de resultados y límites de recuperación de Authentication/PIN.
- Verificar: prueba aislada con datos sintéticos y recuento de órdenes/totales.
- Archivos previstos: `scripts/verify-backup.mjs`, `tests/backups-restore.cjs`, `SPEC-resguardo.md`. Tamaño M. Depende de 2.

## 5. Programación aprobada

- [x] Cron diario 03:00 Honduras publicado; versión `94b5d379-5ba2-4dd3-95c4-ecf12646d988`. Cincuenta archivos de pruebas aprobados. No se modificó Típicos.
- [ ] Observar la primera ejecución automática futura. No confundir cron registrado con ejecución ya observada.

- Aceptación: frecuencia/retención autorizadas; fallos visibles; sin eliminación no aprobada ni secretos en logs.
- Verificar: ejecución programada controlada e integridad de la copia; no basta con registrar un cron.
- Archivos previstos: `_worker.js`, `wrangler.jsonc`, `server/backups.js`, `tests/backups.cjs`, `README.md`. Tamaño M. Depende de 3, 4 y autorización de infraestructura.

## Puertas siguientes (no implementar sin especificación revisada)

### Continuidad local: conservar consumos, no cobrar sin internet

Decisión y plan aprobados por el propietario. Implementación C1–C2 local verificada; sin código publicado. Evidencia y límites en `CONTINUIDAD-LOCAL.md`.

- [x] C1. Guardado y recuperación de borradores (M, sin dependencias de código nuevas). Pruebas focales y navegador aislado con recarga/cierre y dos pestañas reales aprobados.
  - Aceptación: recuperar productos/cantidades/notas después de recarga; distinguir guardando/guardado/error; separar operadores y bloquear edición simultánea en otra pestaña.
  - Archivos: `js/continuity.js`, `js/app.js`, `personal.html`, `tests/continuity.cjs`, `sw.js`.
  - Verificar: prueba focal `node tests/continuity.cjs` y navegador con datos sintéticos, recarga y almacenamiento fallido.
- [x] C2. Preservar el intento de cobro (M; depende de C1). Ensayos aislados aprobados; incluido fallo de guardado, respuesta perdida, turno cambiado, conflicto y reintento de transacción.
  - Aceptación: guardado antes de enviar; sin cobro offline; respuesta perdida se consulta con el mismo ID antes de reenviar. No borrar por sesión/turno vencidos.
  - Archivos: `js/app.js`, `js/continuity.js`, `server/access.js` si la revisión demuestra que falta protección de reintentos, `tests/continuity-send.cjs`.
  - Verificar: confirmar ausencia de doble orden/inventario/puntos en ensayos aislados. Revisar contrato de API antes de cambiarlo.
- [ ] Punto de control C1–C2: 55 archivos de pruebas, compilación y empaquetado aprobados; pendiente revisión humana del recorrido antes de publicación.
- [ ] C3. Ensayo de cortes y preparación de publicación (M; depende de C1–C2).
  - Aceptación: cubrir dos pestañas, cambio de usuario, disco lleno, reinicio y conexión interrumpida; documentar límite de autenticación offline y recuperación de versiones.
  - Archivos: `tests/continuity-recovery.cjs`, `SPEC-continuidad-local.md`, `README.md`, `tasks/todo.md`.
  - Verificar: `npm test`, `npm run build`, `npm run check:deploy`; prueba visual en celulares/tablets y escritorio con datos sintéticos. Sin ventas reales de prueba.

- [x] Especificar y aprobar continuidad-local.
- [x] Especificar y aprobar mesas-cuentas. Propietario confirmó mesas 1–2 abajo, 3–20 arriba, tres posiciones de barra adicionales y Plaza configurable.
- [ ] Especificar y aprobar caja-cocina, incluyendo rol mesero.
- [ ] Ensayar cortes, reinicios, conflictos, traslado y cobro entre dispositivos; actualizar respaldo ZIP después de la versión verificada.

## caja-cocina: siguientes tareas propuestas

- [x] CC1: contrato de cuenta y consumos. Precios autoritativos compartidos, apertura con primer consumo, snapshots e idempotencia concurrente verificados. Separación de visita pagada se completa en CC4; todavía no hay liquidaciones de mesa.
- [x] CC2: productos desde mesa y comandas incrementales. Compositor y vista de cocina separados, dos tandas sin reenvío, respuesta perdida conservada, cuota agotada sin perder el formulario y actualización sin borrar edición. Navegador aislado: 2 tacos de L 55 y luego agua L 25 = L 135; dos comandas, una preparada/lista. Sin ventas productivas. Responsivo 320/768/1024/1440 sin desbordamiento horizontal, consola sin errores/advertencias.
- [ ] Punto de revisión: recorrido mesa → productos → cocina completo y sin doble inventario/ventas.
- [ ] CC3: entrada desde Caja con mesa y destino claro. Archivos: js/app.js, js/continuity.js, tests/dining-entrypoint.cjs, tests/continuity-controller.cjs. Aceptación: conservar borrador y elegir cobrar ahora/agregar a cuenta sin duplicar. Verificar ambos recorridos y recuperación. Depende de CC2.
- [ ] CC4: cobro único y ocupación pagada. Archivos: server/dining.js, server/access.js, _worker.js, tests/dining-checkout-contract.cjs, tests/dining-concurrency.cjs. Aceptación: cobro con turno, reconciliación tras respuesta perdida y liberación explícita sin saldo. Verificar fallos entre escrituras/reportes/inventario. Depende de CC3.
- [ ] CC5: permisos servidor del rol mesero. Archivos: server/access.js, _worker.js, tests/dining-permissions.cjs. Aceptación: mesero toma/traslada, no cobra ni configura; rutas generales no eluden reglas. Verificar solicitudes directas negativas. Depende de CC4.
- [ ] CC6: interfaz de mesero/cocina y guía. Archivos: js/app.js, js/dining.js, tests/dining-entrypoint.cjs, MESAS.md. Aceptación: interfaz mínima por rol, cocina distingue tandas, guía para ausencia de pantalla. Verificar móvil/tablet y navegación. Depende de CC5.
- [ ] CC7: entrega. Ejecutar suite/build/dry-run, pruebas concurrentes y recuperación; respaldo antes de publicación y verificación posterior sin ventas reales. Conservar la distribución productiva: 8 mesas arriba, 2 abajo y 3 barras. Depende de CC6; no marcar completo sin prueba de ambos recorridos.

## Mesas-cuentas: implementación publicada

Actualización 2026-09-28: M1–M5 implementados; 60 archivos de pruebas aprobados y publicación `c629a5a8-fabd-4307-877f-7b1c7f41b01c`. M6: navegador aislado y navegación integrada aprobados; pendiente acceso PIN para inicializar producción y ensayos físicos multidispositivo. Consultar `../MESAS.md`; el detalle siguiente conserva el plan original.

- [ ] Revisar plan y esquema privado `/dining` antes de implementación. Distribución ya confirmada; no volver a solicitarla.

### M1. Inicializar y consultar el salón privado (M)

- Dependencia: aprobación del plan.
- Aceptación: admin inicializa exactamente las 23 posiciones confirmadas y cuatro zonas; repetir no duplica ni sobrescribe cambios; lectura/configuración privadas con rechazo de cliente, cocina y anónimo.
- Archivos: `server/dining.js`, `_worker.js`, `tests/dining-service.cjs`.
- Verificación: `node tests/dining-service.cjs`, `npm run build`; bases simuladas, no Firebase real.

### M2. Consultar y configurar mesas desde la interfaz (M)

- Dependencia: M1.
- Aceptación: tarjetas/plano por zona y edición accesible de número/zona/posición; admin agrega/desactiva sin borrar historial; número duplicado y mesa ocupada no se desactivan.
- Archivos: `js/dining.js`, `css/dining.css`, `server/dining.js`, `tests/dining-ui.cjs`, `tests/dining-service.cjs`.
- Verificación: pruebas focales y vista sintética con contenido escapado; no usar arrastre como único control.

### M3. Conectar la vista a Personal (M)

- Dependencia: M2.
- Aceptación: entrada Mesas solo para admin/cajero, autenticación existente, carga/errores/desconexión visibles; clientes no cargan el módulo ni datos del salón.
- Archivos: `js/app.js`, `personal.html`, `sw.js`, `tests/dining-entrypoint.cjs`.
- Verificación: arranque de entradas, permisos, navegación, `npm run build`, `npm test`.

- [ ] Punto de control M1–M3: revisar catálogo y plano local, suite y compilación correctas; sin publicar ni inicializar producción.

### M4. Abrir y trasladar cuentas con seguridad (M)

- Dependencia: M3.
- Aceptación: una apertura concurrente gana; traslado conserva identidad/historial y cambia origen/destino atómicamente; reintento igual no duplica, conflicto o destino ocupado no altera datos.
- Archivos: `server/dining.js`, `js/dining.js`, `tests/dining-accounts.cjs`, `tests/dining-ui.cjs`.
- Verificación: dos actores, versiones antiguas, contenido distinto con mismo ID, respuesta perdida y fallo de almacenamiento local de intención.

### M5. Preparar contrato interno de reserva para Caja (M)

- Dependencia: M4.
- Aceptación: cuenta reservada bloquea traslado; liberación exige evidencia autoritativa de venta de la misma cuenta; no exponer ni habilitar cobro nuevo desde el navegador.
- Archivos: `server/dining.js`, `tests/dining-checkout-contract.cjs`, `SPEC-mesas-cuentas.md`.
- Verificación: evidencia falsa rechazada, confirmación repetida idempotente y fallo entre confirmación/liberación conserva estado recuperable. Integración real de cobro sigue en `caja-cocina`.

- [ ] Punto de control M4–M5: apertura/traslado y contrato probados; revisión antes de integrar consumos y cobros reales.

### M6. Validación integrada y preparación de entrega (M)

- Dependencias: M1–M5; respetar pendientes de continuidad local antes de publicación.
- Aceptación: celular/tablet/escritorio, dos sesiones, errores visibles, saldo no presentado como actualizado sin confirmación; restauración sintética incluye `/dining`; ningún cambio en Típicos.
- Archivos: `tests/dining-integration.cjs`, `tests/backups-restore.cjs`, `SPEC-mesas-cuentas.md`, `tasks/todo.md`, `README.md`.
- Verificación: `npm run build`, `npm test`, `npm run check:deploy`, prueba visual con datos sintéticos; documentar límites pendientes de Caja/cocina. No publicar sin revisión final.
