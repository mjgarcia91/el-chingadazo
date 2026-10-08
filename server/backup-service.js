import { writeVerifiedBackup, verifySnapshot } from './backups.js';
const PREFIX = 'backups/el-chingadazo-cfe45/v1/';
const OWN_KEY = /^backups\/el-chingadazo-cfe45\/v1\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}\.json$/;
const failure = (message, status) => Object.assign(new Error(message), { status });

export function createBackupService({ db, mutateDb, identity, json }) {
  async function retain(bucket) {
    const copies = [];
    let cursor;
    do {
      const page = await bucket.list({ prefix: PREFIX, include: ['customMetadata'], limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const item of page.objects) {
        if (OWN_KEY.test(item.key) && item.customMetadata?.projectId === 'el-chingadazo-cfe45' && item.customMetadata?.formatVersion === '1') copies.push(item.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
      if (page.truncated && !cursor) throw Error('Listado incompleto.');
    } while (cursor);
    // Never evict a good copy on the strength of metadata alone. A failed
    // previous upload may exist in the bucket without being recoverable.
    const verified = [];
    for (const key of copies.sort().reverse()) {
      const stored = await bucket.get(key);
      if (!stored) continue;
      try { await verifySnapshot(JSON.parse(await stored.text())); verified.push(key); }
      catch { throw Error('Hay una copia no verificable; retención detenida.'); }
    }
    const expired = verified.slice(30);
    for (let offset = 0; offset < expired.length; offset += 1000) await bucket.delete(expired.slice(offset, offset + 1000));
  }

  async function run(env, actor = 'scheduled') {
    if (!env.BACKUPS) throw failure('El almacenamiento de respaldos no está configurado.', 503);
    const attemptId = crypto.randomUUID(), now = new Date().toISOString();
    // Shared CAS, not an isolate-local flag. After a crash the block expires;
    // another copy is harmless, but callers must check status before retrying.
    await mutateDb(env, '/backupState', current => {
      const state = current || {};
      if (Date.now() - Date.parse(state.lastAttemptAt || '') < 15 * 60 * 1000) throw failure('Hay un respaldo reciente o en proceso. Consulta el estado antes de volver a intentarlo (15 minutos).', 409);
      return { ...state, attemptId, actor, lastAttemptAt: now, running: true, lastError: '' };
    }, 5, true);
    try {
      const result = await writeVerifiedBackup(env.BACKUPS, await db(env, ''));
      await mutateDb(env, '/backupState', current => {
        if (current?.attemptId !== attemptId) throw failure('El estado cambió; consulta el último respaldo.', 409);
        return { ...current, running: false, lastSuccess: result, lastError: '' };
      });
      try {
        await retain(env.BACKUPS);
      } catch {
        await mutateDb(env, '/backupState', current => ({ ...current, lastError: 'Copia verificada; no se pudo completar la retención. Requiere revisión.' }));
      }
      return result;
    } catch {
      await mutateDb(env, '/backupState', current => current?.attemptId === attemptId ? { ...current, running: false, lastError: 'No se pudo confirmar el nuevo respaldo. Se conserva la última copia verificada.' } : current);
      throw failure('No se pudo confirmar el respaldo. Consulta el estado antes de reintentar.', 503);
    }
  }

  async function handle(request, env) {
    const actor = await identity(request, env);
    if (!actor) return json({ error: 'Inicia sesión.' }, 401);
    if (actor.role !== 'admin') return json({ error: 'Solo administración puede gestionar respaldos.' }, 403);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
    if (request.method === 'POST') {
      if (request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Origen no autorizado.' }, 403);
      try { return json(await run(env, actor.id), 201); }
      catch (error) { return json({ error: error.status ? error.message : 'No se pudo confirmar el respaldo.' }, error.status || 503); }
    }
    const state = await db(env, '/backupState') || {};
    const last = state.lastSuccess;
    return json({
      configured: Boolean(env.BACKUPS), dailyEnabled: env.BACKUP_DAILY_ENABLED === 'true', retention: 30,
      lastSuccess: last ? { createdAt: last.createdAt, sizeBytes: last.sizeBytes, verified: last.verified === true } : null,
      lastAttemptAt: state.lastAttemptAt || null, running: state.running === true,
      lastError: state.lastError || '', stale: !last || Date.now() - Date.parse(last.createdAt) > 26 * 60 * 60 * 1000
    });
  }
  return { run, handle };
}
