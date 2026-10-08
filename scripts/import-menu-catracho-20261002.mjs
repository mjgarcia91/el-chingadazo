// Additive content import from the owner's 1000365713.jpg. No application deploy.
// Default: read-only validation. --apply: create absent entries, never overwrite.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { instance, assertInstance } from '../server/instance.js';

const categories = [
  ['catracho', 'Menú catracho', '🍽️'], ['sodas', 'Sodas', '🥤'],
  ['naturales', 'Naturales', '🍹'], ['cervezas-nacionales', 'Cervezas nacionales', '🍺'],
  ['cervezas-internacionales', 'Cervezas internacionales', '🍺'],
  ['tequila', 'Tequila', '🥃'], ['vodka', 'Vodka', '🥃']
].map(([id, name, icon]) => ({ id, name, icon }));
const rows = [
  ['pollo-plancha', 'Pollo a la plancha', 179, 'catracho', 'Pechuga de pollo BBQ asada a la plancha, acompañada con escabeche, chismol, aguacate, frijoles fritos, queso y tortillas.'],
  ['chuleta-costena', 'Chuleta costeña', 179, 'catracho', 'Chuleta BBQ a la plancha, servida con crujientes y delgadas tajaditas de mínimo, aderezos, chimichurri y ensalada de repollo.'],
  ['chuleta-tipica', 'Chuleta típica', 179, 'catracho', 'Chuleta BBQ asada a la plancha, acompañada con escabeche, chismol, aguacate, frijoles fritos, queso y tortillas.'],
  ['pincho-tipico', 'Pincho típico', 179, 'catracho', 'Pincho de carne de cerdo con chorizo, frijoles, queso, escabeche, aguacate y tortillas.'],
  ['costilla-costena', 'Costilla costeña BBQ', 179, 'catracho', '6 trozitos de costilla barbacoa, chimichurri, escabeche, chismol y aderezos de la casa.'],
  ['picadero-especial', 'Picadero especial', 195, 'catracho', 'Trozos de chuleta BBQ asada a la plancha, escabeche, chismol, frijoles, nachos, queso y chorizo.'],
  ['coca-cola', 'Coca-Cola', 35, 'sodas'], ['canada-dry', 'Canada Dry', 35, 'sodas'],
  ['fanta', 'Fanta', 35, 'sodas'], ['fresca', 'Fresca', 35, 'sodas'], ['agua', 'Agua', 20, 'sodas'],
  ['refresco-natural', 'Refresco natural', 35, 'naturales', 'Consultar sabores disponibles.'],
  ['cubetazo-nacional', 'Cubetazo nacional', 270, 'cervezas-nacionales'],
  ['salvavida', 'Salvavida', 50, 'cervezas-nacionales'], ['imperial', 'Imperial', 50, 'cervezas-nacionales'],
  ['barena', 'Barena', 50, 'cervezas-nacionales'],
  ['michelob-ultra', 'Michelob Ultra', 65, 'cervezas-internacionales'],
  ['corona', 'Corona', 65, 'cervezas-internacionales'], ['coors-light', 'Coors Light', 65, 'cervezas-internacionales'],
  ['cubetazo-internacional', 'Cubetazo (Ultra, Coors, Corona)', 360, 'cervezas-internacionales'],
  ['miller-draft', 'Miller Draft', 65, 'cervezas-internacionales'],
  ['modelo-rubia', 'Modelo Rubia', 75, 'cervezas-internacionales'],
  ['paulaner', 'Paulaner', 100, 'cervezas-internacionales'],
  ['tequila-normal', 'Tequila normal', 80, 'tequila'], ['tequila-doble', 'Tequila doble', 150, 'tequila'],
  ['vodka-normal', 'Vodka normal', 80, 'vodka'], ['vodka-doble', 'Vodka doble', 150, 'vodka']
];
const products = rows.map(([id, name, price, category, description = '']) => ({ id, name, price, category, description, image: '', available: true, featured: false }));
assert.equal(products.length, 27);
assert.equal(new Set(products.map(p => p.id)).size, 27);
assert.equal(categories.length, 7);
for (const p of products) { assert.ok(categories.some(c => c.id === p.category)); assert.ok(Number.isInteger(p.price) && p.price > 0); }
// Independent per-category price checks against the supplied printed menu.
for (const [category, total] of Object.entries({ catracho: 1090, sodas: 160, naturales: 35, 'cervezas-nacionales': 420, 'cervezas-internacionales': 795, tequila: 230, vodka: 230 })) {
  assert.equal(products.filter(p => p.category === category).reduce((n, p) => n + p.price, 0), total);
}
if (process.argv.includes('--validate')) { console.log('27 products, 7 categories: content validation passed.'); process.exit(0); }

const service = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
assertInstance({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(service) });
assert.equal(service.project_id, 'el-chingadazo-cfe45');
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url'), seconds = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat: seconds, exp: seconds + 600 });
const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), service.private_key).toString('base64url');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
assert.ok(tokenResponse.ok, 'Authentication failed');
const token = (await tokenResponse.json()).access_token;
assert.ok(token);
const headers = { Authorization: 'Bearer ' + token }, base = instance.firebase.databaseURL.replace(/\/$/, '') + '/app';
async function read(path, etag = false) {
  const r = await fetch(base + path + '.json', { headers: { ...headers, ...(etag ? { 'X-Firebase-ETag': 'true' } : {}) } });
  assert.ok(r.ok, 'Read failed: ' + path);
  return { value: await r.json(), etag: r.headers.get('etag') };
}
const beforeProducts = (await read('/products')).value || {}, beforeCategories = (await read('/categories')).value || {};
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
for (const [existing, additions] of [[beforeProducts, products], [beforeCategories, categories]]) for (const item of additions) {
  if (existing[item.id]) assert.deepEqual(existing[item.id], item, 'Existing ID differs; abort: ' + item.id);
  assert.ok(!Object.values(existing).some(old => old.id !== item.id && normalized(old.name) === normalized(item.name)), 'Duplicate name: ' + item.name);
}
console.log(JSON.stringify({ previousProducts: Object.keys(beforeProducts).length, previousCategories: Object.keys(beforeCategories).length, additions: products.map(({ name, price }) => ({ name, price })) }));
if (!process.argv.includes('--apply')) { console.log('Read-only validation passed. No changes.'); process.exit(0); }
// Per-entry compare-and-set avoids overwriting concurrent menu edits.
for (const [node, entries] of [['categories', categories], ['products', products]]) for (const item of entries) {
  const path = '/' + node + '/' + item.id, current = await read(path, true);
  if (current.value !== null) { assert.deepEqual(current.value, item); continue; }
  assert.ok(current.etag);
  const r = await fetch(base + path + '.json', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', 'if-match': current.etag }, body: JSON.stringify(item) });
  assert.ok(r.ok, 'Create rejected: ' + path + ' HTTP ' + r.status);
}
for (const [node, entries, previous] of [['categories', categories, beforeCategories], ['products', products, beforeProducts]]) {
  const after = (await read('/' + node)).value;
  for (const item of entries) assert.deepEqual(after[item.id], item);
  for (const [id, item] of Object.entries(previous)) assert.deepEqual(after[id], item, 'Existing entry changed: ' + id);
}
console.log('Verified in Firebase: 27 added products and 7 categories; existing catalogue unchanged. No sales, tables, inventory, settings or deployments modified.');
