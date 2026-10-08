# Plan inicial — mesas y continuidad

Estado vigente 28/09/2026: recorrido Caja primero aprobado y publicado, versión 3db11fed-4203-4570-ae19-f641e91c3f89. CC1–CC4 completos para Caja/admin; 68 archivos de pruebas y navegador aislado verificados. Rol mesero pendiente. Ver ../CAJA-MESAS.md y la sección inicial de todo.md; el texto siguiente conserva el plan anterior.

## Siguiente integración: caja-cocina

Funcionamiento confirmado por el propietario. CC1–CC2 implementados localmente y probados: primer consumo abre cuenta, nuevos envíos generan comandas diferentes, cocina actualiza estado sin cobrar. Revisión visual antes de CC3–CC4; no publicado ni habilitado remotamente. Detalles del contrato y límites en `../SPEC-caja-cocina.md`.

Orden vertical: tomar/enviar consumos de mesa → agregar desde Caja → cobrar sin duplicación conservando ocupación → permisos de mesero y cocina → verificación completa y publicación. Reutilizar validación de catálogo y liquidación existentes; no crear una segunda contabilidad. Dependencias compartidas requieren trabajo secuencial. Puertas: prueba del primer recorrido antes del cobro; prueba de fallos de cobro antes de publicar. Detalle en todo.md.

Estado actualizado 2026-09-28: propietario aprobó implementación y publicación. M1–M5 implementados y probados; M6 verificado con datos sintéticos y navegación integrada. 60 archivos de pruebas aprobados. Ver `../MESAS.md` para alcance y límites; el plan original siguiente conserva contexto histórico. Consumos y cobros de mesas siguen fuera de esta entrega.

## Decisiones

Dos pisos, barra con tres posiciones y plaza temporal; mesas configurables. Dispositivos múltiples online, una caja principal para contingencia. Firebase sigue siendo la autoridad central; no inventar sincronización offline entre dispositivos. Conservar datos y operación actual.

## Orden y puertas de revisión

1. Revisar `SPEC-resguardo.md`: destino privado, prueba de recuperación y propuesta de frecuencia/retención. No activar facturación sin aprobación.
2. Implementar resguardo en incrementos verificables (lista en `todo.md`).
3. Especificar continuidad-local: persistencia transaccional del borrador y solicitud antes del envío, idempotencia y resolución de conflictos, acceso tras reinicio y protocolo de contingencia. Revisar con el propietario.
4. Especificar mesas-cuentas: plano/zonas, mesas activas y temporales, cuenta abierta, movimientos y concurrencia. Revisar antes de migrar datos.
5. Especificar caja-cocina: rol mesero, comandas incrementales, inventario, impuestos/redondeo, pago y cierre atómico con el turno. Revisar antes de afectar cobros.
6. Probar el recorrido completo: abrir mesa → agregar y enviar consumos → corte/reinicio → recuperar/reconciliar → trasladar → cobrar una vez → liberar mesa. Probar dos dispositivos y pantalla de cocina opcional.

## Riesgos

- Almacenamiento local lleno/borrado: no mostrar «guardado» sin confirmación; no prometer recuperación si se destruye el único dispositivo con pendientes.
- Respuesta de cobro perdida: conservar identificador y consultar resultado, nunca repetir como una venta nueva.
- Cambios simultáneos en mesa/cuenta: control de versión y rechazo de conflictos; no último escritor gana.
- Reconexión con sesión o turno vencido: conservar operación pendiente, pedir autorización y resolver explícitamente; no inventar un turno.
- Cocina sin red/pantalla: protocolo operativo manual pendiente; la interfaz no declara recepción sin acuse.
- Datos sensibles offline: diseño de autorización y mínima información antes de persistir cuentas en equipos compartidos.
- No existe copia automática verificada hoy; no presentar el diseño como cobertura ya operativa.

## Verificación y reversión

## Primera entrega de continuidad-local — aprobada, implementación local

C1–C2 implementados con 55 archivos de pruebas aprobados, compilación y empaquetado verificados sin publicación. Se recuperó una cuenta sintética tras recarga y cierre de la pestaña, con bloqueo de una segunda editora. Pendiente el punto de revisión del recorrido integrado y ensayos de dispositivos antes de publicar. Ver `../CONTINUIDAD-LOCAL.md`.

Decisión del propietario: guardar consumos durante el corte, sin cobros provisionales. No cambiar autenticación ni agregar acceso offline por PIN en esta entrega. La recuperación después de reiniciar puede requerir volver a conectarse para iniciar sesión; no descartar datos mientras tanto.

Orden secuencial:

1. Cuenta duradera: escritura local transaccional por operador, recuperación tras acceso, estado de guardado y exclusión de dos pestañas editoras. No persistir todas las órdenes ni credenciales en el almacén público existente.
2. Envío seguro: persistir la solicitud exacta antes de enviarla; conservar resultados inciertos, comprobar por identificador y revisar conflictos/turno/sesión antes de reintentar. Bloquear cobros cuando se sabe que no hay conexión.
3. Ensayo aislado: recarga, cierre, corte a mitad de envío, almacenamiento lleno y dos pestañas; publicación solo tras pasar pruebas. No generar ventas de prueba en producción.

Cada incremento será verificable antes del siguiente. No ampliar al módulo de mesas ni alterar cuentas reales para probar la recuperación. Tareas detalladas añadidas al listado existente, sin borrar pendientes de resguardo.

## Comprobaciones generales

`npm run build`, `npm test`, `npm run check:deploy`, pruebas por módulo y ensayos de fallos. Esquemas aditivos; activación gradual por configuración. Antes de migraciones: respaldo probado y plan de recuperación. Revertir código no revierte datos ni cobros. Publicar solo tras aceptación de cada incremento; mantener pedidos públicos cerrados durante pruebas.

## Mesas-cuentas — plan técnico para revisión

### Alcance aprobado

Mesas 1–2 en Primer nivel; 3–20 en Segundo nivel; Barra 1–3 adicionales; Plaza inicialmente sin mesas, con altas para eventos. Configuración editable, una cuenta por mesa, traslado a destino libre y preservación del historial. Sin división/unión ni cobros offline. El propietario autorizó avanzar con este alcance; la revisión pendiente corresponde al esquema y plan siguientes, no a repetir la distribución.

### Decisiones propuestas

1. Agregar un nodo privado `/dining` bajo la raíz existente de El Chingadazo, sin migrar datos previos. Contendrá `schemaVersion`, `revision`, `zones`, `tables`, `accounts` y `operations`. Identificadores internos estables; número visible independiente. Inicialización admin explícita e idempotente, nunca sembrar datos por simplemente visitar una página.
2. Apertura y traslado mediante `mutateDb` sobre ese nodo, con revisión esperada. La comprobación y modificación de ocupación de ambas mesas ocurren en la misma transacción; mantener el mutador libre de efectos secundarios porque puede reintentarse.
3. Guardar cada operación con identificador estable, actor, contenido normalizado y resultado dentro de la misma transacción. Repetir contenido igual devuelve el resultado previo; reutilizar identificador con otro contenido falla. No borrar el registro de operaciones ni cuentas para ahorrar espacio sin una política de archivo aprobada.
4. API privada dedicada `/api/dining`, sin abrir rutas arbitrarias a Firebase. Reutilizar identidad remota de `access.identity`; solo admin configura y admin/cajero opera. Clientes y cocina no reciben acceso operativo al salón. Reservar rol mesero para el siguiente módulo.
5. Interfaz propia `js/dining.js` y `css/dining.css`, con adaptador pequeño en `js/app.js`. No incorporar lógica de transacciones al archivo grande de la interfaz existente. No persistir el salón en el caché público de `Store`.
6. Primera versión de este módulo maneja mesas y cuentas, no toma ni factura consumos de mesa todavía. Mostrar ese límite explícitamente durante validación local. La interfaz de reserva/liberación para `caja-cocina` será interna al servidor; no aceptar una confirmación de pago enviada por el navegador como prueba de cobro.
7. Actualización de estado solo mientras la vista está activa; petición de lectura tras cada mutación y al volver a la vista. Si un dato quedó antiguo o falta red, indicar estado no actualizado y bloquear mutaciones. No introducir WebSockets ni dependencias nuevas.

### Orden y verificaciones

M1 servicio privado e inicialización → M2 interfaz de consulta/configuración → M3 conexión a Personal → punto de revisión → M4 apertura/traslado → M5 frontera para Caja → M6 verificación integrada. Cada tarea y sus pruebas se detallan en `todo.md`; no se borran pendientes de continuidad o respaldos.

Construir y probar todo primero con datos sintéticos aislados. No publicar ni inicializar `/dining` en producción durante estos incrementos. Antes de una publicación posterior: completar revisión de continuidad local, prueba integrada de móviles/tablets y respaldo real verificado.

### Riesgos y mitigaciones

- Contención en `/dining`: apropiado inicialmente para el salón de 23 posiciones, con reintentos acotados y conflictos visibles. Medir tamaño/tiempo de transacciones; no afirmar escalabilidad ilimitada ni purgar historial automáticamente. Definir un límite de payload que falle explícitamente antes de escrituras excesivas.
- Respuesta perdida: conservar operación original localmente y consultar/reintentar por su mismo identificador; nunca crear una apertura nueva por timeout.
- Un traslado mientras otro empleado prepara consumos: la cuenta conserva ID y revisión; el módulo de comandas deberá comprobarlos antes de aceptar datos. No publicar consumos de mesa hasta integrar ese contrato.
- Cobro confirmado y mesa aún ocupada: etapa recuperable en `caja-cocina`; no cobrar otra vez ni liberar sin evidencia. Este módulo no implementa por su cuenta una segunda ruta de facturación.
- Reversión: desactivar la interfaz nueva sin borrar `/dining`; si existen cuentas activas, resolverlas antes de volver a operar sin el módulo.

### Puerta de implementación

Esquema privado y publicación aprobados por el propietario. Respaldo productivo previo verificado. Implementación completada dentro del alcance de configuración/cuentas vacías; integración caja-cocina y ensayos físicos multidispositivo pendientes.
