# Prueba USB nativa 1.0.0

Autorizada el 2026-10-03: prueba separada de imprimir, cortar y abrir gaveta; sin caja ni ventas. Paquete `hn.chingadazo.usbtest`, distinto de `hn.chingadazo.pos`. Sin Internet, almacenamiento compartido, WebView, código HIOPOS o dependencias externas. Solo acepta USB 8137:8214; reutiliza el transporte propio existente.

## Instalación y prueba física

1. Transferir `android/dist/Chingadazo-Prueba-USB-1.0.0.apk` e instalar como otra aplicación. No desinstalar El Chingadazo, HIOPOS ni RawBT.
2. Cerrar RawBT/HIOPOS para evitar uso simultáneo de impresora. No tocar AnyDesk.
3. Abrir **Chingadazo Prueba USB**, pulsar **Conectar / comprobar USB** y aceptar permiso Android. Autorizar no imprime ni abre nada.
4. Con papel y tapa cerrada, pulsar **Imprimir prueba** una vez. Debe imprimir texto identificado como NO ES UNA VENTA, sin cortar.
5. Pulsar **Cortar papel** una vez. Avanza tres líneas y envía GS V 0.
6. Con gaveta conectada a la impresora, pulsar **Abrir gaveta** una vez. Usa el pulso ESC p existente; compatibilidad física todavía por comprobar.
7. Informar qué acciones funcionaron y fotografiar cualquier error. El acuse USB no demuestra el resultado físico. No repetir a ciegas si hay error.

No hay reintentos automáticos ni trabajos persistidos. Botones desactivados durante permiso/envío; transferencia fuera del hilo gráfico. No se inicia envío al reconectar, aceptar permiso o abrir la aplicación. La app puede desinstalarse por separado después de las pruebas; no contiene ventas.

## Compilación y evidencia

`./android/build.ps1 -UsbTest` reutiliza SDK y firma existentes, sin cambiar las APK de caja. Prueba Java escrita primero en rojo y luego verde para separar texto/corte/pulso y rechazar acciones desconocidas. Pruebas PrinterCore y WebViewDiagnostics también pasan. APK minSDK23, target35, firma v1/v2/v3 verificada, sin permisos declarados. Advertencias de Java 8/API obsoleta no impiden compilación.

SHA-256: `CEEED6059A720A3F6A9139CF12C310FA41F19665D2B45FC9D0194D6A102B7320`.

El 2026-10-03 el usuario confirmó «todo funciona perfecto» tras encender la impresora, aceptar permiso y probar impresión/corte/gaveta. Evidencia comunicada por el operador, no observación directa del agente. Quedan pendientes rechazo de permiso, desconexión, reinicio y flujo integrado. No es una caja funcional ni resuelve la interfaz de ventas.

API oficial usada: https://developer.android.com/develop/connectivity/usb/host .
