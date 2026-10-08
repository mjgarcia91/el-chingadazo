const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
(async()=>{
 const {shiftEnd,shiftExpired,createShiftMaintenance}=await import('../server/shift-maintenance.js');
 const now=Date.parse('2026-09-25T05:00:00Z'); // September 24, 23:00 Honduras.
 const opening='2026-09-24T16:00:00Z'; // 10:00 Honduras, only 13 hours earlier.
 assert.equal(shiftEnd({openedAt:opening}),now);assert(!shiftExpired({openedAt:opening},now-1));assert(shiftExpired({openedAt:opening},now));
 assert.equal(shiftEnd({openedAt:'2026-12-31T16:00:00Z'}),Date.parse('2027-01-01T05:00:00Z'));
 assert(!shiftExpired({openedAt:'invalid'},now));assert(!shiftExpired({openedAt:opening,closedAt:'done'},now));
 let state={settings:{open:false},shifts:{old:{id:'old',userId:'cash',userName:'Caja antigua',openedAt:opening,fondo:50},closed:{id:'closed',openedAt:opening,closedAt:'manual',counted:99},fresh:{id:'fresh',openedAt:'2026-09-25T16:00:00Z'},invalid:{id:'invalid',userName:'Sin fecha'}},orders:{a:{id:'a',shiftId:'old',paidBy:'cash',paidAt:'2026-09-24T17:00:00Z',payment:'Efectivo',total:100},other:{id:'other',shiftId:'another',paidBy:'cash',paidAt:'2026-09-24T17:00:00Z',payment:'Efectivo',total:999},card:{id:'card',shiftId:'old',paidAt:'2026-09-24T18:00:00Z',payment:'Tarjeta',total:80},late:{id:'late',shiftId:'old',paidAt:'2026-09-25T05:00:00Z',payment:'Efectivo',total:700}}};
 let writes=0,concurrent=false;
 const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state);
 const db=async(e,p)=>structuredClone(get(p));
 const mutateDb=async(e,p,fn)=>{if(concurrent){state.shifts.old.closedAt='manual-won';state.shifts.old.counted=42;}const result=fn(structuredClone(get(p)));assert.equal(p,'/shifts');state.shifts=result;writes++;return structuredClone(result)};
 const maintenance=createShiftMaintenance({db,mutateDb});
 assert.equal((await maintenance.expire({},now-1)).closed,0);assert.equal(writes,0);
 assert.equal((await maintenance.expire({},now)).closed,1);assert.equal(state.shifts.old.closedAt,'2026-09-25T05:00:00.000Z');assert.equal(state.shifts.old.expected,150);assert.equal(state.shifts.old.sales,180);assert.equal(state.shifts.old.counted,null);assert.equal(state.shifts.old.diff,null);assert(state.shifts.old.arqueoPending);assert(state.shifts.old.autoClosed);assert.equal(state.shifts.closed.counted,99);assert(!state.shifts.invalid.closedAt);assert(!state.shifts.fresh.closedAt);
 assert.equal((await maintenance.expire({},now)).closed,0);
 state.shifts.old.closedAt='';concurrent=true;assert.equal((await maintenance.expire({},now)).closed,0);assert.equal(state.shifts.old.counted,42);concurrent=false;
 const {createTestReset}=await import('../server/test-reset.js');
 state.shifts.old.closedAt='';delete state.shifts.fresh;
 const reset=createTestReset({db,mutateDb,identity:async()=>({role:'admin'}),json:x=>new Response(JSON.stringify(x)),expireShifts:()=>maintenance.expire({},now)});
 const preview=await (await reset.handle(new Request('https://test/api/test-reset'),{})).json();assert(state.shifts.old.closedAt);assert(preview.blockers.some(x=>x.includes('Sin fecha')&&x.includes('invalid')));
 // The older open shift must remain visible even if a newer one is closed.
 const app=read('js/app.js'),ctx=vm.createContext({currentUser:()=>({id:'cash'}),Store:{get:()=>({shifts:[{id:'new',userId:'cash',openedAt:'2026-09-24',closedAt:'closed'},{id:'old',userId:'cash',openedAt:'2026-09-23'}]})}});
 vm.runInContext(app.slice(app.indexOf('function myOpenShift()'),app.indexOf('function shiftOrders(')),ctx);assert.equal(ctx.myOpenShift().id,'old');
 // Solo respaldo diario; no activar el cierre programado de turnos.
 assert.deepEqual(JSON.parse(read('wrangler.jsonc')).triggers.crons,['0 9 * * *','*/5 * * * *']);assert.match(read('_worker.js'),/async scheduled/);
 assert.match(app,/data-admin-close-shift/);assert.match(app,/Arqueo pendiente/);assert.match(read('js/ops.js'),/CERRADO AUTOMÁTICAMENTE/);
 // Exercise the real reconciliation handler: owner/admin only, closure date retained, no second count overwrite.
 const worker=read('_worker.js');
 state.shifts.review={id:'review',userId:'cash',openedAt:opening,closedAt:'2026-09-25T05:00:00.000Z',autoClosed:true,arqueoPending:true,expected:150};
 const closeContext=vm.createContext({Response,Date,Number,JSON,Math,encodeURIComponent,
  requireStaff:async r=>({actor:r.headers.get('who'),role:r.headers.get('who')==='admin'?'admin':'cashier'}),body:r=>r.json(),json:(o,status=200)=>new Response(JSON.stringify(o),{status}),db,
  mutateDb:async(e,p,fn)=>{const id=p.split('/').pop();const next=fn(structuredClone(state.shifts[id]));state.shifts[id]=next;return next;}
 });
 vm.runInContext(worker.slice(worker.indexOf('async function closeShiftSecure('),worker.indexOf('async function retryShiftEmail(')),closeContext);
 const close=(who,counted)=>closeContext.closeShiftSecure(new Request('https://test/api/close-shift',{method:'POST',headers:{who},body:JSON.stringify({shiftId:'review',counted})}),{});
 assert.equal((await close('another',20)).status,409);
 assert.equal((await close('admin',20)).status,200);assert.equal(state.shifts.review.diff,-130);assert.equal(state.shifts.review.closedAt,'2026-09-25T05:00:00.000Z');assert.equal(state.shifts.review.autoClosed,true);assert.equal(state.shifts.review.arqueoPending,false);
 await close('cash',99);assert.equal(state.shifts.review.counted,20);
 console.log('PASS daily shift closure: 23:00 Honduras, 13-hour shift, year rollover, duplicate invocation, manual-close race, explicit shift totals, pending reconciliation, malformed record diagnosis and older hidden shift.');
})().catch(e=>{console.error(e);process.exitCode=1});
