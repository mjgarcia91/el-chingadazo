const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
(async()=>{
 const app=read('js/app.js'),worker=read('_worker.js');let role='cashier',opened=0;
 const ctx=vm.createContext({Number,currentUser:()=>({role}),window:{ChingadazoPrinter:{drawer:async()=>opened++}},reportClientIncident:()=>{},alert:()=>{},paymentMoney:n=>String(n)});
 vm.runInContext(app.slice(app.indexOf('function opensDrawer('),app.indexOf('const collectingOrders')),ctx);
 for(const r of ['cashier','admin','kitchen','customer'])for(const payment of ['Efectivo','Tarjeta','Transferencia'])for(const amount of [100,150]){
  role=r;opened=0;await ctx.openCashDrawer({payment,total:100,payWith:amount});
  assert.equal(opened,payment==='Efectivo'&&(r==='admin'||r==='cashier'&&amount>100)?1:0,`${r}/${payment}/${amount}`);
 }
 let settings={waitMin:25,deliveryEnabled:true,taxRate:15};
 const api=vm.createContext({Number,String,JSON,body:r=>r.json(),json:(o,status=200)=>new Response(JSON.stringify(o),{status}),requireStaff:async(r,e,allowed)=>{const role=r.headers.get('role');if(!allowed.includes(role))throw Object.assign(Error('No autorizado'),{status:403});return {role};},db:async(e,p,init)=>{assert.equal(p,'/settings/waitMin');settings.waitMin=JSON.parse(init.body);}});
 vm.runInContext(worker.slice(worker.indexOf('async function operationalSettings('),worker.indexOf('function shiftEmailHtml(')),api);
 const call=(role,minutes)=>api.operationalSettings(new Request('https://test/api/operations/settings',{method:'POST',headers:{role},body:JSON.stringify({action:'preparation',minutes,deliveryEnabled:false,taxRate:0})}),{});
 for(const role of ['customer','kitchen','anonymous'])await assert.rejects(()=>call(role,30),e=>e.status===403);
 for(const value of [0,-1,241,1.5,'30',null])assert.equal((await call('cashier',value)).status,400);
 for(const role of ['cashier','admin']){assert.equal((await call(role,35)).status,200);assert.equal(settings.waitMin,35);assert.equal(settings.taxRate,15);assert.equal(settings.deliveryEnabled,true);}
 const manual=app.slice(app.indexOf('  if(e.target.closest("#testDrawer"))'),app.indexOf('  if(e.target.closest("#toggleAutoPrint"))'));
 assert.match(manual,/if\(!canAdmin\(\)\)return/);
 console.log('PASS caja settings: cashier drawer only for change, admin test guard, no card/transfer opening, preparation permissions and bounded integer validation without changing other settings. Hardware mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
