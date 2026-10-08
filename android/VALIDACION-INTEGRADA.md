# Caja nativa integrada: estado y validación

## Artefacto local 2026-10-04

- Archivo: `build/b1d5bdf039174ad1b14d880fd75c9145/Chingadazo-Integrado-INTERNAL.apk`.
- SHA256: `C372ECFEFE962C240D35E890D8063733B43873FF7C6FACE9A556F1DEE8828315`.
- Paquete: `hn.chingadazo.nativepilot`, versión `0.2.0-internal` (3), API mínima 23.
- Identidad: Chingadazo Caja Desarrollo. Firma v1/v2/v3 verificada por el build.
- Comprobaciones: 24 grupos Java y 82 archivos Node pasan. No instalado ni publicado.

No es el antiguo paquete WebView `hn.chingadazo.pos`. Actualiza el piloto nativo
compatible con la misma firma, no la primera APK WebView. Los datos privados del
navegador y de otros paquetes no se importan automáticamente. Nunca desinstalar
para resolver un error de actualización ni borrar datos.

## Integrado en el código

Acceso, catálogo/categorías, cantidades/opciones/notas, borradores por usuario y
contexto, salón numerado, consumos, traslado/edición/liberación, turnos, cobro de
mostrador/mesa y recuperación de la misma operación. Impresión USB, corte y gaveta
con diario durable; confirmación física explícita cuando el resultado es incierto.

Cocina se activa en «Imprimir comanda de cocina». Una mesa imprime solo el nuevo
lote aceptado, no toda la cuenta de nuevo al cobrar. Mostrador respeta la preferencia
con imprimir; «sin imprimir» suprime tickets, no la política de gaveta por cambio.
Las copias llevan aviso COPIA y no cobran ni abren gaveta. Retención local de
comprobantes recientes limitada a 20 operaciones y 128 KiB estimados; pendientes
e inciertos no se eliminan para cumplir esa retención.

Fotos conocidas vienen en la APK, caché de memoria 4 MiB; una foto ausente o externa
deja el producto utilizable como texto. Nuevas fotos no se sincronizan automáticamente.
Datos comerciales se consultan al servidor. Cambios de pantallas/código requieren
otra APK firmada; no hay actualizador automático. Administración/delivery siguen web.

## Puerta pendiente: Android real

ADB no detecta dispositivos y no hay emulador instalado en este entorno. No están
verificados aquí teclado, navegación, permisos/Keystore, rendimiento ni el recorrido
completo integrado. Las pruebas físicas anteriores confirmaron USB/corte/gaveta
y correo en pilotos, no esta compilación completa. No etiquetar como final solo
porque compila.

La comprobación puede coordinarse remotamente en un momento tranquilo, sin exigir
fuera de horario. No instalar mientras haya un cobro activo. Conservar la caja
actual; no borrar RawBT, navegador, AnyDesk, datos ni cuentas. No crear ventas
ficticias en producción. Primero entorno aislado si está disponible; una venta real
solo la realiza el responsable, una vez, con verificación del registro existente.

- [ ] Abrir, autorizar/iniciar sesión y comprobar recuperación tras reabrir.
- [ ] Catálogo/precios/fotos, opciones/notas, teclado y cuenta lateral utilizables.
- [ ] Cambiar de usuario y volver conserva sus borradores sin mostrarlos a otro.
- [ ] Mostrador: un cobro, importes correctos, ticket/corte y gaveta según política.
- [ ] Mesa: añadir lote/comanda, recuperar cuenta, cobrar una vez y liberar la cuenta exacta.
- [ ] «Liberar mesa» no borra consumos ni omite saldo/permisos/concurrencia.
- [ ] «Sin imprimir» no imprime y abre gaveta si corresponde; copia no cobra/abre gaveta.
- [ ] Pendiente USB se recupera sin volver a cobrar; resultado incierto no se reenvía a ciegas.
- [ ] Reinicio/respuesta perdida conservan intención; verificar el mismo ID antes de actuar.
- [ ] Turno y cierre/arqueo corresponden al usuario y registros reales.

Ante fallo: detener esa operación, conservar datos y registrar pantalla/versión/ID
sin PIN, contraseña ni tokens. No pulsar cobrar otra vez como solución a impresión.
