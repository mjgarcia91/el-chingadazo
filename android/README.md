# Android El Chingadazo

## Trabajo vigente: caja nativa integrada

La variante vigente se compila con `./android/build.ps1 -NativePos`, sin WebView,
RawBT ni navegador. Consultar [validación integrada](VALIDACION-INTEGRADA.md)
para el artefacto, evidencia, límites y comprobaciones pendientes. No confundirla
con la APK WebView histórica descrita debajo; son paquetes distintos. Todavía no
está validada para sustituir la caja en servicio.

## Histórico: APK 1.0.0 — piloto WebView

Aplicación propia `hn.chingadazo.pos`, API23 mínimo (Android 6), sin RawBT ni navegador externo. El sistema y sus datos siguen en Cloudflare. El APK utiliza Android System WebView: requiere versión 100+ y verifica structuredClone, Web Locks y randomUUID antes de permitir operar. **No está verificada aún en el HIOPOS físico**. No sustituir la operación actual hasta completar la prueba.

## Instalación en el S2802

1. Cerrar o terminar cualquier cobro/envío pendiente. No borrar datos de Firefox, RawBT ni HIOPOS.
2. Transferir `dist/El-Chingadazo-1.0.0.apk` al HIOPOS o descargar el instalador firmado del sitio de El Chingadazo. Abrirlo y seguir la instalación de Android. Cualquier autorización de instalación debe realizarla el responsable del equipo.
3. Abrir **El Chingadazo**. Si aparece «CAJA NO DISPONIBLE», enviar foto del mensaje y consultar la versión de Android System WebView. No instalar firmware ni APK de WebView de procedencia desconocida. La antigüedad de Android puede limitar las actualizaciones disponibles.
4. La APK es un dispositivo nuevo para el sistema: si pide autorizarlo, el administrador ingresa su correo y contraseña directamente allí una vez; después se usa el PIN habitual. No compartir credenciales por chat.
5. Con impresora encendida y USB firme, cerrar HIOPOS/RawBT para evitar competencia por USB. En Caja → Configuración → Conectar impresora, aceptar permiso Android. Se reconoce únicamente USB Printer P, VID8137/PID8214. Android puede pedir permiso nuevamente tras desconectar el cable.
6. Imprimir prueba; comprobar texto, avance y corte. Como administrador, Probar gaveta. No usar cobros ficticios en producción para hacer estas pruebas.

## Validación supervisada antes de usar en servicio

- [ ] Carga, acceso PIN, salón 1–30 y navegación de Caja.
- [ ] Ticket de prueba legible en 80mm y corte completo; resumen de mesa dice «NO ES COMPROBANTE DE PAGO».
- [ ] Gaveta abre una vez y no imprime papel al probar solo gaveta.
- [ ] Siguiente venta real supervisada: se registra una sola vez; efectivo con cambio abre gaveta; Cobrar sin imprimir no produce comprobantes; tarjeta no abre gaveta.
- [ ] Desconexión USB informa error, no repite cobro ni reintenta ticket automáticamente. Reconectar/autorizar antes de la siguiente prueba.
- [ ] Reinicio conserva sesión/consumos conforme al sistema existente. Sin Internet no se autorizan cobros offline.

Se conserva la política existente: cajero abre gaveta en efectivo con cambio; administrador en pagos en efectivo. No hay confirmaciones extras para cada ticket exitoso. «Aceptado» significa que USB recibió los bytes, no un sensor que haya verificado papel o gaveta. Ante fallo, revisar físicamente antes de reimprimir desde la orden existente; nunca volver a cobrar.

## Alcance de v1

Caja, mesas, cobro, tickets cliente/cocina y resumen de mesa usan la interfaz existente; impresión/gaveta nativas. No incluye navegador externo, descarga/visualización de adjuntos, WhatsApp, selector de archivos, cámara o GPS de repartidor. No pretende sustituir esas funciones administrativas/delivery del sitio web. La aplicación bloquea ventanas externas; usar el sitio web en otro equipo para esas tareas.

## Actualizaciones y firma

Cambios web se despliegan en Cloudflare y se recarga la aplicación cuando no hay cobros ni trabajos en curso. Cambios nativos requieren incrementar versionCode y distribuir otra APK firmada con la misma clave; Android conserva datos al actualizar normalmente. No desinstalar para actualizar.

La identidad de firma está en `android/signing/release.jks`; la contraseña está cifrada con DPAPI de este usuario Windows en `password.dpapi.xml`. Ambos están excluidos de Git y de los archivos públicos. **Se requiere un respaldo privado y portable de clave y contraseña por el propietario**: DPAPI no es recuperable simplemente copiando el XML a otra computadora. No publicar ni adjuntar esa carpeta. Perder la clave impide actualizar esta instalación con la misma identidad.

## Compilación local

SDK portable en `.android-tools/sdk`: platform35 y build-tools35.0.0; JDK21 en `.android-tools/java`. Sin instalación global ni Gradle. Herramientas descargadas de Google y Adoptium; JDK cotejado contra checksum del proveedor. Licencia SDK autorizada explícitamente por el propietario.

Ejecutar `./android/build.ps1`. Primera firma únicamente: `-InitializeSigning`. El script prueba núcleo Java, compila Java8/API35, convierte DEX minAPI23, empaqueta con AAPT2, alinea y firma v1/v2/v3; apksigner verifica firma y aapt imprime manifiesto. Avisos de APIs obsoletas corresponden a compatibilidad Android6 (back/navigation/receiver); no se deshabilitan comprobaciones de firma. Tras revisar el APK, copiar solo ese archivo a `releases/El-Chingadazo-1.0.0.apk` para publicarlo; el constructor web permite únicamente ese archivo.

Pruebas web: `node tests/native-printer.cjs`, `npm run build`, `npm test`. Prueba aislada real de MessageChannel: `node scripts/preview-native.cjs`, abrir localhost:4181. Esta simulación no verifica Android ni la impresora física.

Fuentes: https://developer.android.com/develop/connectivity/usb/host ; https://developer.android.com/reference/android/webkit/WebMessagePort ; https://developer.android.com/tools/aapt2 ; https://developer.android.com/tools/d8 ; https://developer.android.com/tools/apksigner .
