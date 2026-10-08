const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
(async()=>{
 let confirmed=0,sent=0,readResult,shift={id:'s'},alerts=[];
 const pending={id:'order',paidBy:'cash',shiftId:'s',total:110,items:[{productId:'p',qty:2,unit:55,note:'Sin chile'}]};
 const context=vm.createContext({STATE:{pendingPosOrder:structuredClone(pending)},managerApi:async()=>readResult,myOpenShift:()=>shift,currentUser:()=>({id:'cash'}),Cloud:{pushOrder:async()=>{sent++;return true}},Store:{get:()=>({orders:[{...pending,paidAt:'confirmed'}]})},localAccount:{confirm:async id=>{assert.equal(id,'order');confirmed++}},localSignature:'',localDraft:()=>({}),localAccountMessage:()=>{},render:()=>{},alert:m=>alerts.push(m),console});
 vm.runInContext(app.slice(app.indexOf('function posResultMatches('),app.indexOf('async function sellPosTicket(')),context);
 readResult={...pending,paidAt:'confirmed'};await context.recoverPendingPos();assert.equal(sent,0);assert.equal(confirmed,1);assert.equal(context.STATE.pendingPosOrder,null);
 context.STATE.pendingPosOrder=structuredClone(pending);readResult=null;shift=null;
 await context.recoverPendingPos();assert.equal(sent,0);assert(context.STATE.pendingPosOrder);
 shift={id:'s'};await context.recoverPendingPos();assert.equal(sent,1);assert.equal(confirmed,2);
 context.STATE.pendingPosOrder=structuredClone(pending);readResult={...pending,total:200,paidAt:'confirmed'};
 await context.recoverPendingPos();assert.equal(confirmed,2);assert(context.STATE.pendingPosOrder);
 for(const mismatch of [{payment:'Tarjeta'},{payWith:999},{userId:'other'},{items:[{...pending.items[0],mods:{salsa:'extra'}}]}]){
   readResult={...pending,paidAt:'confirmed',...mismatch};await context.recoverPendingPos();assert.equal(confirmed,2);assert(context.STATE.pendingPosOrder);
 }
 console.log('PASS recovery: server-confirmed response never resends, missing order keeps same intent, wrong shift/conflicting totals retain pending.');
})().catch(e=>{console.error(e);process.exitCode=1;});
