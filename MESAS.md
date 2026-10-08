# Mesas — salón único

## Uso vigente (v129)

Un salón con mesas 1–30, sin barras, pisos ni eventos. Administración puede **Agregar mesa** (sugiere 31 y la primera posición libre), o seleccionar una mesa y abrir **Editar mesa** para cambiar número, fila, columna y estado activo. No permite números repetidos, posiciones activas ocupadas ni desactivar mesas con cuentas. Límite: 200 mesas. La edición no traslada ni cobra cuentas.

Caja conserva Guardar en espera, pedidos adicionales y cobro completo; véase CAJA-MESAS.md. Trasladar cuenta y liberar mesa pagada mantienen sus validaciones anteriores.

La actualización administrativa de la distribución conserva IDs, cuentas, consumos e historial. Las barras originales 1–3 pasan a mesas 21–23. Conserva copia privada de la configuración anterior. Detalles técnicos y retorno: tasks/release-v129.md.

## Registro histórico (no son instrucciones vigentes)

Las secciones siguientes documentan entregas anteriores y sus límites de aquel momento; la distribución por niveles fue reemplazada por el salón único.

## Flujo vigente de Caja (versión 126)

El propietario aprobó y pidió publicar la atención desde Caja. Consultar [CAJA-MESAS.md](CAJA-MESAS.md): guardar en espera, asignar mesa, agregar nuevas tandas y cobrar la cuenta completa. Las siguientes secciones conservan el registro del incremento anterior. No se cambia la distribución del restaurante.

## Siguiente incremento local, todavía no publicado

Implementados y probados productos por mesa, apertura automática con el primer envío, saldo acumulado y comandas incrementales de cocina. Vista aislada: `node scripts/preview-dining.mjs`, luego `http://127.0.0.1:4174/`; usa datos ficticios en memoria, sin Firebase. No utilizar como sistema operativo del restaurante.

Pendiente: entrada desde Caja, liquidación única, mesa pagada/ocupada con liberación explícita y rol mesero. La habilitación remota sigue desactivada por defecto; no activar `DINING_CONSUMPTIONS_ENABLED` antes de completar y verificar el recorrido de cobro. La versión publicada descrita abajo no cambió durante este incremento. Git sigue sin historial ni autor configurado; no se crearon commits que atribuyan archivos previos a una identidad inventada.

Publicación autorizada por el propietario. Entrega: configuración del salón y cuentas vacías; todavía no registrar consumos ni cobrar mesas. La Caja habitual permanece disponible.

Publicado: `c629a5a8-fabd-4307-877f-7b1c7f41b01c`. Verificado en producción: Personal y recursos de Mesas responden 200, API sin sesión responde 401, archivos internos/pruebas responden 404. La nueva pestaña solicita PIN; inicialización de las 23 posiciones pendiente de acceso del propietario. No se crearon cuentas sintéticas en producción.

## Uso

Entrar en Personal como administrador o cajero y seleccionar Mesas. El administrador puede inicializar 20 mesas (1–2 abajo, 3–20 arriba), tres posiciones de barra y una zona Plaza inicialmente vacía. Inicializar nuevamente no sobrescribe datos.

Seleccionar una zona y Configurar mesa para agregar o editar número, ubicación, fila, columna y estado temporal. Una mesa ocupada no puede desactivarse. Abrir cuenta ocupa una mesa; trasladar conserva la cuenta y libera el origen únicamente si el destino está libre. Solo un administrador puede cerrar una cuenta vacía; se conserva su historial.

Esperar confirmación del servidor. Si se pierde una respuesta, Consultar operación pendiente reutiliza la misma operación. No borrar el almacenamiento del navegador para resolver un pendiente. Sin conexión no se permiten cambios de mesas. Los borradores de Caja y las cuentas de mesas son mecanismos separados.

## Verificación y límites

60 archivos de pruebas aprobados; empaquetado de publicación correcto; auditoría de dependencias sin vulnerabilidades conocidas. Pruebas sintéticas de concurrencia, traslados, permisos, repetición segura y recuperación de respaldo. Navegador aislado: abrir, trasladar y agregar una mesa de Plaza; vistas de celular/tablet/escritorio. No se crearon ventas de prueba en producción.

Pendiente: integración de consumos, rol mesero, comandas y cobro de mesas; pruebas físicas de corte eléctrico y recorrido completo entre teléfonos reales. La interfaz informa ese límite. El contrato interno de cobro no está expuesto como una ruta operativa.

## Reversión

Versión anterior: `94b5d379-5ba2-4dd3-95c4-ecf12646d988`. Revertir código no borra `/dining`, cuentas, historial ni borradores locales. Revisar cuentas activas antes de retirar el módulo. Respaldo privado real verificado antes de publicar: 28/9/2026 4:24 p. m. Honduras. No se modificó Típicos.

