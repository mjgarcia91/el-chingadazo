// Read-only, offline inspection. Never prints operational data or writes Firebase.
import { readFile, stat } from 'node:fs/promises';
import { verifySnapshot } from '../server/backups.js';
const filename = process.argv[2];
if (!filename) {
  console.error('Uso: node scripts/verify-backup.mjs <copia.json>');
  process.exitCode = 1;
} else {
  try {
    if ((await stat(filename)).size > 11 * 1024 * 1024) throw Error('Archivo demasiado grande.');
    const snapshot = JSON.parse(await readFile(filename, 'utf8'));
    const restored = await verifySnapshot(snapshot);
    console.log(JSON.stringify({ verified: true, projectId: snapshot.projectId, createdAt: snapshot.createdAt, sizeBytes: snapshot.sizeBytes,
      counts: Object.fromEntries(['orders','users','roles','shifts'].map(key => [key, Object.keys(restored[key] || {}).length])) }));
  } catch {
    console.error('No se pudo verificar la copia: archivo, proyecto, formato o integridad inválidos. No se modificó ningún dato.');
    process.exitCode = 1;
  }
}
