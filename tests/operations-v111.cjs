const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => value == null ? value : structuredClone(value);

const state = {
  roles: { admin: 'admin', cash: 'cashier', customer: 'customer' },
  users: { 'auth-admin': { id: 'auth-admin', name: 'Administración', role: 'admin', active: true } },
  orders: {}, shifts: {}, products: { torta: { id: 'torta', name: 'Torta', price: 100 } },
  suppliers: {}, ingredients: {}, recipes: {}, purchases: {}, inventoryMovements: {},
  managerIncidents: {}, managerDecisions: {}, managerAudit: {}, managerConversations: {}
};
const get = route => route.split('/').filter(Boolean).reduce((value, key) => value?.[key], state) ?? null;
const set = (route, value) => {
  const parts = route.split('/').filter(Boolean), last = parts.pop(); let node = state;
  for (const part of parts) node = node[part] ||= {};
  if (value === null) delete node[last]; else node[last] = clone(value);
};
const db = async (_env, route, init) => {
  if (init) set(route, init.method === 'DELETE' ? null : JSON.parse(init.body));
  return clone(get(route));
};
const mutateDb = async (_env, route, mutator) => { const next = mutator(clone(get(route))); set(route, next); return clone(next); };
const verifyFirebaseUser = async token => {
  if (!['admin', 'cash', 'customer'].includes(token)) throw Error('bad token');
  return { localId: token, emailVerified: true };
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const readBody = request => request.json();
const request = (token, method, route, body) => new Request('https://test.local' + route, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

(async () => {
  const { createManager } = await import('../server/manager.js');
  const manager = createManager({ db, mutateDb, verifyFirebaseUser, json, readBody });
  await assert.rejects(() => manager.overview(request('cash', 'GET', '/api/manager/overview'), {}, new URL('https://test.local/api/manager/overview')), error => error.status === 403, 'Caja no puede abrir el Gerente IA');

  let response = await manager.saveCost(request('admin', 'POST', '/api/manager/costs', { action: 'supplier_save', id: 'pollo-sa', name: 'Proveedor Pollo' }), {});
  assert.equal(response.status, 200);
  response = await manager.saveCost(request('admin', 'POST', '/api/manager/costs', { action: 'ingredient_save', id: 'pollo', name: 'Pollo', purchaseUnit: 'libra', consumptionUnit: 'libra', conversion: 1, currentCost: 10, currentQty: 10, minimumQty: 2, supplierId: 'pollo-sa' }), {});
  assert.equal(response.status, 200);
  response = await manager.saveCost(request('admin', 'POST', '/api/manager/costs', { action: 'recipe_save', id: 'torta', productId: 'torta', name: 'Torta', yieldQty: 1, ingredients: [{ ingredientId: 'pollo', qty: .2 }], packagingCost: 1 }), {});
  assert.equal(response.status, 200);
  response = await manager.saveCost(request('admin', 'POST', '/api/manager/costs', { action: 'purchase_save', id: 'factura-1', supplierId: 'pollo-sa', invoice: 'F-1', items: [{ ingredientId: 'pollo', qty: 10, unitCost: 10 }], tax: 0, transport: 0, discount: 0 }), {});
  assert.equal(response.status, 200);
  assert.equal(state.purchases['factura-1'].total, 100);
  assert.equal(state.ingredients.pollo.currentQty, 20);

  const now = new Date(), day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = Date.parse(day + 'T06:00:00.000Z');
  state.orders.o1 = { id: 'o1', status: 'entregado', invoiced: true, paidAt: new Date(start + 12 * 3600000).toISOString(), total: 200, items: [{ productId: 'torta', name: 'Torta', qty: 2, unit: 100 }] };
  let consumption = await manager.recordSale({}, state.orders.o1);
  assert.equal(consumption.movementCount, 1);
  assert.equal(state.ingredients.pollo.currentQty, 19.6);
  consumption = await manager.recordSale({}, state.orders.o1);
  assert.equal(consumption.duplicate, true, 'El consumo de una venta es idempotente');
  state.inventoryMovements.opening = { id: 'opening', ingredientId: 'pollo', kind: 'count', qty: 10, unitCost: 10, occurredAt: new Date(start - 1000).toISOString() };
  state.inventoryMovements.closing = { id: 'closing', ingredientId: 'pollo', kind: 'count', qty: 5, unitCost: 10, occurredAt: new Date(start + 20 * 3600000).toISOString() };
  response = await manager.overview(request('admin', 'GET', '/api/manager/overview'), {}, new URL('https://test.local/api/manager/overview?day=' + day));
  assert.equal(response.status, 200);
  const overview = await response.json();
  assert.equal(overview.configured, false);
  assert.equal(overview.cost.salesNet, 200);
  assert.equal(overview.cost.theoreticalCost, 6);
  assert.equal(overview.cost.actualCost, 150);
  assert.equal(overview.cost.dataQuality, 'confirmed');
  assert.equal(overview.trends.week.days, 7);

  response = await manager.ask(request('admin', 'POST', '/api/manager/ask', { question: '¿Cuánto vendimos?', day }), {});
  assert.equal(response.status, 503, 'Sin clave la IA se desactiva sin afectar operaciones');
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.match(options.headers.Authorization, /^Bearer /);
    const sent = JSON.parse(options.body);
    assert.equal(sent.store, false);
    assert.doesNotMatch(sent.instructions, /PIN|contraseña de cliente/i);
    return new Response(JSON.stringify({ output: [{ content: [{ text: 'Análisis seguro basado en datos confirmados.' }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  response = await manager.ask(request('admin', 'POST', '/api/manager/ask', { question: 'Analiza la utilidad', day }), { OPENAI_API_KEY: 'test-secret', OPENAI_MODEL: 'test-model' });
  global.fetch = originalFetch;
  assert.equal(response.status, 200);
  assert.match((await response.json()).answer, /Análisis seguro/);

  response = await manager.telemetry(request('customer', 'POST', '/api/manager/telemetry', { type: 'error', message: 'Botón sin responder', area: 'Clientes', route: '/menu', version: '111' }), {});
  assert.equal(response.status, 200);
  assert.equal(Object.values(state.managerIncidents).length, 1);
  response = await manager.decision(request('admin', 'POST', '/api/manager/decision', { id: 'missing-recipes', status: 'approved' }), {});
  assert.equal(response.status, 200);
  assert.equal(state.managerDecisions['missing-recipes'].status, 'approved');

  const app = read('js/app.js'), worker = read('_worker.js'), styles = read('css/styles.css'), sw = read('sw.js');
  for (const marker of ['viewAdminManager', 'viewAdminCosts', 'viewAdminSystem', '/api/manager/ask', 'managerSupplierForm', 'managerRecipeForm', 'reportClientIncident']) assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const marker of ['createManager', '/api/manager/overview', '/api/manager/costs', '/api/manager/telemetry']) assert.match(worker, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(styles, /manager-cost-layout/);
  assert.match(sw, /chingadazo-v131/);
  assert.doesNotMatch(app, /OPENAI_API_KEY\s*=/);
  console.log('PASS v111: Gerente IA aislado, costos reales/teóricos, proveedores, inventario, telemetría, auditoría y autorización administrativa.');
})().catch(error => { console.error(error); process.exitCode = 1; });
