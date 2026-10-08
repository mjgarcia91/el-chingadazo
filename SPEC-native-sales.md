# Especificación: native-sales

2026-10-03. Alcance aprobado por el propietario: «Sí, aprobar catálogo y cuenta
nativos». Plan autorizado posteriormente por «ok ejecutala»; implementación en curso.
Depende de native-access; continúa CAPACIDADES-APK-NATIVA.md.
El propietario pidió incorporar lo restante conservando interfaz y operaciones.

## Objetivo y límites de esta capacidad

Recrear la pantalla de caja existente con categorías, fotos, productos, opciones,
cantidades, notas y cuenta lateral. Preservar negro/dorado, nombres y organización;
adaptar los controles a vistas Android nativas, no prometer identidad píxel a píxel.
El catálogo remoto actual es la fuente de verdad; no usar precios semilla como
catálogo vigente ni crear otra base de datos comercial.

Esta capacidad prepara una cuenta local; no cobra, libera mesas ni imprime.
Esas operaciones siguen en native-tables, native-checkout y native-printing.
No cambiar la web operativa. Administración y delivery continúan en web según
el mapa aprobado; no simular botones funcionales para funciones aún pendientes.

## Tecnología, estructura y estilo

Java 8, Android API23, SDK/JDK y firma existentes, sin nuevas dependencias.
Fuentes propuestas en android/src/hn/chingadazo/pos/: NativeSales.java (modelo),
NativeDrafts.java (persistencia), NativeSalesActivity.java (UI).
Pruebas Java en android/test/; contratos Node en tests/.
Ampliar transporte de native-access mediante destinos explícitos, no URLs arbitrarias.
Sin exponer tokens a las vistas; toda red/disco fuera del hilo gráfico.

Estilo: validación explícita, modelo separado de la UI y cantidades monetarias
en centavos enteros para cálculo local. Ejemplo de regla, no API implementada:

```java
if (savedRevision != expectedRevision) throw new IOException("La cuenta cambió.");
```

## Contrato observado y comportamiento

- Leer GET /api/data/products y /api/data/categories del origen fijo existente;
  server/access.js ya ofrece esos nodos. Validar objetos, identificadores únicos,
  precios finitos no negativos, límites de tamaño, grupos/opciones e imágenes.
- Revisar ajustes necesarios con campos permitidos antes de incorporarlos;
  no asumir que todos los ajustes públicos son contratos de caja.
- Respetar available=false, opciones required/multi, opciones válidas no duplicadas,
  cantidades 1..50, máximo 50 líneas y notas hasta 500 caracteres. Coincidir con
  priceItems de server/access.js y el compositor existente, sin reescribir el servidor.
- Mostrar productos por categoría y el total nuevo por separado del saldo de mesa
  cuando native-tables se conecte. Un carrito vacío no equivale a cuenta pagada.
- Persistir el borrador antes de confirmar visualmente cada modificación. Identificar
  por usuario/cuenta y revisión; cancelar callbacks de otra sesión. Cerrar sesión no
  borra borradores y el siguiente operador no accede a ellos.
- Conservar borradores en almacenamiento privado cifrado, excluido de backups.
  Si lectura/escritura falla, bloquear cambios que aparentarían estar guardados;
  no sobrescribir el borrador corrupto ni descartar productos silenciosamente.
- Sin red, mostrar catálogo almacenado como desactualizado y borrador como pendiente;
  no confirmar venta ni acceso offline. El servidor recalcula precios al enviar en
  el módulo correspondiente; informar cambios antes de confirmar un cobro.
- No importar automáticamente localStorage de navegador/RawBT ni borrar sus datos.
- Retención: conservar borradores pendientes hasta envío confirmado o descarte
  explícito de su propietario. No guardar DNI, teléfono o datos de pago en este módulo.

## Pruebas y comandos

Desde EL-CHINGADAZO: `npm test` y `./android/build.ps1 -NativeAccess` para regresión
de acceso. Agregar construcción interna `./android/build.ps1 -NativePos` al build;
no entregar otro piloto: la siguiente entrega reúne todos los módulos.

Pruebas primero en rojo: importes y opciones, catálogo inválido/incompleto,
duplicados, límite de líneas, fallo de disco, recuperación después de cierre,
cambio de operador, respuesta tardía y pérdida de red. Fixtures de productos
basadas en el contrato real; contrastar totales con priceItems del servidor.
La UI debe probarse en Android, no solo compilar: selección, teclado, scroll,
fotos y cuenta lateral legibles en HIOPOS. Sin ventas reales de prueba.

## Criterios de aceptación

1. Catálogo vigente visible con disposición reconocible de la caja actual.
2. Agregar, editar y quitar productos/opciones conserva totales correctos.
3. Reiniciar recupera el borrador del operador correcto sin pérdidas ni duplicados.
4. Fallos de red/disco no producen una cuenta aparentemente enviada o cobrada.
5. API23 sin WebView, Firefox, RawBT ni bibliotecas de Invelec.
6. Pruebas y build pasan; revisión visual y persistencia confirmadas en HIOPOS.

## Fronteras

Siempre: permisos del servidor, TLS, destinos permitidos, validación y pruebas.
Consultar antes: nuevo esquema, dependencias, migraciones y reemplazo productivo.
Nunca: borrar cuentas, copiar código de Invelec, cobrar offline, ocultar pendientes,
quitar controles de concurrencia o afirmar lista la caja por mostrar productos.

## Revisión pendiente

Especificación y plan detallado en tasks/plan-apk.md aprobados. El propietario
rechazó nuevas instalaciones por función: construcción y pruebas locales hasta
la integración completa; luego comprobación remota breve durante momento tranquilo.
La corrección del PIN pertenece a native-access ya aprobado.
