# Especificación: resguardo

Estado: respaldo manual real verificado desde el panel el 2026-09-28 a las 15:33 de Honduras. Programación diaria publicada a las 03:00 de Honduras; la primera ejecución automática futura aún no se ha observado. Pertenece a `CAPACIDADES-MESAS.md`. Estado y operación detallados en `RESPALDOS.md`.

## Objetivo

Recuperar datos de operación confirmados ante borrado accidental o fallos, mediante copias privadas verificables. Esto no equivale a continuar trabajando offline ni protege un consumo que nunca salió del dispositivo. No llamar respaldo de ventas al ZIP del programa.

## Evidencia actual

- `js/store.js` excluye usuarios, órdenes y turnos del almacenamiento persistente público del navegador.
- `js/app.js` mantiene la cuenta activa y el intento de cobro en memoria; las cuentas guardadas manualmente usan almacenamiento de ese navegador.
- `wrangler.jsonc` activa exclusivamente respaldo diario; mantenimiento de turnos continúa sin cron. Primera copia manual verificada; ejecución automática futura pendiente de observar.
- Existe archivo de pruebas en `server/test-reset.js`, pero no sustituye respaldos independientes con restauración ensayada.

## Alcance y criterios de éxito

1. Generar una instantánea consistente de `/app` con identificador de proyecto, fecha del servidor, versión de formato, tamaño y suma SHA-256. Incluir registros operativos y roles necesarios para recuperación, sin incluir claves de servicio, contraseñas, tokens ni PIN_PEPPER.
2. Guardarla fuera de la base original, en almacenamiento privado exclusivo de El Chingadazo; no exponer descarga pública ni agregarla a `public/` o al ZIP. Los respaldos contienen datos sensibles y verificadores HMAC; acceso exclusivo de administración autenticada y tratamiento de seguridad equivalente a producción.
3. Mostrar último respaldo exitoso, antigüedad y errores. No anunciar un respaldo exitoso hasta verificar la escritura y su integridad.
4. Ensayar recuperación en un destino aislado con datos sintéticos: reconstruir cuentas/roles/órdenes y comparar totales, identificadores y referencias. Una restauración real sobre producción siempre requiere confirmación explícita, pausa de escrituras y copia previa; nunca ejecutar automáticamente.
5. Separar la recuperación de Firebase Authentication de `/app`: una copia de datos no copia las credenciales de las cuentas de correo. Documentar cómo se recupera la cuenta principal y se conserva PIN_PEPPER sin incluirlos en el respaldo ordinario.

## Operación aprobada y activación pendiente

Primero respaldo manual verificable, luego programación diaria con 30 copias propuestas de retención. La frecuencia diaria implica que podría faltar hasta un día de datos confirmados en una restauración; no confundir con sincronización en vivo ni prometer pérdida cero. Costos y permisos del almacenamiento/programador se revisarán antes de activarlos. No cambiar planes de pago automáticamente. No eliminar copias históricas para aplicar una nueva retención sin aprobación.

El propietario autorizó ejecutar el plan y crear el depósito privado exclusivo. El 2026-09-28 se creó `el-chingadazo-private-backups`; se verificó r2.dev deshabilitado y ausencia de dominios públicos. Binding BACKUPS publicado, primera copia real verificada y cron diario registrado en Cloudflare. No se reutilizó el depósito de documentos ni se cambió ningún plan; el consumo queda sujeto a la facturación vigente, no se afirma que sea gratuito.

### Implementación local del primer incremento

`server/backups.js` crea instantáneas hasta 10 MiB, verifica SHA-256 sobre fecha, proyecto, versión y datos, y relee la copia después de guardarla. Un fallo no produce resultado exitoso. Cada intento genera una copia nueva; no hay reintento automático ni garantía de ejecución única. No borra copias ni restaura producción.

Se excluyen recursivamente campos de PIN en claro, contraseñas, tokens, claves privadas, secreto de cliente, PIN_PEPPER y cuenta de servicio. Se omiten `backupState` y `backupJobs`; los verificadores HMAC de PIN sí se conservan. Se rechaza una clave privada PEM encontrada en otro campo. Esta política no detecta cualquier secreto arbitrario: antes de activar se debe revisar el esquema real. Las suscripciones push cuyos tokens se excluyen requieren registro nuevamente después de una recuperación.

El ensayo actual usa almacenamiento simulado y datos sintéticos, no una restauración remota real. Verifica total de una orden y referencias entre orden, usuario, rol y verificador de PIN. No respalda cuentas/passwords de Firebase Authentication ni los objetos de documentos/fotos de R2; recuperar esos recursos requiere un procedimiento separado. Conservar PIN_PEPPER en un gestor de secretos, nunca dentro del respaldo ordinario.

## Tecnología y estructura

Proyecto existente JavaScript, Worker Cloudflare, Firebase Realtime Database, almacenamiento R2; sin dependencias nuevas previstas. `server/` para lógica privada, `js/` para interfaz, `tests/*.cjs` para pruebas, `scripts/` para utilidades. Solo modificar la carpeta `EL-CHINGADAZO`. No usar el depósito de documentos para respaldos sin revisar su política de acceso y exposición.

## Comandos

Prueba focal prevista: `node tests/backups.cjs` (archivo por implementar).

Verificación global: `npm run build`, luego `npm test`; empaquetado sin publicar: `npm run check:deploy`. Publicación, únicamente tras revisión: `npm run deploy`. La vista previa `npm run preview` no implementa APIs conectadas y no prueba el respaldo remoto.

## Convenciones de código

Seguir módulos de servidor existentes y respuestas sin detalles secretos. Ejemplo de autorización:

```js
await requireStaff(request, env, ['admin']);
return json({ id, createdAt, verified: true });
```

Nombres explícitos, funciones pequeñas, validación en el servidor; fechas ISO UTC y presentación en horario de Honduras. No registrar cuerpos de respaldo ni credenciales en logs.

## Pruebas

Pruebas Node con servicios simulados: rechazo de anónimo/caja/cocina/mesero, proyecto ajeno, datos corruptos, fallo al escribir, checksum incorrecto, copia parcial y recuperación de referencias. Prueba real en entorno aislado antes de habilitar restauración. Captura visual del estado de respaldo y auditoría de archivos públicos. Conservar las 45 pruebas existentes.

## Límites

- Siempre: aislamiento, permisos de servidor, integridad, mensajes claros de error y pruebas antes de publicar.
- Pedir aprobación: destino, permisos nuevos, costos, frecuencia/retención y restauración de producción.
- Nunca: restaurar automáticamente, borrar datos reales como prueba, incluir secretos en código/ZIP, tocar Típicos o presentar el módulo como instalado antes de verificarlo.
