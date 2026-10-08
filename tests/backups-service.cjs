const assert = require('node:assert/strict');
(async () => {
  const { createBackupService } = await import('../server/backup-service.js');
  const { createSnapshot } = await import('../server/backups.js');
  const data = { orders: { o1: { total: 100 } } }, objects = new Map();
  let role = 'admin', reads = 0, fail = false;
  const bucket = {
    put: async (key, value, options) => { if (fail) throw Error('secret infrastructure error'); objects.set(key, { value, customMetadata: options.customMetadata }); },
    get: async key => objects.has(key) ? { text: async () => objects.get(key).value } : null,
    list: async ({ prefix }) => ({ objects: [...objects].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, customMetadata: value.customMetadata })), truncated: false }),
    delete: async keys => keys.forEach(key => objects.delete(key))
  };
  const db = async (_, path) => { reads++; return structuredClone(path === '' ? data : data.backupState || null); };
  const mutateDb = async (_, path, update) => { assert.equal(path, '/backupState'); data.backupState = update(structuredClone(data.backupState || null)); return structuredClone(data.backupState); };
  const service = createBackupService({ db, mutateDb, identity: async () => role ? { role, id: 'auth-test' } : null, json: (value, status=200) => Response.json(value, { status }) });
  const env = { BACKUPS: bucket, BACKUP_DAILY_ENABLED: 'false' };
  const req = method => new Request('https://example.test/api/backups', { method });
  for (role of [null, 'cashier', 'kitchen', 'customer', 'waiter']) {
    const before = reads;
    assert.ok([401,403].includes((await service.handle(req('POST'), env)).status));
    assert.equal(reads, before);
  }
  role = 'admin';
  assert.equal((await service.handle(req('DELETE'), env)).status, 405);
  assert.equal((await service.handle(req('POST'), {})).status, 503);
  assert.equal((await (await service.handle(req('GET'), env)).json()).lastSuccess, null);
  const response = await service.handle(req('POST'), env);
  assert.equal(response.status, 201);
  const status = await (await service.handle(req('GET'), env)).json();
  assert.equal(status.lastSuccess.verified, true);
  assert.equal(JSON.stringify(status).includes('orders'), false);
  assert.equal(data.orders.o1.total, 100);
  assert.equal((await service.handle(req('POST'), env)).status, 409, 'Shared cooldown avoids repeat clicks');
  const previous = data.backupState.lastSuccess;
  data.backupState.lastAttemptAt = '2000-01-01T00:00:00Z'; fail = true;
  assert.equal((await service.handle(req('POST'), env)).status, 503);
  assert.deepEqual(data.backupState.lastSuccess, previous);
  assert.equal(data.backupState.lastError.includes('secret'), false);
  fail = false;
  for (let day=1; day<=32; day++) {
    const key = `backups/el-chingadazo-cfe45/v1/2025-01-${String(day).padStart(2,'0')}T00-00-00-000Z-00000000-0000-4000-8000-${String(day).padStart(12,'0')}.json`;
    objects.set(key, { value: JSON.stringify(await createSnapshot({ orders: {} })), customMetadata: { projectId: 'el-chingadazo-cfe45', formatVersion: '1' } });
  }
  objects.set('unrelated.json', { value: 'leave untouched', customMetadata: {} });
  data.backupState.lastAttemptAt = '2000-01-01T00:00:00Z';
  assert.equal((await service.handle(req('POST'), env)).status, 201);
  assert.equal([...objects.keys()].filter(k=>k.startsWith('backups/')).length,30);
  assert(objects.has('unrelated.json'));
  console.log('PASS backup admin boundary, verified status, failure preservation, cooldown, scoped retention.');
})().catch(error => { console.error(error); process.exitCode = 1; });
