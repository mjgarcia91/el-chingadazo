# Diagnóstico WebView 1.0.1

Instalar `dist/El-Chingadazo-1.0.1.apk` sobre la app existente, sin desinstalar ni borrar datos. Mismo paquete `hn.chingadazo.pos`, versionCode 2 y misma firma de entrega.

Abrir El Chingadazo, tocar **Diagnóstico** arriba y fotografiar el informe. El informe es local: no envía información, modifica ventas, selecciona proveedores ni cambia AnyDesk. Muestra Chromium según el User-Agent original del WebView creado, Android/modelo y versiones de `com.android.webview` y `com.google.android.webview`. No identifica con certeza el paquete activo en Android 6; diferencia motor activo de paquetes instalados. Conserva las barreras de compatibilidad y seguridad.

APK SHA-256: `5F220A713551CA3EA583320F7B36E8BA5609FCB5F199018EA15EEF530F2993BA`.

Verificación: pruebas Java del núcleo y diagnóstico correctas; APK compilada y firma v1/v2/v3 verificada. Advertencias existentes de Java 8/API obsoleta; sin error de compilación en ejecución autorizada. Pendiente validación física del diálogo en HIOPOS y pruebas USB. No se ha publicado una actualización web por este cambio.

Recuperación: si la nueva versión falla, no desinstalar para bajar de versión. Conservar datos y generar una actualización con versionCode mayor que retire únicamente el diagnóstico. No desactivar WebView del sistema.
