# RawBT v128 — 2026-10-02

Autorizado por propietario: implementar y desplegar exclusivamente El Chingadazo.

## Alcance y aceptación

- Transporte RawBT opt-in por equipo Android, conservando WebUSB.
- Tickets ESC/POS con corte completo; apertura de gaveta por pulso pin 0.
- Una bandeja mantiene cada envío independiente; requiere toque explícito para abrir RawBT en Firefox. No es impresión silenciosa.
- Solo informa solicitud, nunca confirma papel/gaveta físicamente. Reintento explícito advierte duplicación; no repite cobros ni API de ventas.
- Sin migraciones, sin datos reales modificados y sin cambios a Típicos.
- URI documentada por desarrollador: https://github.com/402d/DemoRawBtPrinter/blob/master/app/src/main/java/ru/a402d/demorawbt/MainActivity.java (test2, rawbt:base64).

## Límites y seguridad

Los tickets se pasan localmente a RawBT al pulsar el enlace; no se mandan a otro servidor. Texto dinámico mediante textContent y caracteres de control filtrados. No se guardan tickets adicionales en localStorage. Cola solo en memoria: se pierde al recargar; retirar envíos terminados. Máximo 30 filas y 64 KiB por envío. No se detecta instalación, licencia ni resultado físico de RawBT desde el navegador. Si RawBT exige licencia, no se evade ni compra automáticamente.

## Validación

- Prueba nueva falla antes de implementar setTransport; después pasa.
- Suite completa aprobada, incluida preservación de cobros y operaciones USB con liberación de interfaz.
- Prueba visual aislada en navegador: cocina, cliente y gaveta separados; sin errores de consola. No se lanzó app Android desde el navegador de escritorio.
- Build y Wrangler dry-run aprobados. Primer intento aislado falló por permisos locales, repetición autorizada pasó.
- npm audit --omit=dev: 0. Auditoría completa: 3 avisos heredados (1 alto, 2 moderados) en undici 7.29.0 de Miniflare/Wrangler. No hay dependencias de producción ni uso de Miniflare en el worker o esta prueba HTTP local; pendiente actualizar herramientas en mantenimiento separado (revisar 2026-10-09). No se ejecutó audit fix --force.
- Falta aceptación física: impresión desde Firefox/RawBT en HIOPOS y apertura de gaveta.

## Publicación y retorno

Destino: https://el-chingadazo.magaa1825.workers.dev/personal

Publicado: versión Cloudflare `7e64437e-702c-4636-9fdf-61bf64bc6622` (cinco assets cambiados). Worker arrancó en 2 ms.
Verificación pública posterior: /personal, /js/app.js?v=128, /js/printer.js?v=128 y /sw.js respondieron HTTP 200 con SHA-256 idéntico al archivo local.

Versión anterior activa verificada: `316159cb-cb95-4c2d-9d6e-aa17076defdb`.
Retorno si hay regresión: `npx wrangler rollback 316159cb-cb95-4c2d-9d6e-aa17076defdb` desde EL-CHINGADAZO.
Sin commit masivo: repositorio heredado sin commits, archivos previamente no rastreados.

## Uso

Recargar /personal → Caja → Configuración → Usar RawBT (Android). En RawBT seleccionar USB Printer P como predeterminada. Imprimir prueba → Abrir RawBT en la bandeja → comprobar papel y corte. Después Probar gaveta (administrador) → Abrir RawBT: Abrir gaveta. No realizar una venta real para probar hardware.
