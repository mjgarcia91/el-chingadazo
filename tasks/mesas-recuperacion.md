# Mesas: navegación y liberación directa

Solicitud: liberar las mesas pagadas y simplificar el acceso. Confirmadas por el usuario: mesas 21 y 22 pagadas. Inspección de producción: 28 libres, 2 en checkout.

Alcance: permitir navegar a Caja y Mesas en espera aunque exista un intento pendiente; conservar el bloqueo de otro cobro. Añadir Liberar mesa al salón únicamente para cuentas pagadas, usando la operación existente que conserva historial. No borrar consumos ni registrar pagos nuevos para resolver el incidente.

Pruebas: reproducir navegación bloqueada y ausencia de liberación directa; suite completa; comprobación en navegador aislado. Conciliación de las dos cuentas requiere revisar la causa, no forzar estados.

Rollback: versión de Worker 377f7b01-803f-4bc7-a246-ab5a0f5c5f16 (v130). Sin migración de base de datos para los cambios de interfaz. Repositorio sin commit inicial; no incluir archivos heredados en un commit masivo.

## Implementación y verificación

- CashScreens permite volver a venta o consultar espera durante un intento pendiente; otro cobro sigue bloqueado.
- El salón muestra Liberar mesa únicamente para cuentas pagadas. Usa la operación release existente, sin borrar la cuenta histórica.
- Conciliación confirma la cuenta pagada solo después de comprobar la venta durable. Un fallo de inventario queda en inventoryPending y no retiene la mesa; cuentas cerradas no se reabren al reintentar inventario.
- Inventario guarda planCount para reconocer planes vacíos omitidos por Firebase. Marcadores antiguos sin plan siguen needsReview: no se presume que el inventario ya se descontó.
- 77 archivos de pruebas aprobados; nuevos casos reprodujeron antes del arreglo los bloqueos de navegación, liberación ausente, cuenta retenida por inventario y plan vacío. Caso adicional: una venta cancelada no autoriza liberar.
- Navegador aislado: navegación de ida/vuelta con operación pendiente y liberación sin crear cobro; consola sin errores. npm run check:deploy aprobado, npm audit --omit=dev sin vulnerabilidades.
- Revisión independiente sin bloqueantes. Seguimiento: equidad de la cola de inventario cuando más de 20 registros permanecen pendientes indefinidamente; checkout se prioriza.
- Publicado v131, Worker 69c7b9b8-051a-4257-9106-5fac47102ab7, 2026-10-03 05:18 UTC.
- Producción 05:21 UTC: conciliación confirmó paid de ambas cuentas. Se liberaron Mesa 21 (L433) y Mesa 22 (L199) mediante el botón existente. Confirmación del servidor: 30 libres, 0 ocupadas. Recepción conserva 2 ventas por L632, sin recobros. Evidencia: mesas-liberadas-v131.jpg.
- Los dos marcadores antiguos de inventario siguen pendientes de revisión; no se borraron ni se marcaron consumidos por suposición. No impiden reutilizar las mesas.
