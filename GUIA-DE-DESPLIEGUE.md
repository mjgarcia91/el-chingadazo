# El Chingadazo — Guía de despliegue con Wrangler

Estado al 28 de septiembre de 2026. Wrangler es la herramienta de Cloudflare que publica el código y los archivos de la aplicación. Este documento no publica nada por sí solo.

## Primera publicación realizada

Publicado en `https://el-chingadazo.magaa1825.workers.dev`, versión `ecd123e6-2d2a-4f5c-bfd9-a9e8cc17ca71`. Portada y `/personal` responden 200; catálogo público con 26 productos; pedidos y delivery desactivados; usuarios y órdenes sin autorización responden 401 e internos del servidor 404. Auditoría de dependencias sin vulnerabilidades reportadas. Falta que el propietario pruebe su contraseña en `/personal`; no se han validado cobros, cocina, impresión ni toda la operación. El propietario confirmó haber agregado el dominio autorizado y restablecido el bloqueo de creación de claves. Wrangler activó también las URL de vista previa por defecto.

Las secciones siguientes conservan el registro de preparación previo; la publicación indicada arriba reemplaza las notas de «aún no publicado». No abrir ventas hasta completar las comprobaciones operativas.

## Carpeta que debes utilizar

`C:\Users\magaa\Downloads\Tipicos APP\TIPICOS-EL-TRAPICHE-V123\EL-CHINGADAZO`

Aunque la carpeta contenedora conserve el nombre de Típicos, el proyecto independiente está dentro de `EL-CHINGADAZO`. No ejecutes el despliegue desde la carpeta de Típicos. No basta con subir un HTML o este documento: se necesita la carpeta completa de El Chingadazo.

## Lo que ya quedó preparado

- Firebase exclusivo: `el-chingadazo-cfe45`, administrado por Manuel/KORE.
- Realtime Database en Estados Unidos, con lectura y escritura públicas bloqueadas.
- 26 productos, categorías, horarios y correo público cargados y verificados.
- Pedidos y delivery desactivados.
- Primer administrador de la app: `elchingadazohn@gmail.com`. Usa la contraseña que creaste para esta app, no la de Gmail.
- Cuenta de Cloudflare confirmada: `magaa1825@gmail.com`.
- ID de cuenta Cloudflare: `ad01c9f5295df9b7268040f664085008`.
- Worker exclusivo: `el-chingadazo`. Ya existe para alojar los secretos; todavía no contiene el despliegue completo de la aplicación.
- Almacenamiento R2 exclusivo: `el-chingadazo-private-documents`, vinculado en la configuración como `DRIVER_DOCS`.
- Secretos guardados: `FIREBASE_SERVICE_ACCOUNT_JSON` y `PIN_PEPPER`.
- Acceso por correo y contraseña habilitado. Google sigue pendiente para no mostrar el correo personal de Manuel como soporte.

## Preparación verificada y pendientes antes de publicar

La configuración local tiene `configured: true` y `publicOrigin: 'https://el-chingadazo.magaa1825.workers.dev'`. La comprobación del destino y la simulación de Wrangler pasan; esto no sustituye los pendientes operativos ni publica la app.

1. **Confirmado por captura:** `el-chingadazo.magaa1825.workers.dev`. Production se veía desactivado; no se cambió en esta revisión. El dominio comprado puede añadirse después.
2. **Completado:** dirección registrada y conexión activada en `js/instance-config.js`. No se han incluido claves privadas en los archivos públicos.
3. **Comprobado:** 43 archivos de pruebas pasan, incluidas pruebas explícitas de preparación sin red y de configuración conectada. Lectura real desde el Worker ejecutado localmente: 26 productos, 9 categorías; pedidos y delivery cerrados, bono cero. Usuarios, roles y órdenes rechazan lectura anónima con 401. La revisión no escribió datos remotos.
4. **Parcialmente completado:** portada con pedidos pausados, registro sin bono heredado y botones de Google ocultos. Portal de empleados revisado visualmente. Falta probar el acceso real del administrador después de publicar y aprobar/adaptar las reglas heredadas de canjes e historias antes de operar. No se consideran funciones validadas por pasar las pruebas automatizadas.
5. Revisar los dominios autorizados de Firebase Authentication para el dominio de publicación, especialmente antes de habilitar Google o usar enlaces de recuperación/verificación.
6. Confirmar que solo se modificó la excepción de creación de claves de El Chingadazo y que se restableció el bloqueo después de obtener la clave. No eliminar la clave activa.

Los pasos 5 y 6 siguen sin verificarse en esta revisión. El servidor de vista previa `127.0.0.1:4173` solo sirve pantallas y bloquea las APIs; no introducir allí la contraseña para comprobar la operación. El acceso completo debe probarse en la infraestructura publicada.

## Comprobaciones desde PowerShell

Abre una terminal en la carpeta independiente indicada arriba. En esta computadora ya están instaladas las dependencias. No es necesario instalarlas de nuevo para cada publicación.

```powershell
Set-Location -LiteralPath 'C:\Users\magaa\Downloads\Tipicos APP\TIPICOS-EL-TRAPICHE-V123\EL-CHINGADAZO'
npx wrangler whoami
npx wrangler secret list --name el-chingadazo
npm run build
npm test
npm run check:deploy
```

Comprueba que `whoami` muestre la cuenta de Cloudflare confirmada y que la lista incluya ambos secretos. `secret list` muestra los nombres, no su contenido. `check:deploy` empaqueta y simula el despliegue; no publica. Si falla un paso, detente y revisa el error antes de continuar.

No pegues el JSON de la cuenta de servicio en la terminal, el chat, el código público ni Git. Ya está guardado como secreto; no hace falta volver a subirlo. No regeneres `PIN_PEPPER` en cada despliegue: cambiarlo puede invalidar los PIN y las sesiones existentes.

## Publicación, después de resolver los pendientes

Ejecuta con doble clic:

`DESPLEGAR-EL-CHINGADAZO.bat`

O desde la misma carpeta:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = 'ad01c9f5295df9b7268040f664085008'
npm run deploy
```

El lanzador comprueba el destino, genera los archivos públicos y publica el Worker `el-chingadazo`. Debe conservar el depósito y los secretos exclusivos. No utilices un destino con el nombre de Típicos.

Guarda la dirección HTTPS que confirme Wrangler al finalizar. El portal de empleados estará en esa dirección seguida de `/personal`. La dirección `127.0.0.1:4173` es únicamente la vista previa local, no el sitio publicado.

## Verificación antes de abrir pedidos

- Abrir el sitio en computadora y teléfono; revisar logo, menú, precios y fotos.
- Entrar en `/personal` con el correo administrador y la contraseña de la app, sin compartirla.
- Comprobar que una cuenta de cliente no pueda acceder a administración.
- Comprobar horarios y pausa manual. Mantener el restaurante cerrado durante la revisión.
- Probar caja, cocina, impresión y notificaciones según los dispositivos y servicios habilitados.
- Completar WhatsApp, pagos, cobertura y tarifas de delivery, promociones/canjes y políticas comerciales.
- Configurar aparte Maps, notificaciones, correo de reportes y Gerente IA si se van a utilizar. No están confirmados como operativos por el solo hecho de desplegar.
- Revisar errores del Worker antes de abrir ventas.

Si algo falla, no abras pedidos. Para una actualización futura, conserva la versión anterior verificada y restáurala desde los despliegues de Cloudflare si es necesario; volver a una versión anterior del código no revierte los datos de Firebase. En la primera publicación todavía no hay una versión funcional previa de esta app a la que regresar.

## Límite de esta entrega

Esta guía y el lanzador son para El Chingadazo. No implican que el sistema ya esté publicado ni que se haya completado una prueba de acceso real en el portal. Firebase y Cloudflare continúan bajo las cuentas acordadas; el Gmail del restaurante administra la aplicación, no la infraestructura.
