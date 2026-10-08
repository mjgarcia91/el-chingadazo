# APK El Chingadazo — contrato v1

Alcance aprobado por el propietario: aplicación propia para S2802 Android 6.0.1, mismo sitio/datos de Cloudflare, sin abrir Firefox/RawBT. SDK autorizado el 2026-10-02. No actualizar firmware ni tocar Típicos.

## Arquitectura y límites

Activity Java (API 23 mínimo), WebView del sistema y puerto de mensajes entregado únicamente al origen HTTPS exacto de El Chingadazo. Impresora USB 8137:8214, ESC/POS, corte completo y pulso de gaveta 24V. Sin bibliotecas de ejecución externas. Interfaz y servidor actualizables en Cloudflare; cambios nativos necesitan APK firmada con la misma clave y versionCode creciente.

WebView debe tener las capacidades modernas usadas por el sitio (structuredClone, Web Locks, crypto.randomUUID). Android 6 por sí solo NO garantiza esto. Mostrar diagnóstico y no abrir caja si el motor es incompatible. No instalar firmware alternativo. Primera autorización USB del sistema no puede omitirse.

## Contrato de puente 1

Mensaje JSON {id,action,text?}; acciones status, connect, print, drawer. Respuesta {id,result} o {id,error}. Solo texto ASCII con LF, máximo 48 KiB; nunca comandos arbitrarios. USB serializado: un trabajo físico en curso y rechazo explícito de otro concurrente, plazo de escritura y gestión de transferencias parciales. Nunca reintentar automáticamente operaciones con resultado incierto. Acuse USB no prueba impresión física. Bootstrap por nonce aleatorio de documento entregado mediante evaluateJavascript; no aceptar un puerto no autenticado enviado por iframe.

En APK transporte nativo prioritario aunque antes se eligiera RawBT. Si falla el puente o USB, error visible sin impresión emergente, sin RawBT, sin repetir cobro. Mantener política actual de cobro/gaveta y elección de imprimir. No cambiar importes, permisos ni contabilidad.

## Seguridad

Sin addJavascriptInterface, acceso a archivos, navegación arbitraria, conexiones claras, SSL bypass, backups Android ni depuración WebView en release. Solo WebMessagePort al documento superior propio; invalidar puerto al navegar. Permiso USB explícito, filtro exacto, no reclamar pantalla táctil. Firma privada fuera de public y Git; sin PIN/token embebido. El origen propio sigue siendo confiable: un XSS del sitio tendría acceso al puente, por eso no exponer funciones genéricas.

## Aceptación

- APK compilada y firma verificada, sin librerías externas ni permisos innecesarios.
- Pruebas de comandos, límites, origen, errores, transferencias parciales y selección de transporte; suite web sin regresión.
- Prueba física pendiente: PIN, sesión, consumos, cobro único, ticket/corte, sin imprimir con cambio, desconexión/reconexión. No retirar HIOPOS/RawBT hasta aprobarla.

Fuentes oficiales: https://developer.android.com/develop/connectivity/usb/host ; https://developer.android.com/reference/android/webkit/WebMessagePort ; https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges ; https://developer.android.com/tools/apksigner .
