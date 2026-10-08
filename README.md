# El Chingadazo · KORE Systems

Instalación independiente basada en la versión 123 de Típicos El Trapiche. El código original permanece en la carpeta hermana `TIPICOS-EL-TRAPICHE-V123`; no existe vínculo de despliegue, sincronización, Git ni datos entre ambas carpetas.

## Estado actual

- Identidad, logo original y colores de El Chingadazo.
- 26 opciones en 8 categorías, con precios transcritos del PDF suministrado el 28 de septiembre de 2026.
- 8 fotografías extraídas sin modificación del PDF. Son ilustrativas; los productos sin fotografía propia conservan un marcador sin usar fotos del restaurante anterior.
- Dirección: Plaza Las Casitas, Anillo Periférico, Honduras. Enlace de Maps suministrado por el propietario; coordenadas pendientes de comprobar.
- Horario editable por día: lunes cerrado; martes a jueves y domingo 13:00–22:00; viernes y sábado 13:00–00:00. Para eventos se puede cambiar el cierre a 01:30 del día siguiente.
- Control de pausa manual de pedidos, independiente del horario semanal.
- Módulos heredados de clientes, caja, cocina, administración, inventario, reportes, delivery, juegos y puntos.
- Firebase exclusivo `el-chingadazo-cfe45` conectado en la configuración, con lectura real del catálogo comprobada desde el servidor. Pedidos y delivery permanecen desactivados.
- Aplicación publicada: `https://el-chingadazo.magaa1825.workers.dev`. Versión inicial `ecd123e6-2d2a-4f5c-bfd9-a9e8cc17ca71`. Se verificaron portada, portal de empleados, catálogo de 26 productos, pedidos cerrados y rechazo de lectura anónima de datos privados. Falta la prueba de acceso con contraseña por el propietario.
- Acceso por correo preparado; Google oculto hasta habilitar su proveedor. El administrador de la app es `elchingadazohn@gmail.com`; su inicio de sesión completo aún requiere prueba en el sitio publicado.

## Desarrollo local

### Crear personal desde la app

En Administración → Usuarios y roles → Agregar usuario, completar nombre, rol (administrador, caja o cocina) y PIN de seis números. Foto opcional. No se pide UID, correo ni contraseña. Los nuevos usuarios, incluidos administradores, acceden por PIN únicamente en equipos previamente autorizados. La cuenta principal con correo se conserva para autorizar equipos nuevos y recuperación. El servidor comprueba el administrador activo que crea el usuario y guarda perfil, rol y resumen criptográfico HMAC del PIN en una transacción; no guarda el PIN en texto claro. Un PIN repetido se rechaza, incluso si dos solicitudes compiten. El flujo antiguo por UID se conserva únicamente para compatibilidad, no se muestra en el formulario.

Actualización publicada: `9cdec76c-651f-4916-a36c-3a7b51ce100d`. Pasaron 45 archivos de pruebas, incluyendo creación con PIN, permisos, guardado atómico y formulario sin correo/UID; las llamadas de creación/login se prueban con Firebase simulado. No se creó ningún administrador real durante la verificación. Si fuera necesario revertir esta actualización, la versión previa es `ecd123e6-2d2a-4f5c-bfd9-a9e8cc17ca71`; revertir código no elimina usuarios ya creados. El ZIP entregado anteriormente no incluye esta actualización.

`npm ci` instala dependencias. `npm run preview` genera los archivos públicos y abre un servidor local en http://127.0.0.1:4173. `npm test` ejecuta las pruebas. `npm run check:deploy` solo empaqueta y simula el despliegue.

## Separación técnica

Repositorio Git nuevo, sin remoto. Worker `el-chingadazo`, depósitos privados `el-chingadazo-private-documents` y `el-chingadazo-private-backups`, rutas de dominio vacías. Respaldo diario registrado a las 03:00 de Honduras; las demás tareas programadas siguen desactivadas. Cookies, cachés y claves locales utilizan el prefijo `chingadazo`. Ver `RESPALDOS.md` para evidencia, límites y recuperación.

La configuración pública vive en `js/instance-config.js`. Las cuentas de servicio y secretos se guardan exclusivamente en Cloudflare. El servidor comprueba que la cuenta de servicio corresponda al Firebase configurado, rechaza referencias al restaurante anterior y bloquea las APIs mientras la nueva instalación no esté configurada. Las llamadas heredadas usan un nombre virtual `.invalid` interceptado por `js/transport.js` y se dirigen exclusivamente a la API del mismo sitio.

El despliegue se ejecuta desde esta carpeta con `npm run deploy` o `DESPLEGAR-EL-CHINGADAZO.bat`. Una comprobación previa bloquea el despliegue mientras falte Firebase o la dirección pública. Nunca se copian `.wrangler`, credenciales, bases de datos, clientes, personal, ventas ni tokens del proyecto anterior.

## Pendiente antes de operar

1. WhatsApp del restaurante; confirmar horarios de eventos, ingredientes, opciones de carnes y tamaños que el PDF no especifica. Correo público: `elchingadazohn@gmail.com`.
2. Confirmar que L 55 corresponde a la base de michelada y cargar las cervezas con sus precios adicionales.
3. Definir los canjes y promociones de puntos para el nuevo menú: las reglas heredadas de torta/bonos/historias todavía necesitan aprobación y adaptación antes de habilitarse.
4. Revisar el dominio autorizado de Firebase Authentication y verificar el acceso del administrador. Firebase, catálogo y administrador ya existen; no volver a inicializar ni sobrescribir la base.
5. Cloudflare, R2 y secretos de cuenta de servicio y PIN ya existen. Quedan notificaciones, Maps, correo de reportes y Gerente IA según los servicios que se activen.
6. Confirmar coordenadas, cobertura y tarifas de delivery; medios de pago y textos comerciales/privacidad propios.
7. Pruebas reales de acceso, cobro, cocina, impresión, notificaciones y entrega en la infraestructura nueva.
8. Conectar dominio y habilitar tareas programadas de mantenimiento después de verificar la operación.

La vista previa permite explorar el menú y simular un carrito. Su servidor local responde 503 a las APIs: no usarlo para validar el acceso de empleados. La comprobación de lectura conectada se ejecutó separadamente contra el servidor de la app; no demuestra cobros ni operaciones completas. Las pruebas de aislamiento fijan explícitamente el modo de preparación en memoria y no dependen del valor de despliegue de `configured`.

Ver `GUIA-DE-DESPLIEGUE.md` para los pasos y límites de publicación. No hay commits todavía: falta configurar la identidad de autor de Git; los archivos permanecen en la carpeta independiente.
