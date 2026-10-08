# Salón único v129 — 2026-10-02

## Autorización y alcance

El propietario pidió ejecutar la actualización: mesas 1–30, agregar más y retirar barras, niveles y eventos. Exclusivamente EL-CHINGADAZO; no se cambia Típicos, facturación, impresora ni se construye APK.

## Decisión y migración

Se conserva schemaVersion 1 y los IDs usados por cuentas, caja y cocina. layoutVersion 2 indica el salón único. Se descarta recrear o borrar /dining porque rompería vínculos e historial. Se descarta migrar en GET: las consultas siguen siendo de solo lectura.

POST /api/dining action=flattenSalon requiere administrador, operationId y expectedRevision. Usa la misma transacción CAS y diario idempotente que el resto del salón. La activación se realiza separadamente del despliegue, desde el botón administrativo de transición. Revisión obsoleta: 409 sin cambios. Respuesta perdida: repetir la misma operación. Nunca repetir cobros.

La migración guarda zonas y configuraciones anteriores en layoutBeforeFlat (privado, no incluido en respuestas), sin copiar vínculos de cuenta. Conserva cuentas, consumos, operaciones e historial. Conserva números de mesas existentes y asigna a las barras los números libres; en la distribución original, Barra 1–3 pasa a Mesa 21–23. Completa números faltantes hasta 30. Conserva mesas adicionales e inactivas; no borra ninguna. Posiciones ordenadas, cuatro columnas. Clientes antiguos no pueden recrear zonas/barras después de migrar; reciben 409. Clientes abiertos deben recargar para mostrar la interfaz nueva.

## Validación

- Prueba nueva falló antes de implementar; pasa después: permisos, revisión obsoleta, repetición, cuenta de barra conservada, números únicos, IDs en conflicto, mesa 31 y retorno sin perder vínculos actuales.
- Suite completa aprobada. Pruebas UI rechazan pestañas de zonas, tipo barra y temporal/evento. Flujo real UI/servicio conserva consumos y reintentos.
- Navegador aislado con servicio real y datos en memoria: creó 30, agregó 31, movió 31 a fila 9 columna 1. Consola sin errores/avisos. Vistas 320/768/1024/1440 sin desbordamiento horizontal.
- Build y Wrangler dry-run correctos. Dependencias de producción: npm audit --omit=dev sin vulnerabilidades. Continúa la excepción de herramientas de v128 (undici/Miniflare; no expuesto en producción; revisión 2026-10-09).
- Revisión de código: sin nuevas dependencias, backup excluido de API, auth/admin conservados, actualización acotada a /dining con CAS y máximo 4 MiB.
- Repositorio heredado sin commits, archivos ya no rastreados; no se atribuye un commit masivo de trabajo previo.

## Retorno

Versión previa Cloudflare: 7e64437e-702c-4636-9fdf-61bf64bc6622. Ante pérdida de cuentas, errores nuevos o bloqueo de caja, detener activación y ejecutar desde EL-CHINGADAZO: npx wrangler rollback 7e64437e-702c-4636-9fdf-61bf64bc6622.

La versión previa entiende el mismo schemaVersion; el salón único aparece como zona Salón. Revertir código no revierte ventas ni datos. Si además se requiere recuperar la distribución, usar restoreLayout de server/dining-layout.js dentro de una operación CAS supervisada con la aplicación anterior: restaura solo configuración y conserva vínculos actuales, cuentas y mesas nuevas. Down path probado. No restaurar una copia completa de /dining sobre ventas posteriores. No hay endpoint público de rollback.

## Publicación

Publicado en Cloudflare: ad42215e-def3-437f-b5e7-cc7d8a255ce6. Cuatro assets actualizados, arranque Worker 4 ms. /personal, dining.js?v=129, dining-cash.js?v=129 y sw.js responden 200 con SHA-256 idéntico al archivo local. API sin sesión 401; módulo de migración y prueba 404.

Activación de datos pendiente: antes de recargar, la sesión visible mostraba Barra 1 L 55 y Barra 2 L 199. Tras recargar exige PIN y la otra pestaña también está en selección de usuario. No se extrajeron credenciales ni se intentó eludir la autenticación. Se solicitó al propietario iniciar sesión en la pestaña del navegador integrado (no AnyDesk).

Continuación: entrar como administrador → Mesas → Actualizar a salón de 30 mesas → confirmar. Es una sola migración, no una venta. Verificar 30 mesas, cuentas 21 y 22 con los mismos importes (salvo operaciones legítimas posteriores), y Caja/mesas en espera sin barras. No marcar como migrado hasta ver Cambio confirmado por el servidor. Si la revisión está obsoleta, Actualizar y revisar antes de reintentar.
