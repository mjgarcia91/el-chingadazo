// Execute the actual Worker router with a local static-assets binding.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','public');
(async()=>{
 await require('./fixtures/configure-instance.cjs')();
 const {default:worker}=await import('../_worker.js');
 const env={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'chingadazo-test'}),ASSETS:{fetch:async request=>{
  const p=new URL(request.url).pathname,file=path.join(root,p);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:fs.readFileSync(file));
 }}};
 const call=(p,init={})=>worker.fetch(new Request('https://test.local'+p,init),env,{});
 for(const p of ['/','/personal','/personal/','/delivery','/delivery/','/informacion.html']){const r=await call(p);assert.equal(r.status,200,p);assert.equal(r.headers.get('Location'),null,p);}
 const info=await(await call('/informacion.html')).text();assert.match(info,/El Chingadazo/);assert.match(info,/todavía|Todavía/);
 for(const p of ['/server/updates-v112.js','/tests/updates-v112.cjs','/wrangler.jsonc','/package.json','/firebase-rules.production.json'])assert.equal((await call(p)).status,404,p);
 for(const p of ['/api/data/orders','/api/data/users','/api/data/shifts','/api/instagram-stories'])assert.equal((await call(p)).status,401,p);
 assert.equal((await call('/api/staff-manage',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:'{}'})).status,403);
 const old=await call('/?personal');assert.equal(old.status,308);assert.equal(old.headers.get('Location'),'https://test.local/personal');
 console.log('PASS router Worker: home, personal, delivery, políticas públicas, sin bucles, privados 401, internos 404 y origen cruzado 403.');
})().catch(e=>{console.error(e);process.exitCode=1;});
