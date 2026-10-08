# Caja: pantallas independientes de espera y cobro

Estado: alcance confirmado por el propietario. Implementación local en validación; no publicada.

## Objetivo y aceptación

Separar la composición del pedido, la recuperación de cuentas de mesa y la confirmación de pago en pantallas internas de la misma app. Las fotografías de HIOPOS son referencias de navegación, no autorización para copiar sus tarifas, impuestos, servicios de pago ni datos.

1. Caja conserva categorías verticales a la izquierda, productos al centro y pedido/total a la derecha. Cabecera compacta. Ofrece botones En espera, Guardar en espera/asignar mesa y Cobrar.
2. En espera abre una pantalla dedicada con mesas y saldos, estados de carga/error/vacío y regreso a Caja. Seleccionar una cuenta permite agregar productos desde Caja sin reenviar consumos anteriores.
3. Cobrar abre una pantalla dedicada con resumen del pedido o cuenta seleccionada, total, efectivo/tarjeta/transferencia, importe recibido y cambio. Ofrece confirmar e imprimir, confirmar sin imprimir y volver sin cobrar.
4. Entrar, salir o cancelar una pantalla no factura, no elimina consumos y no modifica una mesa. Solo confirmar registra un pago mediante los mecanismos actuales protegidos contra duplicación.
5. La selección de mesa y el borrador se conservan al navegar. Operaciones pendientes o sin respuesta siguen recuperables; no se habilita cobro sin internet ni sin turno abierto.
6. Verificar con cuentas ficticias: pedido nuevo, guardar en mesa, recuperar, agregar consumo, volver de cobro sin cobrar, confirmar una sola vez, error y reintento. Probar 320, 768, 1024 y 1440 píxeles.

## Tecnología y estructura

JavaScript sin framework; vistas en js/app.js, cuentas de mesa en js/dining-cash.js, disposición en js/screens.js y css/dining-cash.css. Backend existente en server/; pruebas Node/JSDOM en tests/. Documentación en la raíz. Simulador aislado scripts/preview-cash.mjs. No introducir dependencias ni modificar el esquema de datos.

## Comandos

- Pruebas: npm test
- Construcción: npm run build
- Simulador local: node scripts/preview-cash.mjs
- Validación de despliegue sin publicar: npm run check:deploy
- Publicación, únicamente tras autorización y validación: npm run deploy
- El proyecto no declara comandos de lint ni comprobación de tipos.

## Estilo

Mantener funciones y contratos actuales, identificadores claros y HTML escapado. Usar botones reales, etiquetas para campos, estados de error visibles y foco al cambiar de pantalla. Ejemplo del estilo existente: `const money=v=>'L '+Number(v||0).toFixed(2);`. No usar una cifra de ejemplo como total real.

## Pruebas

Agregar pruebas que fallen antes de modificar las rutas/pantallas. Comprobar conservación del borrador y que abrir/cancelar no escriba pagos. Reutilizar pruebas de conciliación, idempotencia y turnos. Verificar visualmente en navegador con datos locales; no crear ventas de prueba en producción.

## Límites

- Siempre: conservar controles de permisos, turno, continuidad e idempotencia; informar claramente si algo está local o publicado.
- Consultar: pestañas reales del navegador en vez de pantallas internas, métodos de pago adicionales, propinas, pagos parciales o cambios de impuestos.
- Nunca: modificar Típicos, borrar cuentas reales, copiar datos o porcentajes de las fotos, cobrar automáticamente al entrar en una pantalla.

## Orden propuesto

Tras aprobar este alcance, detallar y revisar la integración: navegación interna y espera; pantalla de cobro reutilizando contratos actuales; pruebas completas y revisión visual; autorización de publicación en Cloudflare. No publicar la versión intermedia de paneles desplegables si se sustituye por este recorrido.

## Implementación

- js/cash-screens.js redistribuye los controles existentes sin duplicar formularios, IDs ni manejadores de venta. Las pantallas no crean pestañas del navegador.
- La confirmación de mesas conserva el mismo intento y operación protegidos. La preferencia de imprimir viaja en el diario del intento como printReceipt; el backend conserva el mismo contrato financiero y no la usa para calcular el pago.
- La conservación de desplegables usa sus claves data-fold, no posiciones, porque los controles ahora cambian de ubicación.
- Pruebas nuevas: tests/cash-screens.cjs y tests/cash-table-payment-screen.cjs. Verificación del navegador con servidor local y datos ficticios. La impresión física del HIOPOS queda para comprobación en el equipo.
- No se hicieron cambios de esquema, dependencias, impuestos, catálogo ni cuentas reales.
