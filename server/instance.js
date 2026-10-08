import '../js/instance-config.js';
export const instance = globalThis.CHINGADAZO_CONFIG;
export function assertInstance(env) {
  const f = instance.firebase;
  if (!instance.configured || !f.apiKey || !f.projectId || !f.databaseURL || !f.authDomain || !f.appId) {
    throw Object.assign(new Error('El Chingadazo está en preparación. Pronto habilitaremos el servicio.'), { status: 503 });
  }
  if (/trapiche|tipicos/i.test(JSON.stringify(instance))) throw new Error('Configuración de otro restaurante rechazada.');
  const url = new URL(f.databaseURL);
  const ownDatabase = url.hostname === `${f.projectId}-default-rtdb.firebaseio.com` || (url.hostname.startsWith(`${f.projectId}-default-rtdb.`) && url.hostname.endsWith('.firebasedatabase.app'));
  if (url.protocol !== 'https:' || !ownDatabase) throw new Error('La base de datos no corresponde al proyecto independiente.');
  const service = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
  if (service.project_id !== f.projectId) throw Object.assign(new Error('La cuenta de servicio no corresponde a El Chingadazo.'), { status: 503 });
  return service;
}
