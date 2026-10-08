// One-off, owner-authorized maintenance. No sale, inventory or application deployment.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { instance, assertInstance } from '../server/instance.js';

const service = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
assertInstance({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(service) });
assert.equal(service.project_id, 'el-chingadazo-cfe45');
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const seconds = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat: seconds, exp: seconds + 600 });
const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), service.private_key).toString('base64url');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
assert.equal(tokenResponse.ok, true, 'Authentication failed');
const token = (await tokenResponse.json()).access_token;
assert.ok(token);
const headers = { Authorization: 'Bearer ' + token };
const base = instance.firebase.databaseURL.replace(/\/$/, '') + '/app';
const accountId = 'account-9ae111d0-3740-4b45-a150-5f9d356c990a';
const operationId = 'maintenance-void-table2-test-20261002';
const response = await fetch(base + '/dining.json', { headers: { ...headers, 'X-Firebase-ETag': 'true' } });
assert.equal(response.ok, true);
const etag = response.headers.get('etag');
assert.ok(etag);
const before = await response.json();
if (before.operations?.[operationId]) {
  assert.equal(before.accounts[accountId].status, 'cancelled');
  console.log('Already cancelled; no changes made.');
  process.exit(0);
}
const original = before.accounts[accountId];
assert.equal(before.schemaVersion, 1);
assert.equal(before.tables['table-2'].accountId, accountId);
assert.equal(original.tableId, 'table-2');
assert.equal(original.status, 'open');
assert.equal(original.total, 189);
assert.equal(original.openedAt, '2026-09-29T00:35:13.458Z');
assert.equal(original.items.length, 1);
assert.equal(original.items[0].productId, 'tacos-birria');
assert.equal(original.items[0].qty, 1);
assert.equal(original.items[0].unit, 189);
assert.ok(!original.checkout && !original.orderId && !original.paidAt && !original.cancelledBatches);
const orderResponse = await fetch(base + '/orders/dining-' + accountId + '.json', { headers });
assert.equal(orderResponse.ok, true);
assert.equal(await orderResponse.json(), null, 'A sale exists; abort');
const next = structuredClone(before), account = next.accounts[accountId];
const at = new Date().toISOString(), by = 'maintenance-owner-authorized';
account.cancellation = { operationId, at, by, reason: 'Cuenta de prueba confirmada por el propietario; anulación autorizada expresamente en el chat el 2026-10-02.', originalAccount: structuredClone(original), amount: 189, noSaleCreated: true };
// Preserve original kitchen records without claiming they were served.
account.cancelledBatches = account.batches || {};
delete account.batches;
account.status = 'cancelled';
account.closedAt = at;
account.closedBy = by;
account.revision++;
account.history.push({ action: 'cancelTestAccount', at, by, operationId, reason: account.cancellation.reason, amount: 189 });
next.tables['table-2'].accountId = '';
next.revision++;
next.updatedAt = at;
next.operations ||= {};
next.operations[operationId] = { action: 'cancelTestAccount', accountId, by, at, revision: next.revision, reason: account.cancellation.reason };
// Prove that only the target account/table and salon audit metadata differ.
const unrelated = state => { const copy = structuredClone(state); delete copy.accounts[accountId]; delete copy.tables['table-2']; delete copy.revision; delete copy.updatedAt; delete copy.operations?.[operationId]; return copy; };
assert.deepEqual(unrelated(next), unrelated(before));
assert.deepEqual({ ...next.tables['table-2'], accountId }, before.tables['table-2']);
assert.ok(Buffer.byteLength(JSON.stringify(next)) < 4 * 1024 * 1024);
if (process.argv[3] !== '--apply') { console.log('Validated: Mesa 2, test account L.189, no sale; dry run only.'); process.exit(0); }
const write = await fetch(base + '/dining.json', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(next) });
assert.equal(write.ok, true, 'Conditional write rejected; do not overwrite concurrent changes');
const checkResponse = await fetch(base + '/dining.json', { headers });
assert.equal(checkResponse.ok, true);
const check = await checkResponse.json();
assert.equal(check.accounts[accountId].status, 'cancelled');
assert.equal(check.tables['table-2'].accountId, '');
assert.deepEqual(check.accounts[accountId].cancellation.originalAccount, original);
assert.ok(!check.accounts[accountId].batches);
console.log(JSON.stringify({ verified: true, table: 'Mesa 2', status: 'cancelled', amount: 189, tableFree: true, originalPreserved: true, operationId, at }));
