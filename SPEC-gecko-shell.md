# GeckoView: evaluación acotada del contenedor web

Estado: alcance revisado y aprobado por el usuario mediante las revisiones
aportadas de versión, remitente y contrato. No autoriza distribución ni sustitución
de la caja actual. Primera implementación exclusivamente simulada.

## Objetivo

Conservar HTML/CSS/JavaScript de El Chingadazo y su interfaz, reemplazando el
WebView del sistema por un motor empaquetado. Pausar la reconstrucción visual
nativa. Reutilizar PrinterCore/UsbPrinter y el contrato web ChingadazoNative;
no modificar cobros, permisos, cuentas ni backend durante esta evaluación.

## Versión y evidencia

Candidata, NO compatibilidad certificada: org.mozilla.geckoview:geckoview:
144.0.20251027123126, publicada en https://maven.mozilla.org/maven2/.
POM consultado 2026-10-04: MPL-2.0, dependencias Kotlin, AndroidX, FIDO,
SnakeYAML y geckoview-exoplayer2. HEAD del AAR universal: 304602247 bytes;
no equivale al tamaño de la APK final. Verificar manifiesto minSdk, dependencias,
ABI y licencias antes de fijar binarios. No usar versiones flotantes.

La evidencia de tamaño anterior corresponde a la candidata 143 descartada.
Verificación local 2026-10-04: AAR oficial 144 arm64-v8a descargado, manifiesto
declara minSdk21 y GLES2 obligatorio; contiene jni/arm64-v8a/libxul.so.
Esto NO identifica la arquitectura del HIOPOS ni verifica todas las dependencias.

Remitente: content script restringido al documento superior; background valida
sender de Firefox (id de extensión, tab.id, frameId y URL), nunca campos declarados
por la página. Java valida extensión incorporada/contexto background/session null
y contrato otra vez. Sin nativeMessagingFromContent. UUID y límite de texto ASCII
48KiB, límite JSON 64KiB (4KiB no admite tickets existentes); sin gaveta en print.
La simulación no devuelve accepted:true para trabajos físicos.

Documentación oficial:
- https://firefox-source-docs.mozilla.org/mobile/android/geckoview/consumer/geckoview-quick-start.html
- https://firefox-source-docs.mozilla.org/mobile/android/geckoview/consumer/web-extensions.html

## Estructura y comandos existentes

- android/gecko/ contiene el contenedor y extensión, sin sustituir Activity anterior.
- android/src/hn/chingadazo/pos/ conserva codificación USB reutilizable.
- js/printer.js ya usa ChingadazoNative.request; adaptar su bootstrap, no reescribir caja.
- tests/ conserva pruebas Node; android/test/ pruebas Java existentes.
- `npm test`: regresión web y contrato.
- `npm run build`: empaquetado web local, NO publicación.
- `./android/build.ps1 -NativePos`: referencia de build nativo anterior, NO compila Gecko.
- Compilación desde la raíz de EL-CHINGADAZO, con JAVA_HOME al JDK local y
  ANDROID_HOME al SDK local: `.android-tools/gecko-144/gradle-8.11.1/bin/gradle.bat
  --no-daemon -g .android-tools/gecko-144/gradle-cache -p android/gecko
  -PgeckoAbi=arm64-v8a assembleDebug`. ARM64 es la variante de evaluación,
  NO una identificación del HIOPOS. Se exige elegir ABI explícitamente.
- AndroidX activado. AGP 8.10.1: 8.9.1 emitía errores de reescritura de metadatos
  Kotlin 2.2.10 aunque terminaba el build. Referencia oficial:
  https://developer.android.com/build/kotlin-support

## Contrato y estilo

Conservar el contrato simple existente:
`window.ChingadazoNative.request('print', text)`.
Acciones limitadas status/connect/print/drawer; print usa el corte de PrinterCore.
No exponer bytes ESC arbitrarios ni ejecución genérica. Extensión incorporada y
mensajería nativa oficial, sin servidor HTTP local. Validar origen HTTPS exacto,
ruta personal, documento superior, sesión/remitente, formato, tamaño e ID.
Invalidar pendientes al navegar/cerrar, sin reintentos físicos automáticos.
Navegador normal conserva comportamiento actual; fallo del puente dentro de APK
no deriva silenciosamente a RawBT. Validar también permisos vigentes de la web.

## Estrategia de verificación

Primero resolver manifiesto/ABI del motor y compilar un contenedor aislado. Probar
mensajería con hardware simulado que registra solo ID/acción/resultado, nunca
contenido de tickets, PIN o tokens. Simulación claramente visible: jamás informar
que se imprimió físicamente. Pruebas negativas para origen, iframe, mensajes
malformados, tamaños, repetición y cambio de documento. Mantener las regresiones.

Android API23: instalación/arranque/carga en emulador compatible si está disponible;
actualmente no hay emulador ni dispositivo ADB. Confirmar ABI real del HIOPOS sin
asumir ARM. Un teléfono solo prueba ese teléfono. Luego USB y recorrido integral
supervisado; escenarios destructivos/interrupciones solo con datos aislados.

## Límites

- Siempre: preservar datos/código previo, restricciones de origen, verificaciones
  de remitente, firma y evidencia; registrar riesgos del motor sin mantenimiento.
- Consultar: descarga/instalación de un emulador grande, alcance adicional o cambio
  de identidad de paquete que afecte una instalación existente.
- Nunca: desplegar al restaurante, cobrar ventas de prueba en producción, tocar
  firmware/AnyDesk, borrar datos, registrar secretos ni publicar pilotos parciales.
- No garantizar plazo, rendimiento o seguridad futura. Restringir el dominio no
  corrige vulnerabilidades del motor. No bajar controles para conseguir un build.

## Criterio de avance

Continuar solo si el motor/dependencias admiten API23 y una ABI disponible, la web
carga y el puente verifica ida/vuelta con rechazos seguros. No declarar final
sin ejecución Android y prueba física posterior. Si el motor no es viable,
informar la causa antes de invertir en nuevas pantallas o alternativas.

## Evidencia y pendientes de esta implementación (2026-10-04)

- Build Gradle 8.11.1 / AGP 8.10.1 assembleDebug: SUCCESSFUL. Sin errores de
  metadatos Kotlin tras ajustar AGP; quedan advertencias Java8/JDK21, XML SDK y
  bibliotecas nativas sin quitar símbolos. No se silenciaron comprobaciones.
- APK local: android/gecko/build/outputs/apk/debug/ChingadazoGeckoEvaluation-debug.apk,
  184798624 bytes. aapt confirma minSdk23, target35 y solo arm64-v8a.
  ZIP confirma assets/messaging/{manifest.json,background.js,content.js}.
  SHA256 DDFD949B3DFDE1272CF0FAB1B0CCB0160306AEDA401307D373C8C3FCD0B08077.
- 84 archivos de pruebas Node pasan, incluyendo origen/marco/UUID/tamaño/repetición
  del background y contrato con js/native-bridge.js existente sin modificarlo.
- GeckoPolicyTest Java pasa; clases Java verificadas contra el AAR real 144.
- Revisión independiente sin bloqueadores para la modalidad exclusivamente simulada.
- El test DOM usa wrappedJSObject simulado y MessageChannel de Node: NO verifica
  Xray ni transferencia de MessagePort en GeckoView real. Este es el siguiente
  control antes de conectar USB; no confundir compilación con ejecución Android.
- Sin emulador ni dispositivo conectado: faltan arranque API23, carga/login,
  bootstrap real, diálogos web, navegación/ciclo de vida y memoria/rendimiento.
- El contenedor abre el sitio real con advertencia visible. Simular USB NO convierte
  las ventas del servidor en pruebas: no cobrar ni modificar mesas en esta versión.
- Paquete aislado hn.chingadazo.geckoeval, debug y USB simulado. No distribuido,
  no instalado, no reemplaza APK anterior y no debe usarse para operar el restaurante.
- Java devuelve error SIMULADO para acciones físicas; conserva texto validado en
  el contrato pero no llama a UsbPrinter. No imprime, corta ni abre gaveta.

## Actualización de diagnóstico 0.1.1-simulated (2026-10-04)

- Evidencia posterior del usuario: la variante ARM32 instaló y abrió recepción y
  Caja con la interfaz web en el HIOPOS. Firefox muestra biblioteca lib/arm y
  compilador arm-linux-androideabi; RAM 2 GB. Esto no demuestra la causa exacta
  del rechazo del APK ARM64 anterior ni valida aún el puente o el USB.
- Al pulsar conectar no apareció respuesta. La web usa alert() tanto para éxito
  como error, pero el contenedor no tenía PromptDelegate. Se agregó presentación
  de alertas, cierre ante navegación/destrucción y resolución única del diálogo.
  No se agregaron confirmaciones de operaciones ni se modificó la web.
- El banner indica si Java recibió una acción validada o rechazó una solicitud.
  No muestra texto del ticket, credenciales ni datos del cliente. El transporte
  sigue simulado y no invoca USB; los identificadores del log no identifican la
  impresora real del HIOPOS.
- APK: android/dist/Chingadazo-Gecko-SIMULADO-ARM32-0.1.1.apk (148722372 bytes).
  SHA256: 095F70019B10B67306FD2011D0A41BB017B71253ABC1755E2303DA3C0942B2D9.
  hn.chingadazo.geckoeval, versionCode 2, minSdk23, target35, armeabi-v7a;
  GeckoView permanece en 144.0.20251027123126. Firma debug v1/v2 verificada.
  Certificado SHA256: a5f2eacec97914a9e4d86a0591d1e71b3fe4348e1a479448c5d5a3b4b4e6a1ce.
  Se conserva la configuración de firma y paquete para actualizar sin desinstalar;
  la comparación directa con el APK ARM32 previo no fue posible: Gradle limpió
  esa copia dentro de build/outputs. Las entregas versionadas quedan ahora en dist.
- assembleDebug exitoso y 85 archivos de pruebas Node pasan. gecko-shell.cjs es
  una guarda estática, no prueba Android de diálogos. ZIP contiene los tres archivos
  de la extensión. Revisión local: sin nuevos permisos, dependencias ni USB real.
- Pendiente: instalar como actualización y pulsar Conectar una vez; fotografiar
  alerta y banner. Validar ciclo de vida y puente real antes de habilitar hardware.
  No cobrar, abrir turno ni modificar mesas: el sitio sigue siendo producción.

## Diagnóstico de retorno 0.1.2-simulated

- La captura del HIOPOS confirma que connect llegó a Java en 0.1.1, pero la
  página agotó su espera. No identifica todavía la causa ni prueba un fallo del
  motor: falta observar el retorno. error: SIMULADO sí es admitido por
  js/native-bridge.js y debe rechazar inmediatamente la promesa, sin esperar 40 s.
- Esta actualización añade observaciones, no una corrección especulativa del
  transporte. Java conserva JSONObject/GeckoResult y muestra que preparó la
  respuesta con un prefijo de UUID. No hay USB real ni cambio de comandos.
- El background registra espera, respuesta, rechazo o espera aún pendiente a
  los 10 segundos. Este temporizador no cancela ni repite ninguna solicitud.
  Informa al content script por tabs.sendMessage, tab del remitente y frameId 0.
  Referencia: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/sendMessage
- El content muestra un panel local no interactivo (máximo 8 marcas, últimos
  32 identificadores), acepta marcas solo de su extensión/background y de
  solicitudes conocidas. Registra recepción y antes/después de postMessage.
  Las marcas no contienen tickets ni errores libres. No se modificó ni desplegó
  la web; el panel es insertado únicamente por la extensión de evaluación.
- postMessage completado no prueba recepción de la página. Si muestra SIMULADO,
  hay evidencia de retorno; si vuelve a agotar el tiempo, sigue pendiente.
  La ausencia de una marca background también puede ser fallo del canal de
  observación tabs.sendMessage; no adjudicar automáticamente el fallo a GeckoView.
- APK y extensión 0.1.2; versionCode 3, mismo paquete y motor GeckoView 144.
  Pruebas Node incluyen background real en VM con sendNativeMessage simulado y
  MessageChannel Node/JSDOM: no llaman todo a Java ni equivalen al runtime HIOPOS.
  86 archivos pasaron; pruebas nuevas primero fallaron al faltar las marcas.
- Prueba manual pendiente: actualizar sin desinstalar, pulsar Conectar una vez,
  esperar el aviso, cerrarlo y fotografiar banner y panel inferior. Sin cobros,
  mesas ni USB hasta validar el retorno. No se registran datos de la impresora.
- Build final exitoso. APK en android/dist/Chingadazo-Gecko-SIMULADO-ARM32-0.1.2.apk;
  SHA256 158BBC913C9F616D02213D4B1BCD3A1E8C23B234E538C80BBC399987FEC87F1B.
  aapt confirma API23/ARM32/versionCode3; extensión empaquetada 0.1.2. Firma
  v1/v2 válida y certificado idéntico a 0.1.1: actualización, no desinstalación.

## Puerto nativo 0.1.3-simulated

- La captura 0.1.2 muestra java_responds y background_pending para el mismo ID.
  Se sustituye el transporte puntual por connectNative/onConnect/PortDelegate;
  esto no demuestra una imposibilidad general de sendNativeMessage en GeckoView.
- javap sobre classes.jar 144 y compilación confirman Port.postMessage(JSONObject),
  no String. Se envían objetos JSON en ambos sentidos; no se cambia GeckoPolicy.
  Java autentica port.name/port.sender al conectar y por mensaje, solo la extensión
  esperada, ENV_TYPE_EXTENSION y sesión nula. Rechazo de contenido implica cerrar
  el puerto. close() libera el puerto; una conexión reemplazada no queda activa.
- native-port.js (background exclusivamente) correlaciona ID, limita a 8 pendientes,
  vence a los 8 segundos, limpia pendientes al desconectarse y descarta respuestas
  de puertos antiguos. Reconecta solo para una solicitud nueva, nunca reenvía una
  anterior. No cambia autenticación web, permisos, contratos de impresión o gaveta.
- 87 archivos Node pasan. Prueba de integración recorre página, MessageChannel,
  content, background y native-port reales en JSDOM/VM con extremo nativo falso.
  Pruebas de puerto cubren desconexión, ID desconocido, respuesta tardía/antigua,
  tiempo agotado, JSON malformado y error de envío. No sustituyen ejecución Android.
- Build exitoso, API23/ARM32, versionCode4 y extensión0.1.3, GeckoView144 fijo.
  Firma v1/v2 válida, mismo certificado que 0.1.2. Sin USB real ni despliegue web.
  APK: android/dist/Chingadazo-Gecko-SIMULADO-ARM32-0.1.3.apk.
  SHA256: 0F9A7D1BB5E781C26F1696F582302E4070E89D6ACF58D4762B5579D10A111B1E.
- Aceptación pendiente en HIOPOS: background_received y aviso SIMULADO de Java
  recibido en la web. Que desaparezca el aviso genérico de 40 segundos no basta
  si aparece otro error de transporte. Mantener USB simulado hasta confirmar.

## USB físico de evaluación 0.1.4

- Las capturas del HIOPOS 0.1.3 confirman background_received y el aviso SIMULADO
  recibido por la página. El usuario autoriza pasar a USB real; se conserva el
  puerto connectNative y la validación del remitente, no sendNativeMessage.
- Mismo paquete y GeckoView 144 fijo; versionCode 5, extensión 0.1.4. No se cambia
  ni despliega la web, ni se ejecutan cobros o cambios de mesas.
- Elegir USB enumera VID/PID reales y exige selección y confirmación del operador.
  BULK OUT no identifica por sí solo una impresora: solo interfaces clase impresora
  o fabricante, excluyendo ADB, son candidatas. No se fija 8137:8214.
- Conectar solicita permiso si falta y responde error inmediatamente; después de
  aceptar hay que pulsar Conectar de nuevo. No se imprime al conceder permiso.
  openDevice/claimInterface(false) mantienen conexión hasta error, cambio de
  selección, desconexión detectada, onStop o cierre. status refleja esa conexión.
- Trabajo USB serializado fuera de UI, sin reintentos, límite de envío 4 segundos
  con transferencias de hasta 500 ms. Aceptar bytes no confirma el resultado físico.
- PrinterCore.ticket conserva validación ASCII/LF y límite 48 KiB. El nuevo
  codificador usa ISO-8859-1, ESC @, texto y GS V B 0. Nunca incluye gaveta.
  Corte separado; gaveta ESC p pin 25 250, pin 0 por defecto. Pin 1 requiere
  selección explícita; nunca se envían ambos automáticamente.
- Salvaguarda de evaluación: print acepta solo el marcador de línea exacta
  PRUEBA-IMPRESORA del botón web Imprimir prueba. Evita pedidos automáticos
  accidentales, no es autenticación ni convierte el sitio real en un entorno de
  prueba. Esta APK no está habilitada para imprimir ventas normales.
- Pruebas de comandos ejecutadas en JVM; pruebas de canal en Node/JSDOM y
  controles estáticos no sustituyen USB Android. Pendiente en HIOPOS: selección
  real, permiso, connected:true, papel/corte y gaveta aparte; desconexión y cierre.
  No se registran tickets. No hay garantía de deduplicación física entre reinicios.
- Build ARM32 exitoso; aapt confirma minSdk23 y versionCode5. Firma v1/v2 válida,
  certificado idéntico a 0.1.3; se instala como actualización sin borrar datos.
  87 archivos Node existentes y el nuevo control gecko-usb pasan; pruebas JVM
  GeckoPolicyTest y GeckoUsbCommandsTest pasan. Sin prueba física desde la laptop.
- APK: android/dist/Chingadazo-Gecko-USB-ARM32-0.1.4.apk.
  SHA256: 120F792B87F50110AA725A8CC1067BFC984ABE189A94836805BB39B9D4E85EB1.

## Corrección de reclamación USB 0.1.5

- Evidencia del HIOPOS: enumera 8137:8214, interfaz 0 clase 7 y concede permiso;
  openDevice progresa pero claimInterface(false) falla repetidamente. El usuario
  informa que detuvo RawBT/HIOPOS y reinició. No hay evidencia directa que permita
  afirmar que el controlador concreto sea usblp.
- UsbPrinter de la prueba que imprimió usaba claimInterface(true). Android documenta
  que force=true desconecta el controlador del kernel si hace falta:
  https://developer.android.com/reference/android/hardware/usb/UsbDeviceConnection#claimInterface(android.hardware.usb.UsbInterface,%20boolean)
- La selección advierte y solicita autorización para liberar el controlador solo
  en la impresora clase 7 elegida. Se intenta false y, si falla, true una sola vez.
  Clase fabricante 255 y otras clases nunca reciben force=true. Conectar no envía
  bytes de impresión, corte o gaveta. El resultado distingue modo normal/compatible.
- El error ya no atribuye el bloqueo a otra app: informa qué reclamaciones fallaron.
  Se conserva cierre en fallos y liberación al salir de la actividad. La conexión
  permanece abierta durante el uso para que Conectar y Cortar prueba sean separados.
- Paquete/firma/GeckoView no cambian; APK versionCode6, versión0.1.5. La extensión
  permanece 0.1.4 porque sus scripts no cambiaron. No hay despliegue web ni ventas.
- GeckoUsbClaimTest usa un extremo de sistema falso: verifica conexión normal,
  fallo normal recuperado con permiso explícito para clase7, rechazo sin permiso,
  otras clases y fallo de ambos intentos. No sustituye la prueba física.
- Prueba pendiente: actualizar sin desinstalar, confirmar impresora real sin trabajos
  activos, Conectar, comprobar modo y pulsar Cortar prueba una sola vez. Después
  validar ticket de prueba y gaveta separados. Sigue bloqueada impresión de ventas.
- Compilación verificada: API23/armeabi-v7a, versionCode6; firma v1/v2 y mismo
  certificado que0.1.4. Pasan los88 archivos Node y pruebas JVM de reclamación,
  política y comandos. No hay acceso físico al HIOPOS desde esta ejecución.
- APK: android/dist/Chingadazo-Gecko-USB-ARM32-0.1.5.apk.
  SHA256: AB6E9C11A6D26C41AEF5F13641288F05C27343D2AD984B66953D4092D6D76C30.

## 0.1.6 — Confirmación explícita de gaveta

- El usuario confirmó corte e impresión físicos con 0.1.5. La apertura sigue sin
  verificar: el botón web testDrawer llama confirm() antes de enviar al puente,
  pero la actividad solo implementaba alert. Se agrega onButtonPrompt, comprobado
  contra el JAR GeckoView 144 y compilado con esa dependencia exacta.
- Aceptar responde POSITIVE; Cancelar/cerrar responde NEGATIVE. Cancelación del
  motor responde null. GeckoPromptDecision evita completar dos veces. No hay
  aceptación automática ni mensajes de confirmación truncados.
- Drawer envía ESC @ seguido de un único ESC p para el pin seleccionado (0/1),
  tiempos 19 FA. Ticket y corte no cambian ni abren gaveta. Pin de gaveta solo
  selecciona; Probar gaveta solicita confirmación. No se implementan secuencias
  automáticas ni pulsos largos: falta observar primero esta prueba física.
- Pruebas RED/GREEN de decisión única y bytes; guardas estáticas del diálogo;
  los 88 archivos Node pasan. Compilación Android exitosa, API23/ARM32, firma
  v1/v2 con el mismo certificado. No se ha ejecutado el diálogo en HIOPOS aquí.
- APK versionCode7: android/dist/Chingadazo-Gecko-USB-ARM32-0.1.6.apk.
  SHA256: DF1362195CE62142BFFF4865F7E497B02F2251A775331EE8F559E7F214858D18.
- Instalar como actualización; seleccionar USB confirmado, conectar, elegir pin0,
  Probar gaveta y Aceptar una vez. Observar resultado antes de probar pin1.
  No facturar ni modificar mesas. Si no abre, no atribuirlo solo al cable sin
  revisar evidencia de envío, puerto DK y compatibilidad eléctrica/documentación.

## 1.0.0 — Candidata operativa, pendiente de aceptación en HIOPOS

Artefacto final de esta preparación: `android/dist/Chingadazo-Caja-USB-ARM32-1.0.0-rc2.apk`
(147661016 bytes, versionCode8, API23/armeabi-v7a, sin debuggable, firma v1/v2).
SHA256: `E260893A30C2182B563B74CAE800E9E57B13A8D533697DCAD4CFA3DA099F336E`.
La copia intermedia `1.0.0-candidata.apk` no incorpora los cuadros de texto y NO
debe instalarse; se conserva solo como artefacto intermedio, no como versión operativa.

### Alcance y decisiones

- Evidencia del usuario: impresión, corte y apertura física con pin 0 funcionan
  en 0.1.6. Esa APK permanece conservada. No se ejecutan ventas desde el desarrollo.
- Mismo paquete y certificado para actualizar sin borrar perfil web, sesión ni
  datos. Release sin debuggable; el certificado instalado procede del almacén debug
  existente y se conserva por compatibilidad. No distribuir su clave privada.
  Es distribución interna, no una publicación en tienda.
- Se guardan en preferencias privadas descriptor completo de la interfaz/end-point,
  autorización para liberar controlador y pin (0 por defecto). Después de reiniciar
  se restaura solo una coincidencia exacta y única. Dos impresoras indistinguibles
  requieren selección explícita; no se adivina la primera. No se guarda USB permiso:
  Android sigue controlándolo y puede solicitarlo después de reconectar/reiniciar.
- Al volver al primer plano se abre la impresora guardada solo si hay permiso. Una
  petición NUEVA reconecta antes de escribir si hace falta. Nunca se repite una
  transmisión fallida o incierta. Al salir se libera USB; segundo plano rechaza
  solicitudes nuevas. No hay apertura ni impresión al arrancar.
- Se permite cualquier ticket ASCII/LF validado, sin exigir PRUEBA-IMPRESORA.
  Se mantiene máximo 48 KiB, timeout, separación print/drawer/cut y pin 0/1.
  La inicialización, corte y pulso son los ya probados; no hay pulsos largos.
- Los diálogos de texto de Gecko muestran efectivo recibido/cierre de turno con
  Aceptar/Cancelar. No se acepta un valor automáticamente. Prompt texto y confirm
  resuelven una sola vez; salir/cancelar nunca autoriza una operación.
- El panel técnico inferior está oculto, conserva solo ocho observaciones sin
  contenido de tickets. El estado USB y los controles nativos permanecen visibles.
- NO se despliega ni cambia la web: ventas, precios, mesas, roles y cobros intactos.
  ATENCIÓN: app.js ya llama drawer por separado al guardar ciertos cobros en
  efectivo. Falta respuesta del usuario: solo botón o conservar apertura al cobrar.
  Esta candidata conserva el comportamiento existente; NO aprobar cobros antes
  de resolver esa elección. Imprimir por sí solo nunca solicita drawer.

### Verificación y límites

- JVM: selección única/ausente/ambigua, pin, política, comandos, reclamación USB,
  finalización de confirm/texto y envíos parciales sin repetición.
- Node: guardas de release y persistencia, 89 archivos de pruebas. El recorrido
  formatter -> página -> content -> background -> puerto se prueba con un receptor
  nativo falso y un ticket VENTA-FIXTURE, sin orden real ni apertura de gaveta.
- Android: assembleRelease y lintVitalRelease; avisos de herramientas existentes
  (SDK XML, Java21 source/target8, bibliotecas nativas precompiladas sin strip).
  No se afirma una compilación sin advertencias ni una prueba Android de hardware.
- Se conserva el límite anti-repetición de 4096 solicitudes por ejecución. No se
  eliminó ninguna salvaguarda. Si se alcanza, detener envíos y reiniciar el proceso
  de la app cuando no haya operación pendiente; nunca borrar datos ni recobrar.
- GeckoView144 se mantiene por compatibilidad física probada; NO se afirma que esté
  actualizado ni que Android6 sea una plataforma mantenida indefinidamente. Mozilla
  elevó los requisitos de Firefox a Android8 (esto no prueba el mínimo de GeckoView):
  https://blog.mozilla.org/futurereleases/2025/09/15/raising-the-minimum-android-version-for-firefox/
- Auditoría npm no completada: sandbox sin DNS y revisión automática rechazó enviar
  metadatos de dependencias al registro sin autorización explícita. No se intentó
  eludir el rechazo, no se instaló ni actualizó ningún paquete. Requiere autorización
  y revisión de motor/OS antes de declarar aprobada la operación permanente.
- Git ya contenía todo el proyecto sin seguimiento y sin commit base. No se hizo
  commit masivo ni se alteraron cambios ajenos; no hay versión remota desplegada.

### Aceptación y recuperación

1. Resolver política de gaveta y auditoría antes de aprobar uso con clientes.
2. Actualizar encima de 0.1.6. Elegir y confirmar VID8137/PID8214 una vez, pin0,
   conceder permiso y Conectar. NO desinstalar RawBT/HioPos ni borrar datos.
3. Imprimir prueba y abrir gaveta con confirmación. Cancelar una segunda solicitud
   debe dejarla cerrada. No hacer ventas ficticias en el sitio real.
4. Cerrar/reabrir la app y reiniciar el equipo: comprobar selección/pin recordados,
   permiso si Android lo pide y un nuevo ticket sin duplicación.
5. Comprobar ingreso/cancelación de efectivo y cierre de turno sin confirmar cobros
   ni cerrar un turno real como prueba. Validación comercial supervisada después.
6. Si falla, pausar uso de esta APK. No volver a cobrar ni repetir un resultado
   incierto. Conservar registro del cobro y comprobar papel/gaveta físicamente.
   0.1.6 está preservada pero Android puede impedir un downgrade: no desinstalar;
   preparar una restauración de su código con versionCode superior y misma firma.
   No se promete rollback mediante instalación directa de la APK antigua.
