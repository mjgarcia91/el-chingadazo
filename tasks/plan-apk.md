# Plan APK

Documento separado autorizado por el propietario; no sustituye planes previos.

1. Herramientas y núcleo USB/ESC: instalar SDK local autorizado, pruebas Java de límites y envío parcial. Sin efectos físicos.
2. Activity y puente: origen HTTPS exclusivo, API23, permiso USB, diagnóstico WebView, errores seguros; compilar APK.
3. Integración web: puerto async, prioridad nativa, no fallback ni duplicación de cobros; pruebas Node y suite completa.
4. Firma, revisión, entrega: firmar con clave estable privada, verificar manifiesto/firma, documentar instalación y prueba física pendiente. Publicar integración web solo tras pruebas.

Riesgos: WebView antiguo (diagnóstico explícito); desconexión después de envío (no reintento); clave perdida (respaldo privado requerido); hardware sin acceso (no afirmar validación real). No hay migración de datos ni cambios de cuentas.

## Continuación: native-access (2026-10-03)

Especificación aprobada: SPEC-native-access.md. El propietario autorizó ejecutar
este plan el 2026-10-03 («ok ejecuta»); los cuatro pasos anteriores describen la APK WebView ya
existente y no son prueba de que la caja nativa esté construida.

### Decisiones

- Candidato separado `hn.chingadazo.nativepilot`, título «Chingadazo · Acceso de
  prueba». No reemplaza `hn.chingadazo.pos` ni `hn.chingadazo.usbtest`.
- Activity Java/API23, sin WebView ni Firebase SDK JavaScript. HTTPS nativo y
  JSON del sistema, sin dependencias nuevas. Firma existente, backup desactivado.
- Firebase REST: contraseña administrativa → ID token; autorización en Worker;
  PIN → custom token del Worker → ID token Firebase → perfil staff-me.
- Renovación por securetoken.googleapis.com, serializada; cookie del equipo solo
  al Worker. No registrar ni persistir PIN/contraseña. Almacenamiento privado
  cifrado por Keystore para cookie y refresh token; borrar sesión no borra equipo.
- No cambios de esquema, roles, CORS, límites de PIN, endpoints ni despliegue
  productivo. Si la configuración de Firebase impide el piloto, informar antes
  de cambiar restricciones; no usar credenciales administrativas del servidor.

### Entregas y orden

1. **Autorizar equipo:** transporte con destinos permitidos, pantalla nativa de
   administrador y validación de perfil. Persistencia de autorización protegida.
   Pruebas con respuestas simuladas antes de intentar acceso real.
2. **Entrar por PIN:** teclado de seis dígitos, intercambio de custom token,
   identidad/rol verificados; sin acciones comerciales. Dobles toques, errores
   y respuestas de un usuario anterior no pueden activar sesiones equivocadas.
3. **Conservar y terminar sesión:** renovar al reabrir, manejar vencimiento y
   falta de red, cambiar usuario y desautorizar equipo de forma explícita.
4. **Entregar piloto firmado:** variante `./android/build.ps1 -NativeAccess`
   (por implementar), APK con nombre propio, pruebas Java + `npm test`, inspección
   de manifiesto/firma y guía de instalación. No ejecutar InitializeSigning.
5. **Prueba HIOPOS con el propietario:** TLS, autorización, PIN, cambio de usuario,
   reinicio y pérdida de Internet. Sin cobros ni modificación de mesas. Medir
   tiempos y confirmar resultado antes de pasar a native-sales.

Dependencias: 1 → 2 → 3 → 4 → 5. Puntos de revisión después de 2 y de 5.
No trabajo delegado ni paralelo sobre archivos compartidos.

### Riesgos y comprobaciones

| Riesgo | Comprobación / respuesta |
|---|---|
| TLS o restricciones Firebase incompatibles con Android 6 | Probar en el dispositivo; no desactivar certificados ni abrir claves sin revisión |
| Keystore del fabricante falla | Bloquear persistencia y mostrar recuperación; nunca guardar en texto plano |
| Perfil cambiado, inactivo o usuario diferente | Consultar servidor, comparar identidad y descartar respuesta atrasada |
| Error a mitad de autorización | No habilitar sesión por éxito parcial; permitir acceso explícito de nuevo |
| Confundir piloto con caja operativa | Nombre/paquete distintos y aviso permanente «Sin ventas» |
| Datos privados en otra aplicación | Sin importación o borrado; migración fuera de esta etapa |

### Evidencia de diseño

Inspección local: _worker.js, js/auth.js, js/app.js y android/build.ps1.
Firebase confirma REST para contraseña, custom token y renovación:
https://firebase.google.com/docs/reference/rest/auth (consulta 2026-10-03).
Eso valida el contrato, no la configuración remota ni TLS del HIOPOS.

Las tareas detalladas están en tasks/todo-apk.md, sin sobrescribir las anteriores.
Piloto 0.1.1 construido el 2026-10-03; instrucciones/evidencia y limitaciones en
android/ACCESO-NATIVO.md. Correo confirmado físicamente por usuario en 0.1.0;
PIN corregido localmente, todavía pendiente de prueba física.

## Continuación: native-sales (2026-10-03)

SPEC-native-sales.md, plan y desglose aprobados por «ok ejecutala», después de
acordar una sola entrega integrada. Se modifica la distribución como sigue.
No se implementan cobros como parte de este módulo.

1. **Modelo y contrato:** catálogo, opciones y centavos; fixtures equivalentes al
   servidor y pruebas Java. Mantener el precio del servidor como autoridad final.
2. **Catálogo visible:** construcción interna `-NativePos`, mismo paquete
   `hn.chingadazo.nativepilot`, con versión superior; actualizará el piloto existente
   usando la misma firma. No entregar APKs por módulo. Reutilizar acceso y GET
   de catálogo por destinos permitidos. No copiar credenciales entre apps.
3. **Cuenta durable:** persistencia cifrada por operador con escritura atómica,
   revisiones y recuperación; después conectar agregar/editar/quitar en la UI.
4. **Acabado y prueba:** fotos con origen permitido, caché acotada y sin secretos,
   disposición negra/dorada, categorías a izquierda y cuenta a derecha; APK firmada,
   pruebas locales y revisión física de catálogo, borrador y cambio de operador.

Dependencias: 1 → 2 → 3 → 4, secuencial. No nuevos servidores, dependencias o
esquemas. Comando propuesto interno: `./android/build.ps1 -NativePos` (a crear).
Mantener `-NativeAccess`, `-UsbTest` y variante original sin cambios de alcance.
Primero tests del modelo; después prueba visual y persistencia en Android local.
La próxima entrega al usuario debe reunir caja, mesas, cobro e impresión. Validación
remota breve en un momento tranquilo, no exigir presencia fuera de horario.

Riesgos: catálogo sin conexión (etiquetar copia antigua), fallo de disco (no aceptar
cambio no guardado), sesión cambiada (descartar respuesta anterior), imagen grande
(límite bytes/píxeles), apariencia distinta (comparación con captura del sistema
actual). No usar cuentas comerciales como datos de prueba ni vaciar pendientes.

Checkpoints: después de S1–S3, build y catálogo probado; después de S4–S6, cuenta
recuperable; después de S7, revisión HIOPOS. Una APK compilada no cierra esos controles.
Tareas concretas en tasks/todo-apk.md. Sin reemplazo productivo en este plan.

## Integración de mesas, cobro y USB: plan aprobado

Plan y desglose autorizados por «ejecuta», después de confirmar las reglas y
el botón «Liberar mesa». Este desglose
técnico continúa el mismo trabajo; no reemplaza ni cierra tareas anteriores.

1. Terminar los pendientes de catálogo/cuenta (fotos, caché y paridad de precios).
2. Conectar consulta de mesas autenticada y detalle con saldo remoto separado del
   carrito. Incorporar «Liberar mesa» usando la acción release existente, diario
   cifrado e identidad de operación persistente. No habilitar liberación de pendientes.
3. Conectar envío de nuevos consumos y traslado, con recuperación del mismo intento
   y limpieza del borrador solo tras confirmación. Administración edita el salón plano.
4. Integrar turnos y cobros de mostrador/mesa. Pago confirmado y liberación son
   estados independientes; el botón manual y el flujo automático comparten código.
5. Conectar impresión/corte/gaveta al comprobante confirmado. Diario físico separado;
   nunca repetir comandos tras resultado desconocido sin comprobación del operador.
6. Pruebas integradas locales y Android; una única APK candidata para comprobación
   remota breve. No desplegar ni instalar pilotos por función.

Secuencial, sin delegación: acceso → mesas → consumo → cobro → efectos USB.
No cambios de esquema, nuevos servidores o dependencias. Los contratos son
server/dining.js, server/dining-checkout.js, server/access.js y /api/close-shift.
No se invocarán contra producción durante desarrollo.

Riesgos: respuesta perdida (diario y mismo ID), ocupación cambiada (revisión y
cuenta coincidente), pago duplicado (consultar original), fallo de disco (no enviar),
fallo físico (pendiente independiente del pago), permiso USB (Android puede pedirlo).
Comprobación tras cada bloque: pruebas enfocadas, npm test y build -NativePos.
Antes de entrega: recorrido completo, errores/reinicio y comprobación Android.

Avance T1–T3: consulta autenticada, detalle de saldo remoto y botón de liberación
implementados en la construcción interna. Pruebas de identidad, conflictos,
respuesta perdida, corrupción y disco fallido. Liberar usa exclusivamente la
acción release del servidor; el cobro automático todavía no está conectado.
Sin instalación, despliegue o mutaciones sobre mesas reales.

Avance parcial T4: envío de productos nuevos desde mostrador a una mesa elegida,
con persistencia atómica de intento y borrador en el mismo registro protegido.
Conserva formato anterior; el mismo ID/cuerpo se recupera tras una respuesta perdida.
Contrato consume separado, preflight UTF-8 de 12000 bytes y comprobación de ocupación.
No sustituye la tarea pendiente de borradores por contexto ni la validación Android.
Los contextos de Mostrador/cuenta de mesa ya están implementados y probados localmente,
con recuperación de borradores y conservación del formato anterior. Falta comprobación
Android. T5 y turnos C1 ya implementados y probados localmente; sigue integrar
el cobro C2/C3, efectos USB y acabado del catálogo;
no solicitar una nueva instalación parcial ni repetir aprobaciones ya concedidas.

Checkpoint: T5 conserva IDs de traslado/edición en diario cifrado independiente.
C1 consulta turno propio, abre/cierra explícitamente y recupera el mismo ID tras
fallos; incluye arqueos pendientes de cierre automático. No se probaron contra
producción. C2 tiene una base aislada (NativeReceipt/NativeCheckout) con pruebas:
no basta HTTP 200; compara identidad, productos, importes y pago, y persiste la
confirmación antes de futuros efectos. Todavía no forma parte de las pantallas
ni del transporte productivo. No presentar este checkpoint como caja terminada.

Actualización C2: transporte fijo autenticado, preparación desde saldo/revisión y
turno propios frescos, y NativePaymentService ya integrados en el código compilado.
Prueba simulada recorre pago perdido → recuperar comprobante → liberar cuenta
exacta, sin segundo cobro. El servicio aún no se expone en pantalla; faltan mostrador,
handoff durable a efectos físicos y finalización del diario confirmado. Continuar
esos puntos antes de habilitar los botones de cobro. Producción no se utiliza para
pruebas y la APK sigue siendo interna.

Checkpoint vigente (sustituye los pendientes históricos ya implementados arriba):
pantalla de cobro de mesas y mostrador conectada, entrega durable a USB y recuperación
del mismo pago implementadas y compiladas. Confirmación física manual de UNKNOWN
no reenvía comandos. Evidencia y hash actual en todo-apk.md. No hay aún validación
runtime Android integrada ni entrega final.

Checkpoint 2026-10-04: cocina por lote aceptado, copias sin cobro/gaveta, fotos
empaquetadas con caché acotada y rechazo definitivo inicial de mostrador integrados.
La cola física puede drenarse durante un cobro pendiente sin retirar sus trabajos
protegidos. Prevalidación de tamaño antes de aceptar consumos/cobros evita bloqueos
irreversibles. 24 grupos Java, 82 archivos Node y build firmado pasan. Evidencia
actual y límites en android/VALIDACION-INTEGRADA.md. No instalar pilotos parciales.
Siguiente puerta: ejecución Android y recorrido integrado supervisado; adb no
detecta dispositivos y no hay emulador instalado. No declarar entrega final con
solo compilación y pruebas simuladas.
