const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
(async () => {
  const { instance, assertInstance } = await import('../server/instance.js');
  instance.configured = false; // Explicit preview fixture, independent of deploy configuration.
  const { default: worker } = await import('../_worker.js');
  let networkCalls = 0;
  global.fetch = async () => { networkCalls++; throw new Error('Unexpected network call'); };
  const env = {FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'app-tipicos-el-trapiche'})};
  for (const path of ['/api/data/orders','/api/data/settings','/api/staff-authorize','/api/push-test','/api/delivery/admin']) {
    const response = await worker.fetch(new Request('https://preview.test'+path),env);
    assert.equal(response.status,503,path);
  }
  await worker.scheduled({cron:'0 5 * * *'},env);
  assert.equal(networkCalls,0,'Preview never accesses any backend');
  await require('./fixtures/configure-instance.cjs')();
  assert.throws(()=>assertInstance(env),/no corresponde/);
  const own={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'chingadazo-test'})};
  assert.equal(assertInstance(own).project_id,'chingadazo-test');
  instance.firebase.databaseURL='https://app-tipicos-el-trapiche-default-rtdb.firebaseio.com';
  assert.throws(()=>assertInstance(own),/otro restaurante/);
  instance.firebase.databaseURL='https://unrelated-default-rtdb.firebaseio.com';
  assert.throws(()=>assertInstance(own),/no corresponde/);
  const ctx={};vm.runInNewContext(fs.readFileSync('js/data.js','utf8')+';globalThis.seed={settings:SEED_SETTINGS,products:SEED_PRODUCTS,users:SEED_USERS};',ctx);
  assert.equal(ctx.seed.products.length,26);assert.equal(ctx.seed.users.length,0);
  assert.equal(ctx.seed.settings.open,false);assert.equal(ctx.seed.settings.deliveryEnabled,false);
  assert.equal(ctx.seed.settings.restaurantLat,null);
  const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
  assert.equal(config.name,'el-chingadazo');assert.deepEqual(config.routes,[]);
  assert.equal(config.r2_buckets[0].bucket_name,'el-chingadazo-private-documents');
  const auth={window:{}};vm.runInNewContext(fs.readFileSync('js/instance-config.js','utf8'),auth);auth.CHINGADAZO_CONFIG.configured=false;vm.runInNewContext(fs.readFileSync('js/auth.js','utf8'),auth);
  assert.equal(await auth.window.AuthBridge.current(),null);
  await assert.rejects(auth.window.AuthBridge.signInGoogle(),/preparación/);
  console.log('PASS isolation: preview makes no backend requests; foreign accounts/databases rejected; independent deploy target; empty restaurant data.');
})().catch(e=>{console.error(e);process.exitCode=1});
