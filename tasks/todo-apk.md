# Tareas APK

- [x] A1 Herramientas + núcleo puro (S): pruebas de texto/comandos/transferencias con emisor falso. Verificación javac/java. Sin dependencias.
- [x] A2 Activity + USB (M): permiso explícito, filtro 8137:8214, puerto restringido, diagnóstico motor. Verificación compilación API35/min23. Depende A1.
- [x] Punto de control: compilación y pruebas del núcleo nativo correctas; sin ejecución Android física/emulada.
- [x] A3 Adaptador web (M): nativo prioritario, respuestas acotadas y errores sin fallback. Verificación Node focal y suite 74 archivos. Depende A2.
- [x] A4 Firma/entrega (M): APK firmada, hash, instrucciones, integración web probada y publicada. Depende A3.
- [ ] Punto de control físico: instalación y flujo completo en HIOPOS; requiere acceso al equipo.

## Diagnóstico HIOPOS — 1.0.1 (2026-10-03)
- [x] Botón nativo Diagnóstico disponible aunque Caja esté bloqueada. Muestra UA original del WebView creado y versiones de los dos paquetes conocidos; instalado no implica activo.
- [x] Prueba Java primero en rojo y luego verde; compilación API35/min23 y firma verificadas. No se cambia el requisito Chromium >=100, ni USB, ventas o datos.
- [x] Captura física recibida: Android 6.0.1/API23 S2802, motor activo Chromium 44.0.2403.119; Google WebView 106 instalado pero no activo. No resuelve por sí sola la incompatibilidad.

## Continuación nativa — 2026-10-03

- [x] Prueba USB separada compilada y firmada; usuario confirma impresión, corte y gaveta funcionando.
- [x] Alcance de integración aceptado; registrado en CAPACIDADES-APK-NATIVA.md.
- [x] Contratos de acceso existentes inspeccionados y propuesta SPEC-native-access.md guardada.
- [x] Revisión humana de SPEC-native-access.md: «confirmo jeceuta», 2026-10-03.
- [x] Plan técnico de native-access agregado a tasks/plan-apk.md conservando el anterior.
- [x] Revisión humana del plan native-access: «ok ejecuta», 2026-10-03.

### Desglose de las entregas autorizadas (native-access)

- [x] N1 Autorización/PIN: NativeAccess.java y NativeAccessTest.java (M).
  - Aceptación: contratos existentes, identidad verificada, destinos separados; sin ventas.
  - Verificación: javac/java con transporte y almacenamiento falsos; rojo antes de implementación.
- [x] N2 Sesión: extender esos dos archivos (S), depende N1.
  - Aceptación: renovación, cierre y respuesta tardía sin recuperar sesión anterior.
  - Verificación: pruebas de vencimiento, fallos de persistencia y cambio de usuario.
- [x] Punto de control N1/N2: pruebas locales pasan; ejecución remota pendiente del piloto.
- [x] N3 Transporte/persistencia Android: NativeHttp.java, NativeVault.java, NativeRoutes.java y test de rutas (M), depende N2.
  - Aceptación: TLS normal, sin redirecciones, JSON acotado, Keystore sin fallback plano.
  - Verificación: compilación API23 y controles de seguridad; prueba Keystore/TLS física pendiente.
- [x] N4 Interfaz piloto: NativeAccessActivity.java, manifiesto candidato, build.ps1 (M), depende N3.
  - Aceptación: permiso INTERNET únicamente, sin WebView/ventas, paquete separado.
  - Verificación: ./android/build.ps1 -NativeAccess; firma y manifiesto; npm test.
- [ ] N5 Guía y prueba HIOPOS: android/ACCESO-NATIVO.md (S), depende N4.
  - Aceptación: instalación separada, administrador/PIN sin compartir por chat y cambio de usuario.
  - Verificación: usuario confirma acceso, reinicio, red y cierre. Sin test de venta real.
  - [x] Guía guardada y APK firmada entregable; prueba física todavía pendiente.

Revisión 2026-10-03: NativeScreenState.java + test extraídos para verificar
reanudar sin bloqueo y callbacks obsoletos. Test Node adicional de empaquetado.
Seis grupos Java y 78 archivos Node pasan. Npm audit completo detectó cadena
de desarrollo Wrangler/Miniflare/Undici (no incluida en APK); seguimiento en
android/ACCESO-NATIVO.md. No hubo despliegue ni modificación de ventas.
- [ ] Caja nativa completa construida y validada físicamente. No confundir prueba USB con este punto.

## Corrección de PIN 0.1.1 y evidencia física

- [x] Usuario confirma acceso con correo; captura «ACCESO VERIFICADO» en HIOPOS 0.1.0.
- [x] Reproducción en rojo: Firebase custom-token responde sin localId y 0.1.0 falla.
- [x] Corrección: usar UID esperado del perfil PIN y exigir coincidencia con staff-me
  verificado por servidor. Contraseña/renovación conservan UID obligatorio.
- [x] Regresión: discrepancias de UID, campos ausentes y credenciales inválidas;
  seis grupos Java y suite Node pasan; APK 0.1.1 firmada, sin cambios remotos.
- [ ] Verificar PIN, reapertura, cambio de usuario y desconexiones en HIOPOS 0.1.1.

## native-sales: ejecución aprobada, integración en desarrollo

- [x] Especificación aprobada por propietario, 2026-10-03.
- [x] Plan aprobado por «ok ejecutala», después del acuerdo de entrega integrada.
- [ ] S1 Modelo de catálogo/cuenta (M): NativeSales.java, NativeSalesTest.java y
  prueba de paridad Node. Aceptar opciones/límites/precios iguales al servidor;
  verificar primero rojo/verde con javac/java y fixtures de priceItems. Depende acceso.
- [x] S2 Transporte de catálogo (M): NativeRoutes.java, NativeHttp.java y sus
  pruebas. GET a productos/categorías únicamente, JSON acotado con arrays validados;
  pruebas sin redirección ni fuga de secretos. Depende S1.
- [ ] S3 Catálogo en pantalla aislada (M): NativeSalesActivity.java, manifiesto,
  build.ps1 y prueba de empaquetado. Implementado como NativePosActivity y
  NativeSalesView, mismo paquete nativepilot, build -NativePos interno;
  selección y visualización Android pendientes. Depende S2.
- [ ] Checkpoint S1–S3: npm test, build y catálogo visual aprobado, sin pagos.
- [ ] S4 Persistencia de borradores (M): NativeDrafts.java, NativeDraftsTest.java
  y adaptador Android. Guardado atómico cifrado por usuario, recuperación y fallo
  cerrado sin borrar evidencia; tests de disco/corrupción/revisión. Depende S1.
- [ ] S5 Edición de cuenta (M): NativeSalesActivity.java, NativeSales.java y tests.
  Agregar/editar/quitar opciones y cantidades persiste antes de confirmar visualmente;
  verificar totales, reinicio y errores. Depende S3/S4.
- [ ] S6 Cambio de operador (M): acceso, actividad y pruebas de sesión/borradores.
  No mostrar borradores ajenos ni perder los anteriores; callbacks antiguos ignorados;
  tests de cambio durante carga/escritura. Depende S5.
- [ ] Checkpoint S4–S6: borrador recuperado e identidad aislada, sin datos productivos.
- [ ] S7 Fotos y entrega (M): cargador de imágenes, actividad, pruebas y guía.
  HTTPS con origen permitido y límites; APK firmada y diseño legible; verificar
  build, tests y HIOPOS antes de native-tables. Depende S6.

### Evidencia de esta ejecución

- Núcleo NativeSales: precios en centavos, cantidades/opciones/notas y edición
  probados. Falta fixture de paridad ejecutado contra priceItems del servidor (S1).
- NativeCatalog: lecturas públicas limitadas a productos/categorías, validación y
  pruebas con transporte falso. Sin solicitudes comerciales remotas.
- NativeDrafts/NativeDraftStore: aislamiento por operador, revisiones, recuperación,
  escritura atómica cifrada y rechazo de corrupción. Un snapshot que no puede
  decodificarse se rechaza ANTES de sustituir la cuenta anterior (rojo/verde).
  Keystore y reinicio Android todavía requieren comprobación de runtime (S4).
- NativePosActivity/NativeSalesView/NativeLineEditor: cuenta local, categorías,
  selección, cantidades, opciones, notas y cambio de usuario integrados. Guardado
  antes de confirmar visualmente; ninguna función de pago ni impresión habilitada.
- Compilación interna firmada pasó; nueve grupos Java y 79 archivos Node pasan.
  No se entrega esta compilación como APK final ni se pide instalarla en HIOPOS.
- Restan fotos/caché y comprobación visual, además de módulos mesas, turnos/cobros
  e integración USB con resultados confirmados. No se modificaron ventas ni caja
  operativa. No se desplegó nada ni se instaló nada en el equipo del restaurante.

## Integración restante: desglose aprobado por «ejecuta»

- [x] Reglas de liberación automática y botón manual confirmadas por el propietario.
- [x] Revisión humana del plan técnico de integración: «ejecuta».
- [x] T1 Consulta autenticada (M): NativeAccess, NativeRoutes, NativeHttp y tests.
  Aceptación: GET dining solo con identidad verificada y sin exponer tokens a vistas.
  Verificar sesión cambiada, 401/403, datos corruptos; Java y build. Depende acceso.
- [ ] T2 Detalle de mesa (M): NativeTables, NativeTablesView y sus tests.
  Aceptación: saldo remoto separado; botón Liberar visible y habilitado solo para
  pagada con ocupación coincidente. Verificar vacía/abierta/checkout/pagada/libre.
  Depende T1; revisión visual Android, no tocar mesas productivas.
- [ ] T3 Liberación durable (M): diario, coordinador y tests (máximo cinco archivos).
  Aceptación: ID persistido antes de enviar; doble toque/reinicio no duplican acción;
  fallo conserva cuenta y permite consulta. Java con disco/red falsos. Depende T2.
- [ ] Checkpoint T1–T3: selección y liberación sobre fixtures, npm test y build.
- [ ] T4 Consumos (M): borradores por contexto, coordinador y tests.
  Aceptación: solo lote nuevo, máximo 12000 bytes, borrador intacto ante conflicto;
  confirmar antes de limpiar. Fallos antes/después de envío. Depende T3.
  - [x] Envío de lote nuevo desde cuenta de mostrador a destino explícito; comprobar
    ocupación nuevamente, sin enviar si cambió la cuenta de la mesa seleccionada.
  - [x] Intento y productos en un único registro cifrado/atómico; recuperación del
    mismo ID/cuerpo; limpiar ambos solo tras respuesta autenticada confirmada.
  - [x] Validación de contrato y preflight de bytes UTF-8 antes de persistir/enviar;
    rechazo definitivo inicial conserva productos editables; respuesta desconocida
    mantiene intento y no permite sustituirlo por otro.
  - [x] Borradores independientes por contexto de cuenta/mostrador y navegación
    entre ellos, implementados y probados localmente. Validación visual abajo.
  - [ ] Verificación Android de selección, bytes JSON límite, ciclo de vida y
    persistencia Keystore. La compilación no sustituye esta comprobación.
- [ ] T5 Edición/traslado (M): modelo/vista de mesas y tests.
  Aceptación: admin edita número/posición; traslado solo destino permitido y misma
  cuenta; sin borrar pendientes. Contratos servidor y Android. Depende T4.
  - [x] Rutas acotadas, permisos renovados, diario durable, vista y pruebas locales.
  - [ ] Comprobación visual/táctil y Keystore en Android.
- [ ] C1 Turno (M): modelo/vista, rutas y tests.
  Aceptación: turno propio, apertura/fondo/cierre explícitos; confirmar servidor;
  recuperar incertidumbre. Fixtures de turnos y build. Depende T5.
  - [x] Consulta propia, apertura, cierre/arqueo explícitos, recuperación por ID,
    turnos autocerrados pendientes de arqueo, rutas fijas y pruebas locales.
  - [ ] Comprobación Android de teclado, navegación, persistencia y permisos.
- [ ] C2 Cobro durable (M): modelo/diario/coordinador/tests.
  Aceptación: conservar intento, efectivo suficiente, solo comprobante confirmado
  marca pagado; respuesta desconocida no permite otro cobro. Depende C1.
  - [x] Base de diario de cobro de mesa y validación de comprobante con servidor
    falso: identidad, contenido, importe, pago, cambio, reinicio y disco fallido.
  - [ ] Integrar transporte, preparación con estado/turno frescos, mostrador y
    traspaso durable a efectos. La base aún NO se conecta a pantalla ni a producción.
    - [x] Transporte autenticado y preparación de cobro de mesa con estado fresco;
      servicio integrado probado contra servidor simulado, incluida liberación
      restringida a la cuenta exacta pagada. Falta conectar la pantalla y efectos.
- [ ] C3 Cobro en pantalla (M): vistas y tests.
  Aceptación: imprimir/sin imprimir, total/cambio, liberar automáticamente reutiliza
  T3; liberación fallida no repite pago. Verificar flujo y reinicio. Depende C2.
- [ ] Checkpoint C1–C3: venta única, conciliación y liberación con fallos simulados.
- [ ] P1 Efectos físicos durables (M): diario, política y tests.
  Aceptación: sin imprimir no ticket; cambio efectivo sí gaveta; ninguna repetición
  automática con resultado desconocido. Emisor falso y reinicio. Depende C3.
- [ ] P2 USB integrado (M): coordinador/vista/manifiesto/build/tests.
  Aceptación: reutilizar dispositivo/comandos probados, permiso Android, cola
  serializada y reimpresión explícita sin cobro. Build y prueba Android. Depende P1.
- [ ] Entrega integrada: guía, firma y evidencias; ninguna APK parcial para instalar.

### Evidencia T1–T3

- NativeTables valida estado remoto y separa saldo pendiente de total registrado.
  NativeTablesView muestra salón numerado, detalle y botón Liberar mesa;
  solo pagada con comprobante y ocupación coincidente. T2 conserva pendiente
  la validación visual/táctil Android, no se declara terminada por compilar.
- NativeRelease guarda el intento cifrado antes de enviar, separado de borradores.
  Recupera el mismo ID después de timeout/reinicio; rechazo de revisión no reintenta
  automáticamente; nunca acepta una respuesta que omite la mesa como liberación.
  T3 implementado y probado con servidor/disco falsos; runtime Keystore pendiente.
- Doce grupos Java pasan; npm test completo pasó, y controles Node Android volvieron
  a pasar tras ajustes finales. Build -NativePos firmado, sin instalar ni desplegar.
- Artefacto INTERNO: android/build/dfc8532a8eb641738841e2ec301cc92a/Chingadazo-Integrado-INTERNAL.apk
  SHA256 ABD76FF776041A5778E985D10397895EE361B6CDF3B459EB83577E17315EA039.
  No distribuir como final: faltan consumos, cobros, efectos USB y acabado de catálogo.
- Git sigue sin commit inicial ni identidad configurada; no se incorporaron archivos
  ajenos ni se inventó autor. Servidor/web y datos productivos intactos.

### Evidencia parcial T4 — envío durable integrado localmente

- NativeDrafts formato 2 conserva lectura de formato 1. Registro único contiene
  productos e intento; evita la ventana de fallo entre dos archivos independientes.
  No borra una cuenta si falla disco, llega otra confirmación o cambia la revisión.
- NativeConsumption guarda antes de enviar; reintenta exactamente el mismo lote
  después de reinicio/respuesta perdida. No cobra, imprime ni libera mesas.
- NativeRoutes permite exclusivamente consume con campos acotados y copia profunda;
  NativeHttp usa el mismo serializador para preflight y envío, máximo 12000 bytes.
- NativeSalesView selecciona mesa libre/abierta, distingue saldo previo, bloquea
  edición de envíos inciertos y ofrece recuperar el mismo envío. No se instalaron
  pruebas en el restaurante ni se hicieron peticiones de escritura a producción.
- Trece grupos Java pasan: incluye pérdida de respuesta, cuerpo idéntico, doble
  toque, cambio de ocupación, rechazo, almacenamiento fallido y borrador antiguo.
- npm test completo: 81 archivos de pruebas pasan después de los cambios finales.
- Build firmado INTERNO: android/build/5549ac6d22924bfe88739207788567e7/Chingadazo-Integrado-INTERNAL.apk
  SHA256 28487A76FE85A4E35267DBBA3E054BA5C2FDB0FD4AE30BA671B6543B4D689732.
  No es entrega: pendientes arriba, T5, cobros, USB integrado y acabado de catálogo.

### T4 — cuentas por contexto

- NativeDraftContexts mantiene el cifrado y archivo atómico existente por operador;
  conserva formatos anteriores en Mostrador. Separa cuentas de mesa y permite
  recuperar borradores incluso cuando la mesa ya no muestra esa ocupación.
- Se eliminan únicamente registros vacíos antiguos durante guardado, nunca productos
  ni intentos pendientes. Una revisión global creciente rechaza vistas obsoletas
  después de esa limpieza. Test de 270 contextos completados junto a un envío incierto.
- Navegación Mesas → Agregar productos abre su contexto propio. Mostrador permanece
  separado. Saldo del servidor y nuevos productos se muestran por separado;
  falta de consulta no se presenta como saldo cero. El destino comprueba cuenta
  coincidente, también después de un traslado de mesa.
- No se instaló ni desplegó en HIOPOS. Falta validación de pantalla/persistencia en
  Android; T4 no se marca final por compilar. Continúan T5, turnos/cobros/USB y catálogo.
- Catorce grupos Java y compilación firmada pasan. npm test: 81 archivos pasan;
  controles Android enfocados volvieron a pasar tras el ajuste final de pantalla.
- Artefacto interno actualizado: android/build/610e2321d4624f8985a89c71beac98e0/Chingadazo-Integrado-INTERNAL.apk
  SHA256 0B2E0C8BEA658CEE7D57911A1BA1BAA310BDFC5052A48FDF39E619CCF5818BF7.

### T5 / C1 y base C2 — checkpoint local

- T5: agregar/editar número y posición requiere rol admin renovado. Traslado usa
  cuenta existente y destino libre; diario separado conserva el mismo intento.
- C1: rutas autenticadas fijas de turnos, diario cifrado separado, consulta del
  mismo ID antes de repetir apertura/cierre. Arqueos de cierre automático visibles.
  No se da por conciliado un importe diferente ni se escribe si falla guardado.
- NativeReceipt/NativeCheckout son base de C2, por ahora solo en pruebas Java:
  comprueban operador, ID, contenido, importe, efectivo/cambio y comprobante pagado.
  Conservan elección de imprimir y confirmación durable; aún sin transporte,
  mostrador, pantalla, liberación automática ni entrega a efectos físicos.
- Diecinueve grupos Java pasan y build -NativePos firmado para API23 pasa.
  Conserva package y certificado anteriores. Advertencias javac de Java8/deprecación;
  no son prueba de funcionamiento visual, Keystore o USB integrado en Android.
- Artefacto INTERNO: android/build/215e4c9dea2e467b887245dc10e461c1/Chingadazo-Integrado-INTERNAL.apk
  SHA256 E3123A0E88CDC746BF1A86B76F712DC552BC32BB7CF0249E5BB2F41917CBB6C9.
- No se instaló, desplegó ni modificó producción. No distribuir como caja final.
  Continuar C2/C3, P1/P2, catálogo/fotos y recorrido integrado; sin pedir otra
  aprobación ni entregar APKs parciales al propietario.

### C2 — servicio de cobro de mesas conectado localmente

- NativeAccess/NativeRoutes/NativeHttp permiten únicamente checkout con siete
  campos acotados y GET de comprobante por ID; sin URL arbitraria, credenciales
  en vistas ni modificación del servidor. El piloto de acceso no invoca esas rutas.
- NativePaymentPreparation consulta turno propio y valida cuenta, revisión,
  ocupación, importe mostrado y suma de productos antes de crear el intento.
- NativePaymentService conecta preparación, diario, transporte, recuperación y
  liberación de la cuenta exacta. Si cambia la ocupación, no libera la nueva cuenta.
  Prueba integrada con sesión real del modelo y servidor falso: respuesta perdida,
  consulta del comprobante, una sola venta y liberación posterior.
- El servicio se compila dentro de la APK, pero aún no se invoca desde la interfaz.
  No habilitar cobro en pantalla hasta integrar salida durable de efectos y permitir
  terminar el diario confirmado sin perder impresión/liberación pendiente. Falta
  mostrador; no tratar el servicio de mesa como cobro completo de la caja.
- 21 grupos Java pasan. Build API23 firmado interno:
  android/build/ab01474bd3fc4adc800d9d9cdd07f309/Chingadazo-Integrado-INTERNAL.apk
  SHA256 88AEEA3E0394CAE9197F26A44A6460F013FED18739175A4E11486EB6FE2628FA.
- No hubo peticiones a producción, instalaciones ni cambios en ventas reales.
  Pendientes: mostrador, pantalla C3, P1/P2, fotos y pruebas Android integradas.

### P1 — diario físico y entrega desde cobro, implementación local parcial

- NativeEffects conserva por operador/operación los bytes y estado de cada efecto.
  Marca UNKNOWN antes de enviar; caída, fallo parcial o fallo al guardar después
  no provocan repetición automática. SENT significa transferido, no salida física.
  Corte exige ticket transferido; trabajos de otras operaciones pueden continuar.
- NativePaidEffects valida de nuevo el comprobante, genera texto ASCII sin controles
  inyectados y separa ticket/corte/gaveta. Sin imprimir no hay ticket ni corte;
  efectivo con cambio sí genera gaveta; tarjeta sin imprimir no genera efectos.
- NativeCheckout.finish guarda primero los efectos y después vacía su intento.
  Si falla cualquiera de los guardados, recuperar conserva el mismo pago y no
  reinicia efectos ya enviados. NativePaymentService.finish libera la cuenta exacta
  antes de esa entrega. Todo sigue sin invocarse desde pantalla de cobro.
- Pruebas: envío parcial/reinicio/doble toque, disco antes de USB, entrega repetida,
  fallos entre cola y cierre del diario, aislamiento de operador y política de pago.
  22 grupos Java y compilación firmada API23 pasan. No se instaló ni desplegó.
- Artefacto exclusivamente INTERNO:
  android/build/530c3a64179249b58e5c38001f80967a/Chingadazo-Integrado-INTERNAL.apk
  SHA256 9C62D1DB010D7079154F6C0D5478B9A2B839F01E36172DD187BD782F3662488F.
- P1 NO está terminado: falta interfaz de pendientes/verificación/reimpresión,
  retención segura (límite actual 256 operaciones/512KiB; nunca elimina pendientes),
  instanciar diario cifrado y emisor USB único en Activity, cocina y permisos.
  También faltan mostrador, pantalla C3, fotos y validación Android integrada.
  No distribuir esta compilación como caja funcional ni pedir instalar otro piloto.

### C3 / P2 — pantalla de cobro de mesas conectada (compilación interna)

- NativePaymentsView se abre desde Mesas: total/productos, efectivo/tarjeta/
  transferencia, recibido/cambio, Cobrar e imprimir y Cobrar sin imprimir.
  Recuperación del mismo cobro y pendientes físicos accesibles sin seleccionar mesa.
  Bloquea cobrar si esa ocupación conserva productos locales sin confirmar.
- NativeUsb reutiliza UsbPrinter probado, filtro 8137:8214 y permiso Android.
  Una instancia de aplicación serializa salidas. Permiso/dispositivo se comprueban
  antes del marcador durable; conceder permiso por sí solo no envía comandos.
  Pago confirmado continúa distinto de impresión/liberación pendientes.
- Diarios payments/effects cifrados separados; lista de estados sin exponer bytes.
  Salidas transferidas se retiran solo después de cerrar su entrega de cobro;
  el intento aún durable queda protegido. Nunca se podan pendientes/desconocidos.
- Regresión nueva: recuperar entrega después de liberar y reocupar la mesa termina
  el cobro anterior sin liberar la cuenta nueva. Rojo y verde verificados.
- 22 grupos Java y 82 archivos Node pasan. Build API23 firmado:
  android/build/8895a2c1a3084f0cb2bd7c92c505dff9/Chingadazo-Integrado-INTERNAL.apk
  SHA256 01EE4F962139A07E5C19B909B4E07698314B14C9573E7164F0597521543ADD90.
- Sin instalación, llamadas de venta a producción ni pruebas físicas. Pantalla,
  teclado, permisos, Keystore y recorrido integrado siguen pendientes de runtime.
- NO es entrega final. Faltan cobro de mostrador (contrato createOrder distinto al
  checkout de mesas), cocina, reimpresión/copia y revisión de resultados físicos
  desconocidos, fotos/cache y validación completa. Mantener el aviso de desarrollo.
  No añadir genéricamente facturada/revision/changeGiven al validador de mostrador:
  createOrder confirma paidAt/invoiced con status nuevo y sin esos campos.

### Mostrador y revisión física — integración local, no entrega final

- NativeCounterCheckout guarda productos e intento de pago en un único registro
  atómico; consulta el mismo ID después de respuesta perdida. Valida identidad,
  turno, importes y productos del comprobante antes de confirmar/vaciar la cuenta.
  Transporte CREATE_ORDER fijo, autenticado y acotado al contrato de mostrador.
- NativeSalesView abre el cobro de mostrador en NativePaymentsView, con efectivo,
  tarjeta/transferencia, recibido/cambio y política imprimir/sin imprimir. Comparte
  diario USB con mesas. Formatos de borrador 1/2 migran al 5 sin perder líneas.
- Pruebas cubren almacenamiento antes/después del pago, respuesta perdida,
  discrepancias, propietario incorrecto, efectivo insuficiente, fallo de entrega
  a efectos y reanudación sin reenviar ticket ya transferido. Recuperación admite
  estados reales preparacion/listo/camino/entregado, no una lista inventada.
- Resultados USB UNKNOWN tienen confirmación física explícita con diálogo; nunca
  reenvía ni cambia ventas. VERIFIED persiste separado de SENT. No permite marcar
  como realizado un trabajo todavía no intentado. Corte pendiente puede continuar
  tras confirmar el ticket. Fallo de disco conserva UNKNOWN.
- Build firmado API23: android/build/5474bb10191945158b5da5eb5a155349/Chingadazo-Integrado-INTERNAL.apk
  SHA256 8515533ED665A1C555D63E684B5413B3D0EC9FBF8F070513508C4D7FA57A98F3.
  23 grupos Java y 82 archivos de pruebas Node pasan. No se instaló ni se
  modificaron ventas reales.
- Pendientes: cocina al aceptar lote, reimpresión explícita identificada como copia
  sin gaveta, fotos/cache, resolver de forma segura intentos de mostrador rechazados
  definitivamente (actualmente conservados/bloqueados, nunca descartados a ciegas),
  revisión de cierre/cambio de sesión y pruebas Android del recorrido completo.
  Un resultado físico no realizado sigue pendiente de esa recuperación/copia;
  no confirmarlo ficticiamente. No presentar esta compilación como terminada.

### Integración cocina/copias/fotos y cierre de revisión — 2026-10-04

- [x] Cocina por lote con preferencia y número de mesa persistidos; entrega a cola
  antes de vaciar borrador y USB después. Recuperar no duplica consumos.
- [x] Copia explícita identificada, sin cobro/gaveta. Historial hasta 20 operaciones
  sujeto a 128 KiB; nunca podar pendientes o resultados desconocidos.
- [x] Fotos empaquetadas y caché de memoria 4 MiB, alternativa texto. Sin descargas
  externas ni sincronización automática de fotos nuevas.
- [x] Rechazo definitivo inicial de mostrador desbloquea solo tras comprobar
  ausencia del mismo ID; conserva productos. Un resultado ambiguo sigue protegido.
- [x] Tamaño de ticket/comanda validado antes del consumo/cobro. Cola llena permite
  drenar trabajos anteriores sin retirar entregas financieras aún protegidas.
- [x] Revisión independiente cerró los tres hallazgos y no encontró borrado de
  borradores/efectos al cambiar usuario. Logout retira credenciales, no diarios.
- [x] 24 grupos Java, 82 archivos Node, compilación firmada y verificación de firma.
- [ ] Validación Android integrada: pantallas, teclado, sesión, Keystore, USB,
  cobro/liberación, reinicio y rendimiento. Sin Android conectado ni emulador local.

Artefacto: android/build/b1d5bdf039174ad1b14d880fd75c9145/Chingadazo-Integrado-INTERNAL.apk
SHA256: C372ECFEFE962C240D35E890D8063733B43873FF7C6FACE9A556F1DEE8828315.
Guía vigente: android/VALIDACION-INTEGRADA.md. No hubo instalación, publicación ni
ventas reales. No declarar final ni sustituir caja en servicio sin esa validación.
