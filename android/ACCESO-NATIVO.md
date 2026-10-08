# Chingadazo Acceso Prueba 0.1.1

2026-10-03. APK construida y firmada. **Piloto de acceso, no caja de facturación.**
Paquete separado: `hn.chingadazo.nativepilot`. No sustituye la primera APK,
Prueba USB, RawBT ni HIOPOS. No importa ni borra datos de otras aplicaciones.

Archivo: `android/dist/Chingadazo-Acceso-Nativo-0.1.1.apk`.
SHA-256: `7FE41A6367A6EBC273C2446FB1991971EE1CE4D951A87F1BEB0DDC6982CDF163`.

## Corrección 0.1.1

La respuesta de Firebase signInWithCustomToken no exige localId. La versión 0.1.0
lo exigía indebidamente y podía rechazar el PIN con «Respuesta de acceso no válida».
Ahora se compara la identidad esperada del perfil PIN con staff-me, que verifica
el ID token en el servidor, antes de guardar sesión. No se confía en un JWT sin validar.
Contraseña y renovación siguen exigiendo sus identificadores. Prueba de regresión
falló antes del arreglo y pasó después, junto con rechazos de identidades distintas.

El propietario confirmó **acceso con correo** en HIOPOS 0.1.0. No confirmó PIN ni
recuperación. La versión 0.1.1 tiene pruebas locales y firma verificadas; falta
instalarla y validar esos pasos. La caja completa todavía no está implementada.

## Qué contiene

- Pantalla Android nativa sin WebView, navegador externo ni RawBT.
- Autorización del equipo por correo/contraseña de administrador existentes.
- Entrada por PIN de seis dígitos, perfil y rol comprobados contra el servidor.
- Recuperación de sesión al volver a la app; cambiar usuario y retirar autorización.
- Cookie y renovación cifradas con Android Keystore; sin PIN/contraseña persistidos.
- Permiso INTERNET únicamente. No código de impresión, ventas, productos, mesas,
  cobros ni turnos en esta variante. Esas funciones pertenecen a siguientes módulos.

## Prueba en HIOPOS

1. Transferir el archivo indicado y abrirlo con el instalador. Instalar como
   actualización de **Chingadazo Acceso Prueba** si ya está instalada: abrir el
   archivo APK y aceptar Instalar/Actualizar, sin desinstalar la versión anterior.
   **No desinstalar ni borrar datos de esta u otras apps.**
2. Abrir **Chingadazo Acceso Prueba**. Debe mostrar «PILOTO SIN VENTAS» y no
   pedir actualizar WebView. Comprobar que el equipo tenga Internet y fecha correcta.
3. Pulsar **Primera vez: autorizar este equipo**. Escribir dentro de la app el
   correo y contraseña del administrador del restaurante, no la cuenta de Play
   Store. No compartir credenciales por chat.
4. Pulsar **Autorizar equipo**. Resultado esperado: **ACCESO VERIFICADO** y nombre
   del administrador. No crea empleados, roles, ventas ni turnos.
5. Pulsar **Cambiar usuario / cerrar sesión** y entrar con el PIN habitual.
   Verificar el nombre y rol. Un PIN rechazado nunca debe recuperar al administrador.
6. Salir a Inicio y volver. Debe comprobar y recuperar la sesión, sin quedarse
   bloqueada. Cerrar sesión, volver a abrir y comprobar que pida PIN.
7. Durante una ventana sin operación comercial, probar el piloto sin Internet:
   no debe afirmar acceso verificado por caché. Restaurar Internet y pulsar
   **Comprobar conexión / recuperar sesión**. No se sincronizan ni cobran ventas.
8. Opcional: **Retirar autorización de este piloto** exige confirmación y obliga
   a autorizar otra vez. No afecta la autorización de otras aplicaciones.

Si falla, comunicar el texto del mensaje y el paso. No desactivar certificados,
WebView del sistema ni AnyDesk; no borrar datos. No probar numerosos PIN al azar:
se conservan los límites de intentos del servidor actual.

## Evidencia técnica y límites

- Java: contratos de autorización/PIN, tipos, errores HTTP, usuario inactivo,
  discrepancia de identidad, persistencia fallida, recuperación, revocación,
  vencimiento, doble toque, cambio de usuario y cancelación con respuesta tardía.
- Pruebas de destinos permitidos, cookie exclusiva del Worker y límite JSON.
- Estado de pantalla probado para detener/reanudar y descartar callbacks antiguos.
- Pruebas escritas antes de implementación; se reprodujeron y corrigieron los
  casos de renovación de usuario anterior y autorización vencida conservada.
- Compilación API35/min23; firma v1/v2/v3 verificada con la clave existente.
  Advertencias Java8/API obsoleta no impidieron compilación.
- Suite Node: 78 archivos pasan. Test adicional comprueba configuración pública,
  manifiesto y separación de variantes. Sin nuevas dependencias npm/Java.
- **No ejecutada en Android por el agente.** El acceso por correo en 0.1.0 aporta
  evidencia del camino TLS/autorización/persistencia del equipo. Pendientes:
  PIN corregido, reinicio, cambio de usuario y fallos de red/Keystore. La compilación
  y las pruebas simuladas no sustituyen esa verificación.
- No hay cambios desplegados al Worker ni ventas reales de prueba. Tampoco
  constituye una actualización de seguridad del Android antiguo.

Comando desde EL-CHINGADAZO: `./android/build.ps1 -NativeAccess`.
No usar `-InitializeSigning`; no combinar `-NativeAccess` y `-UsbTest`.

## Auditoría de dependencias existente

`npm audit --omit=dev --ignore-scripts`: 0 vulnerabilidades.
`npm audit --ignore-scripts`: 3 hallazgos (1 alto, 2 moderados) en la cadena
Wrangler → Miniflare → Undici. No se aplicó `audit fix --force`.
Esta cadena no se empaqueta ni se ejecuta al construir/usar la APK (SDK/JDK
locales); se utiliza para despliegue/entorno web, que no se realizó en este trabajo.
Revisar actualización de Wrangler con pruebas antes del siguiente despliegue,
a más tardar el 2026-10-10. No se afirma que todo el repositorio esté libre de riesgos.

## Fuentes del contrato

- [Firebase Auth REST: contraseña, custom token y renovación](https://firebase.google.com/docs/reference/rest/auth).
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore).
- Contrato local: `_worker.js` y `js/auth.js`, sin cambiar sus controles.

No se creó commit: repositorio heredado sin commit inicial ni identidad Git
configurada. Se conservaron archivos ajenos y claves privadas fuera de seguimiento.
