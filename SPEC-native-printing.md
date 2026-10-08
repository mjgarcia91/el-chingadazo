# Especificación: native-printing

Estado: política de impresión y gaveta confirmada por el propietario.
Depende de native-checkout; reutiliza USB probado.

## Objetivo y política

Impresión, corte y gaveta dentro de la misma APK, sin RawBT, Firefox ni WebView.
Reutilizar PrinterCore/UsbPrinter y los comandos comprobados físicamente; no copiar
código de Invelec. Dispositivo permitido USB Printer P, VID8137/PID8214; nunca táctil.

- Permiso USB solicitado por Android cuando corresponda; no prometer suprimir
  permisos del sistema. No pedir un toque por cada ticket si ya existe permiso.
- «Cobrar e imprimir»: emitir ticket de cliente y corte tras pago confirmado.
- «Cobrar sin imprimir»: no emitir ticket ni corte; abrir gaveta cuando el pago
  confirmado sea efectivo y tenga cambio. Tarjeta/transferencia no abren gaveta.
- Cocina: al aceptar un lote, imprimir únicamente productos nuevos cuando la
  configuración lo habilite. No duplicar la comanda al cobrar después la mesa.
- Resumen identifica «NO ES COMPROBANTE DE PAGO». Reimpresión identifica copia y
  no cobra ni abre gaveta. Reimpresión siempre explícita.
- Diario privado durable por operación y efecto (cocina/cliente/corte/gaveta),
  marcado antes del envío. Un cierre o envío parcial deja resultado desconocido.
  No repetir automáticamente: USB transferido no demuestra papel salido/gaveta abierta.
- Fallo físico no revierte pago ni bloquea facturación de otras cuentas confirmadas;
  mostrar pendiente de impresión y evitar reenvío involuntario. No vaciar la cola
  al cerrar sesión ni mostrar tickets de otro operador sin permiso.
- Contenido y cantidades acotados, sin comandos ESC/POS inyectados desde notas.
  Serializar envíos, liberar interfaz tras cada trabajo y no competir con otras apps.

## Tecnología, estructura y estilo

Java 8/API23; android/src/hn/chingadazo/pos/, pruebas android/test/ y tests/.
No dependencias nuevas. Adaptador USB ya existente, coordinador durable y vista
de estado integrados en NativePosActivity. No APK por módulo.
Ejemplo de regla: `if (resultUnknown) requirePhysicalCheck();` (no API implementada).

## Comandos y pruebas

Desde EL-CHINGADAZO: `npm test`; `./android/build.ps1 -NativePos`.
Emisor falso: desconexión, permiso denegado, fallo de disco, envío parcial, doble
toque, reinicio en cada límite y reimpresión explícita sin nuevo pulso de gaveta.
Validar textos/importes contra venta confirmada. Compilación/firma no sustituyen
confirmación física del flujo integrado; usuario ya confirmó comandos aislados.

## Aceptación y fronteras

Una APK funciona sin terceros; política de impresión/cambio respetada; no reintentos
físicos a ciegas; fallos diferenciados del estado financiero. Siempre conservar
diario y explicar resultados desconocidos. Consultar nuevos modelos de impresora,
dependencias o cambio de política. Nunca borrar RawBT/datos, cambiar Android/AnyDesk,
rootear, enviar a USB arbitrario o declarar que imprimió solo por respuesta de envío.

