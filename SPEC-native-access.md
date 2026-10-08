# Especificación: native-access

Estado: aprobada por el propietario («confirmo jeceuta»), 2026-10-03; piloto 0.1.0
implementado/compilado con pruebas locales. Actualización 0.1.1 corrige PIN sin
localId en custom-token. Correo confirmado por usuario en HIOPOS 0.1.0; PIN y
recuperación físicos pendientes. No caja completa.
Índice: CAPACIDADES-APK-NATIVA.md. Sustituye el enfoque WebView solo para la
nueva caja HIOPOS; conserva SPEC-android-pos.md como documentación histórica.

## Objetivo

Entrar a una interfaz Android nativa con los usuarios actuales y una sesión
validada por el servidor, sin WebView, RawBT ni permisos administrativos nuevos.
Esta primera entrega no cobra, modifica mesas, abre turnos ni acciona impresora.

## Supuestos y tecnología

- Android 6.0.1/API23, Java 8, SDK local y firma existentes.
- Vistas nativas; HTTPS fuera del hilo gráfico con límites de tiempo/tamaño.
- Mantener Firebase Authentication y el Worker actuales. Propuesta: usar REST
  oficial de Firebase en lugar del SDK JavaScript; verificar documentación,
  restricciones de la clave pública del proyecto y TLS en el HIOPOS antes de
  implementación. No incluir credenciales de servicio en la APK.
- Candidato de prueba separado de la APK instalada para evitar alterar sus datos;
  decidir migración y paquete definitivo antes de entrega productiva.

## Contratos existentes comprobados en código

Fuente: _worker.js (staffMe, authorizeDevice, login), js/app.js
(staffPinLogin, authorizeStaffDevice), js/auth.js (signInToken, signInEmail).

| Operación | Solicitud | Respuesta y regla |
|---|---|---|
| Autorizar equipo | POST /api/staff-authorize, Bearer ID token de administrador | {ok:true, expires} y cookie chingadazo_staff_device; 403 si no es administrador |
| Entrar con PIN | POST /api/staff-login, cookie del equipo, JSON {pin:string} de seis dígitos | {token,profile}; token es CUSTOM token, no Bearer utilizable directamente |
| Validar sesión | GET /api/staff-me, Bearer Firebase ID token | Perfil con id/role; rechaza personal inactivo o sin rol autorizado |

El custom token debe intercambiarse por una sesión Firebase y su ID token.
No enviar el custom token como autorización del Worker. Conservar semántica
actual {error:string}; no cambiar contratos del servidor para adaptar Android.
Errores 400/401/403/429 se distinguen de fallo de red. Login y autorización no
se reintentan automáticamente. Renovación de sesión debe estar serializada.

## Interfaz ofrecida a otros módulos

Acceso expone identidad validada (id, role), estado de sesión y ejecución de
solicitudes al origen fijo de El Chingadazo; no expone contraseñas, PIN o tokens
a vistas de ventas. Un error de transporte no equivale a rechazo del servidor.
Estados: SIN_AUTORIZAR, SIN_SESION, VALIDANDO, AUTENTICADO, SIN_RED, EXPIRADA.
Cambiar usuario cancela/ignora respuestas antiguas mediante generación de sesión;
ninguna respuesta del operador anterior puede habilitar el siguiente.

## Seguridad y almacenamiento

Activos: credenciales, autorización del equipo, identidad y futuros consumos.
Fronteras: teclado → autenticación; HTTPS → JSON; almacenamiento → sesión;
respuesta asíncrona → pantalla. Riesgos: suplantación de rol, fuga de tokens,
redirección de credenciales, respuesta tardía y bypass por modo sin conexión.

- PIN/contraseña solo transitorios, nunca guardados ni registrados.
- ID token transitorio; material persistente indispensable (cookie y renovación)
  cifrado con Android Keystore, almacenamiento privado y backup desactivado.
  Si Keystore falla: pedir autenticación, no degradar a texto plano.
- Cookie solo al origen exacto del Worker y /api/, nunca a Firebase; respetar
  vencimiento de 30 días. Tokens solo a su destino permitido.
- TLS y certificados estándar; no trust-all ni seguimiento de redirecciones con
  secretos. Respuestas JSON acotadas y validadas antes de cambiar estado.
- Cerrar sesión elimina material del usuario, no futuros borradores comerciales.
  Desautorizar equipo elimina cookie explícitamente; expirar no borra ventas.
- Roles mandan en servidor; la UI no sustituye controles. No login offline.

## Estructura prevista

android/src/hn/chingadazo/pos/: transporte, sesión y Activity nativa en archivos
separados de MainActivity/WebView y UsbTestActivity. android/test/: pruebas Java
del contrato/estado con transporte falso. android/: manifiesto candidato y build.
No modificar datos remotos ni código HIOPOS.

## Estilo

Java explícito, clases pequeñas, UI separada de red; mensajes breves en español.
Ejemplo de regla de transición (no API implementada):

```java
if (requestGeneration != sessionGeneration) return;
if (!validatedProfile.isActive()) {
    showSignedOut("Esta cuenta no tiene acceso.");
    return;
}
```

## Comandos existentes y verificación prevista

Desde EL-CHINGADAZO en PowerShell:

```powershell
npm test
& ./android/build.ps1 -UsbTest
& ./android/build.ps1
```

La variante nueva se construye con `./android/build.ps1 -NativeAccess`.
Genera Chingadazo-Acceso-Nativo-0.1.1.apk, paquete hn.chingadazo.nativepilot,
sin sobrescribir las variantes anteriores ni generar otra clave.

## Pruebas y criterios de aceptación

1. Pruebas Java primero en rojo: seis dígitos, perfil/rol inválidos, token custom
   vs ID token, vencimiento, 401/403/429, JSON incorrecto, timeout y doble toque.
2. Transporte falso prueba que cookie/token nunca salen hacia otro host/path;
   redirecciones y certificados inválidos fallan cerrados.
3. Respuesta atrasada tras logout/cambio de usuario no restaura la sesión.
4. Reapertura valida identidad; no hay PIN persistido, logs sensibles ni bypass
   por caché. Fallo de almacenamiento muestra error recuperable sin borrar datos.
5. Pruebas de contrato con fixtures basadas en el Worker y suite npm sin regresión.
6. Compilar y verificar firma/manifiesto API23; sin WebView ni permisos ajenos.
7. En HIOPOS: autorizar con administrador dentro de la app (no por chat), entrar
   por PIN, cambiar usuario, expirar sesión y perder/recuperar Internet. Sin ventas
   de prueba reales. Medir respuesta/UI; no prometer velocidad antes de medir.

## Límites

- Siempre: conservar autorización remota, probar fallos y documentar evidencia.
- Consultar antes: cambiar reglas de autenticación/CORS, agregar dependencias,
  esquema remoto, permisos, migrar datos o reemplazar la caja en producción.
- Nunca: credenciales incorporadas, borrar datos, desactivar TLS, root/firmware,
  quitar guardas del WebView existente o declarar lista la caja por pasar login.

## Revisión de especificación

Confirmado este primer entregable: acceso nativo con autorización inicial del
administrador y PIN del personal; sin cobros offline. Después se desglosa plan
y tareas en tasks/plan-apk.md y tasks/todo-apk.md, sin reemplazar planes anteriores.
