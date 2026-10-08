# v130 / APK 1.0.0 — piloto

## Alcance

Puente USB nativo autenticado por nonce, prioridad sobre RawBT, sin fallback emergente en APK. Resumen de mesa nativo. Sin cambios de cobro, importes, cuentas o Firebase. SDK y plan separado autorizados por usuario. Salón plano confirmado activo por el propietario.

## Verificación previa

- Compilación Java/D8/AAPT2, minAPI23 y firma v1/v2/v3 verificadas.
- Certificado SHA256: `6c0aa03ee322ce1baa607b9e3ac9aa7f9504211f7148dfc78da0c4f74d137768`.
- APK SHA256: `87e9b04f863020be49c573c6f2756bbbfa15ab0f120bab589007e915ab2b422d`.
- Pruebas puras Java: origen, VID/PID, comandos, control chars, límites, envío parcial, error sin reintento.
- Suite Node aprobada; prueba MessageChannel en navegador aislado aprobada, sin errores de consola. No hardware ni ventas reales durante pruebas.
- Revisión independiente solicitó y verificó correcciones: bloqueo de motor incompatible, autenticación del primer puerto y resumen nativo.
- Excepción de compatibilidad: avisos javac por bytecode Java8/APIs antiguas necesarias para Android6; sin warnings de firma. Auditoría de dependencias de herramientas npm heredada documentada en v129; ninguna librería nueva en APK.
- Git sigue sin commit inicial, con todo el proyecto heredado no rastreado. No se hace commit masivo ni se inventa identidad.

## Puerta de lanzamiento

Entrega de piloto instalable, NO aprobación para servicio. Falta probar WebView100+, PIN, USB permission, corte y gaveta en S2802. No retirar aplicación anterior. Ver android/README.md.

## Reversión

Si hay regresión web, revertir Worker a versión v129 `ad42215e-def3-437f-b5e7-cc7d8a255ce6` con Wrangler rollback y comprobar /personal. APK mostrará incompatibilidad del puente: salir y usar sistema anterior conservando datos; no desinstalar ni borrar pendientes. No hay migraciones que revertir.

## Publicación

Publicado 2026-10-03, Worker `377f7b01-803f-4bc7-a246-ab5a0f5c5f16`, startup 2ms. check:deploy correcto. /personal y puente nativo HTTP200 con referencias v130; APK remoto HTTP200, MIME Android, SHA256 descargado coincide exactamente con el archivo firmado arriba. Seguridad del public y pruebas de arranque HTML repetidas después del build: aprobadas. npm audit --omit=dev: 0 vulnerabilidades.

Descarga: https://el-chingadazo.magaa1825.workers.dev/descargas/El-Chingadazo-1.0.0.apk . Solo se publica el APK firmado, nunca android/signing, herramientas, pruebas o documentación interna. Publicación no equivale a validación del HIOPOS.
