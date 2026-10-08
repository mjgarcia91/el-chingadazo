# Respaldo privado de El Chingadazo

Estado verificado el 2026-09-28: primera copia real creada desde Personal y confirmada a las 15:33 de Honduras. Programación diaria registrada en Cloudflare con versión `94b5d379-5ba2-4dd3-95c4-ecf12646d988`. La primera ejecución automática futura todavía no se ha observado. Prueba manual exitosa no equivale a simulacro completo de recuperación de desastre.

## Uso

En Personal, abrir Panel → Estado del sistema → Respaldo privado. Consultar estado y luego Crear respaldo. Solo administración activa tiene acceso. La copia incluye datos operativos confirmados de `/app`, con datos sensibles de usuarios y verificadores de PIN; nunca se publica ni se ofrece una descarga sin autenticación.

La última copia exitosa cambia únicamente después de releer el objeto privado y verificar SHA-256. Los errores se muestran sin detalles internos. Si una petición pierde su respuesta, consultar estado antes de volver a crear; no hay reintentos automáticos. Cada creación es una copia distinta. El servidor limita intentos a uno cada 15 minutos usando el estado compartido de la base, también si el intento anterior falló.

## API

- `GET /api/backups`: requiere sesión de administrador activo; devuelve configured, dailyEnabled, retention (30), lastSuccess (fecha, bytes, verified), lastAttemptAt, running, lastError y stale (más de 26 horas). Nunca devuelve la instantánea.
- `POST /api/backups`: sin parámetros; crea una instantánea y devuelve metadata verificada, HTTP 201. No es idempotente ni seguro de reintentar automáticamente. 401 sin sesión, 403 sin permisos/origen ajeno, 409 intento reciente/en proceso, 503 fallo o almacenamiento ausente. Otros métodos: 405. No existe endpoint de restauración ni descarga.
- Escribe únicamente `/app/backupState` para control y auditoría del actor; no cambia órdenes, usuarios, roles ni saldos.

## Programación y retención

Binding BACKUPS apunta exclusivamente a `el-chingadazo-private-backups`, sin acceso público ni dominios. `BACKUP_DAILY_ENABLED=true` y el cron `0 9 * * *` habilitan ejecución diaria a las 3:00 a. m. de Honduras (UTC-6). Esa rama no activa otras tareas heredadas. Hasta verificar la primera copia real, mantener flag falso y crons vacíos.

Después de cada copia nueva verificada se conservan las últimas 30 copias del prefijo propio, incluyendo manuales. Se comprueban contenido e identificadores antes de eliminar las más antiguas. Una copia corrupta o listado incompleto detiene la limpieza y muestra aviso. Ningún otro objeto o depósito se elimina. Treinta copias no significa necesariamente treinta días si se generan copias manuales.

## Límites y recuperación

Límite por instantánea: 10 MiB. Una copia diaria puede perder hasta un día de cambios confirmados al restaurarse; no protege borradores pendientes sin internet. No cubre objetos de fotos/documentos en R2, credenciales de Firebase Authentication, secretos del Worker ni la disponibilidad de los dispositivos. Los tokens de notificación se excluyen y requieren registro nuevamente.

Conservar PIN_PEPPER y la recuperación de la cuenta administrativa principal en un gestor de secretos independiente. Sin el mismo PIN_PEPPER será necesario reasignar PIN. Nunca incluirlo en JSON/ZIP/capturas. La comprobación sintética reconstruye una orden, su usuario, rol y verificador en memoria, sin escribir producción; no equivale a un ensayo de desastre completo en otra cuenta Firebase.

Restauración real: autorización explícita, pausa de escrituras, copia previa, verificación de checksum/proyecto, ensayo en destino aislado y reconciliación de Authentication y archivos. Este módulo no restaura automáticamente.

## Reversión y evidencia

Para detener programación, quitar el cron y poner flag falso y desplegar. Ante regresión, volver a versión Worker `9cdec76c-651f-4916-a36c-3a7b51ce100d` y comprobar que el cron quede desactivado. No eliminar depósito ni backupState: revertir código no requiere perder copias.

Pruebas: `node tests/backups.cjs`, `node tests/backups-service.cjs`, `node tests/backups-ui.cjs`, `npm test`, `npm run check:deploy`. No se añadieron dependencias. Antes de anunciar activación real, comprobar estado autenticado y primera copia en producción.
