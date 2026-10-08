// Private snapshot primitives. No production restore or automatic scheduling.
const PROJECT = 'el-chingadazo-cfe45';
const FORMAT = 1;
const MAX_BYTES = 10 * 1024 * 1024;
const encoder = new TextEncoder();
const secretFields = new Set(['password', 'pin', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'privatekey', 'clientsecret', 'pinpepper', 'firebaseserviceaccountjson']);
const normalized = key => key.replace(/[_-]/g, '').toLowerCase();

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !secretFields.has(normalized(key)))
      .map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

function payload(snapshot) {
  // Fixed header order; checksum covers metadata as well as data.
  return JSON.stringify({ formatVersion: snapshot.formatVersion, projectId: snapshot.projectId, createdAt: snapshot.createdAt, data: snapshot.data });
}

async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSnapshot(source, createdAt = new Date().toISOString()) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('No hay datos válidos para respaldar.');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('Fecha de respaldo inválida.');
  const data = clean(source);
  // Backup bookkeeping is not operational data and must not grow recursively.
  delete data.backupState;
  delete data.backupJobs;
  const snapshot = { formatVersion: FORMAT, projectId: PROJECT, createdAt, data };
  const serialized = payload(snapshot);
  if (/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(serialized)) throw new Error('Se detectaron credenciales inesperadas; respaldo detenido.');
  const bytes = encoder.encode(serialized);
  if (bytes.byteLength > MAX_BYTES) throw new Error('El respaldo excede el límite seguro; requiere revisión.');
  return { ...snapshot, sizeBytes: bytes.byteLength, sha256: await digest(bytes) };
}

export async function verifySnapshot(snapshot) {
  if (snapshot?.projectId !== PROJECT) throw new Error('El respaldo pertenece a otro proyecto.');
  if (snapshot.formatVersion !== FORMAT || typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt)) || !snapshot.data || typeof snapshot.data !== 'object' || Array.isArray(snapshot.data)) throw new Error('El formato del respaldo no es válido.');
  const bytes = encoder.encode(payload(snapshot));
  if (bytes.byteLength > MAX_BYTES || bytes.byteLength !== snapshot.sizeBytes || await digest(bytes) !== snapshot.sha256) throw new Error('Falló la comprobación de integridad del respaldo.');
  return structuredClone(snapshot.data);
}

// A retry produces another private copy, never overwrites an existing account or
// claims exactly-once execution. Callers must not automatically retry endlessly.
export async function writeVerifiedBackup(bucket, source) {
  if (!bucket) throw new Error('El almacenamiento privado de respaldos no está configurado.');
  const snapshot = await createSnapshot(source);
  const key = `backups/${PROJECT}/v1/${snapshot.createdAt.replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`;
  await bucket.put(key, JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
    customMetadata: { projectId: PROJECT, formatVersion: String(FORMAT), sha256: snapshot.sha256 }
  });
  const stored = await bucket.get(key);
  if (!stored) throw new Error('No se pudo verificar la copia guardada.');
  const readback = JSON.parse(await stored.text());
  await verifySnapshot(readback);
  if (readback.sha256 !== snapshot.sha256) throw new Error('Falló la comprobación de integridad de la copia guardada.');
  return { key, createdAt: snapshot.createdAt, sizeBytes: snapshot.sizeBytes, sha256: snapshot.sha256, verified: true };
}
