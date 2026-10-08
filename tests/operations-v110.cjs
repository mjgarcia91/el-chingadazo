const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('js/app.js'),worker=read('_worker.js'),access=read('server/access.js');
const styles=read('css/styles.css'),personal=read('personal.html'),manifest=JSON.parse(read('personal-manifest.json'));

// Clientes y personal tienen entradas independientes y nunca comparten modo.
assert.match(app,/const PERSONAL_PATH/);
assert.match(app,/const STAFF_DEVICE_MODE = PERSONAL_PATH/);
assert.doesNotMatch(app,/chingadazo_staff_mode/);
assert.doesNotMatch(app,/data-open-staff/);
assert.match(worker,/url\.pathname === "\/personal"/);
assert.match(worker,/personal\.html/);
assert.match(worker,/url\.searchParams\.has\("personal"\)/);
assert.equal(manifest.start_url,'/personal');
assert.equal(manifest.id,'/personal');
assert.match(personal,/Personal · El Chingadazo/);

// Caja concentra controles secundarios y deja dos colas operativas visibles.
assert.match(app,/⚙️ Configuración/);
assert.match(app,/Órdenes pendientes/);
assert.match(app,/Órdenes en proceso/);
assert.match(app,/data-fold="cashConfig"/);
assert.match(app,/data-fold="cashPending"/);
assert.match(app,/data-fold="cashProcess"/);
assert.match(styles,/\.pos-work-queues/);

// PIN automático, métricas del turno abierto y cierre sin falsos positivos.
assert.match(app,/STATE\.staffPin\.length===6/);
assert.doesNotMatch(app,/key==="ok"/);
assert.match(app,/Sin turno abierto/);
assert.match(app,/latest && !latest\.closedAt/);
assert.match(worker,/const open=latest&&!latest\.closedAt/);
assert.match(worker,/const sales=open\?/);
assert.match(access,/Ya tienes un turno abierto/);
assert.match(app,/\/api\/data\/shifts\//);

// Caché y recursos corresponden a esta entrega.
assert.match(read('sw.js'),/chingadazo-v131/);
assert.match(read('index.html'),/styles\.css\?v=118/);

(async()=>{
  const ctx=vm.createContext({Response,Request,URL,TextEncoder,crypto:require('node:crypto').webcrypto,fetch});
  ctx.createAccess=()=>({});ctx.createDelivery=()=>({});ctx.createFamily=()=>({});ctx.createPayerGame=()=>({});ctx.createChupisticaGame=()=>({});ctx.createPush=()=>({notifyCustomers:async()=>{}});ctx.createManager=()=>({recordSale:async()=>({})});
  Object.assign(ctx,await import('../server/shift-maintenance.js'),await import('../server/instance.js'));
  vm.runInContext(read('_worker.js').replace(/^(?:import .*\n)+/,'').replace('export default {','globalThis.worker={'),ctx);
  const routed=await ctx.worker.fetch(new Request('https://el-chingadazo.invalid/personal'),{ASSETS:{fetch:req=>new Response(new URL(req.url).pathname)}});
  assert.equal(await routed.text(),'/personal.html');
  const old=await ctx.worker.fetch(new Request('https://el-chingadazo.invalid/?personal=1'),{ASSETS:{fetch:()=>new Response('bad')}});
  assert.equal(old.status,308);assert.equal(old.headers.get('location'),'https://el-chingadazo.invalid/personal');
  console.log('PASS v110: Caja compacta, portal /personal aislado, PIN automático y turnos consistentes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
