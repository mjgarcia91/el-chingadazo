# Capacidades: APK nativa HIOPOS

2026-10-03. Alcance aceptado por el propietario tras proponer acceso, ventas,
mesas, cobros e impresión: «lo que sea necesario para lograr que todo se
conecte y quede funcionando sin problemas». Esta aceptación autoriza preparar
la integración; no demuestra que esté implementada ni aprobada para producción.

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| native-access | Autorización del equipo, sesión, roles y transporte HTTPS | — |
| native-sales | Catálogo, carrito y borradores durables por operador | native-access |
| native-tables | Salón numerado, consumos y consulta de cuentas existentes | native-sales |
| native-checkout | Turnos, pago confirmado, cambio, conciliación y liberación | native-tables |
| native-printing | Tickets/corte/gaveta asociados al resultado del cobro | native-checkout |

Orden: native-access → native-sales → native-tables → native-checkout → native-printing.
El transporte USB independiente ya existe y fue probado físicamente; falta su
integración con ventas. Cada módulo tendrá SPEC-<id>.md y revisión antes de código.
Índice actual: SPEC-native-access.md (aprobada; piloto 0.1.1 compilado, correo
confirmado por usuario en 0.1.0, PIN corregido pendiente de prueba física).
SPEC-native-sales.md y plan aprobados por «ok ejecutala». Catálogo, edición y
borradores implementados en compilación interna; fotos, caché de catálogo y
validación Android pendientes. No es todavía una caja utilizable para facturar.
SPEC-native-tables.md, SPEC-native-checkout.md y SPEC-native-printing.md:
reglas confirmadas por el propietario, incluido botón «Liberar mesa».
Plan técnico y tareas de integración en tasks/plan-apk.md y tasks/todo-apk.md
aprobados por «ejecuta». Consulta nativa y botón de liberación implementados,
verificados con pruebas locales; falta comprobación Android y restantes módulos.
Política nueva explícita: liberar después del pago confirmado, con pendiente
independiente si falla; no borrar consumos ni repetir el cobro.

## Estado integrado actualizado — 2026-10-04

Los checkpoints anteriores son históricos. Caja de mostrador/mesas, turnos,
cobro y liberación, diario USB, cocina por lote, copias y fotos locales están
conectados en la compilación nativa interna. Pasan 24 grupos Java y 82 archivos
Node; falta validar el recorrido Android en el equipo. Fotos nuevas externas no
se descargan: se muestran las fotos conocidas empaquetadas, con alternativa de
texto. Guía y artefacto en android/VALIDACION-INTEGRADA.md. No es aún una entrega
certificada para operación; no sustituye toda la administración/delivery web.

## Límites comunes

- Java y vistas Android nativas compatibles con API 23. No WebView ni navegador
  externo para caja, mesas, cobro o USB; no copiar código ni bibliotecas de Invelec.
- Reutilizar servidor, usuarios, catálogo, cuentas y turnos; no crear otra caja
  desconectada de los registros actuales. Administración y delivery siguen en web
  durante esta primera entrega; no afirmar que esas pantallas sean nativas.
- Sin conexión: borradores/consumos pendientes identificados como tales. No
  confirmar pagos ni emitir una factura como cobrada sin confirmación del servidor.
- «Facturar sin imprimir» no envía tickets; el cambio en efectivo sí puede abrir
  gaveta. Documentar la política completa por rol antes de native-checkout.
- Cobro y resultado físico son independientes. Ante resultado desconocido,
  conciliar la misma operación; nunca generar otro cobro ni repetir USB a ciegas.
- No quitar controles de saldo, permisos, concurrencia o turno para simplificar UI.
- No borrar datos de APK/web, RawBT ni modificar Android/AnyDesk. Los borradores
  privados del navegador no se trasladan automáticamente a la APK.
- Validar primero con datos aislados y luego en HIOPOS. La prueba USB no acredita
  todavía acceso, ventas, sincronización, rendimiento ni recuperación ante cortes.

## Evidencia física

El usuario confirmó «todo funciona perfecto» después de encender la impresora,
aceptar permiso y probar impresión, corte y gaveta en Chingadazo Prueba USB 1.0.0.
Confirmación comunicada por el operador, no observación directa del agente.
Pendientes: desconexiones, reinicios y flujo integrado con ventas.
