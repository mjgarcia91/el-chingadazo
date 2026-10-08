# Mesas y continuidad operativa — El Chingadazo

## Estado

Alcance funcional confirmado por el propietario en esta conversación: dos pisos, aproximadamente 20 mesas configurables por número, dos mesas habituales en primer nivel, barra del segundo nivel dividida en tres secciones y mesas temporales distribuidas por la plaza en eventos. No se presupone el reparto exacto de las demás mesas ni su numeración inicial.

Celulares/tablets para meseros; cocina preparada para conectar una pantalla posteriormente. Contingencia con una sola caja principal, sin servidor local en la primera versión. No hay sincronización entre dispositivos desconectados. Diseño técnico de los módulos pendiente de revisión; nada de este documento está implementado por su sola existencia.

## Mapa de capacidades

| Identificador | Responsabilidad | Dependencias |
|---|---|---|
| resguardo | Copias privadas, estado de respaldo y restauración ensayada | Ninguna |
| continuidad-local | Guardado duradero de cuentas y operaciones pendientes; recuperación y reconciliación sin duplicación | resguardo |
| mesas-cuentas | Zonas, plano editable, mesas numeradas, barra, cuentas abiertas y traslados | continuidad-local |
| caja-cocina | Comandas por mesa, cobro, liberación de mesa, permisos de meseros y cocina | mesas-cuentas |

Orden: resguardo → continuidad-local → mesas-cuentas → caja-cocina. Especificar y validar cada módulo antes de construirlo. Primera especificación: `SPEC-resguardo.md`. Plan inicial: `tasks/plan.md`.

Actualización 2026-09-28: `continuidad-local` implementado localmente, todavía sin publicar. A solicitud del propietario se preparó `SPEC-mesas-cuentas.md`; está pendiente de revisión, no implementado.

## Reglas acordadas y límites propuestos

- Administración configura zonas/mesas y permisos. Se pueden agregar mesas sin reconstruir la aplicación.
- Distinguir mover un objeto en el plano de trasladar su cuenta a otra mesa. No cobrar ni cambiar consumos al moverla.
- No eliminar/desactivar una mesa con cuenta abierta. No sobrescribir la cuenta de una mesa destino ocupada.
- Cada ampliación de una cuenta genera una comanda identificable; no se reenvían consumos anteriores como nuevos.
- Meseros toman pedidos; caja cobra; cocina recibe/prepara. No habilitar cobros ni privilegios administrativos a meseros por omisión.
- Sin conexión, mostrar claramente «guardado en este dispositivo / pendiente de envío». No declarar recibida una comanda por cocina ni confirmado un cobro por el servidor sin acuse.
- Solo la caja de contingencia continúa la operación local; los demás dispositivos conservan sus pendientes sin operar sobre una supuesta copia sincronizada. Conflictos al reconectar requieren resolución visible, nunca sobrescritura silenciosa.
- Reabrir el navegador sin internet plantea un requisito adicional de autenticación local: el acceso actual depende de Firebase. No prometer acceso offline tras reinicio hasta especificar y probar esa frontera de seguridad.
- Un equipo sin alimentación no puede trabajar; pérdida física del dispositivo o borrado de sus datos puede destruir cambios aún no enviados. El software no sustituye respaldo eléctrico ni conectividad alternativa.
- Primera versión sin servidor local, sin cobros de tarjeta offline y sin unión/división de cuentas hasta que se acuerde expresamente su alcance.
- Solo El Chingadazo: no modificar código, datos, despliegue ni infraestructura de Típicos.

## Aún por decidir durante los módulos correspondientes

Numeración inicial y distribución exacta; equipo que será caja de contingencia; duración/condiciones del acceso local offline; procedimiento físico para llevar comandas a cocina cuando no haya pantalla o internet; frecuencia/retención/destino de respaldos y costos antes de activar servicios.
