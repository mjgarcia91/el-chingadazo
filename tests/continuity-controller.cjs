const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 await import('../js/continuity.js');
 const accounts=new Map();let actor='one',fail=false;
 const client=ChingadazoContinuity.create({storage:{read:async key=>accounts.get(key)||null,write:async(key,value)=>{if(fail)throw Error('quota');accounts.set(key,structuredClone(value))}},locks:{request:async(key,opts,callback)=>callback({name:key})}});
 const state={posTicket:[],posName:'',posPay:'Efectivo',posPayWith:'',posChannel:'mostrador'},status={textContent:''};
 const ctx=vm.createContext({STATE:state,STAFF_DEVICE_MODE:true,ChingadazoContinuity:{...ChingadazoContinuity,create:()=>client},structuredClone,canCash:()=>!!actor,currentUser:()=>({id:actor}),document:{getElementById:()=>status},render:()=>{}});
 const app=fs.readFileSync('js/app.js','utf8');vm.runInContext(app.slice(app.indexOf('let localAccount ='),app.indexOf('function storedCart()')),ctx);
 const settle=()=>vm.runInContext('localWork',ctx);
 ctx.syncLocalAccount();await settle();
 state.posTicket=[{productId:'p',qty:2,unit:55,note:'Sin chile'}];ctx.syncLocalAccount();await settle();assert.match(status.textContent,/guardados/);
 actor='two';ctx.syncLocalAccount();assert.equal(state.posTicket.length,0);await settle();assert.equal(state.posTicket.length,0);
 actor='one';ctx.syncLocalAccount();await settle();assert.equal(state.posTicket[0].qty,2);
 fail=true;state.posTicket[0].qty=3;ctx.syncLocalAccount();await settle();assert.match(status.textContent,/No se pudo guardar/);assert.equal(vm.runInContext('localSignature',ctx),'');assert.equal(accounts.get('el-chingadazo-cfe45:one').posTicket[0].qty,2);
 fail=false;ctx.syncLocalAccount();await settle();assert.equal(accounts.get('el-chingadazo-cfe45:one').posTicket[0].qty,3);
 actor='';ctx.syncLocalAccount();await settle();assert.equal(state.posTicket.length,0);assert.equal(accounts.get('el-chingadazo-cfe45:one').posTicket[0].qty,3);
 console.log('PASS continuity controller: autosave, operator isolation, write failure visible, retry and logout preserve data.');
})().catch(error=>{console.error(error);process.exitCode=1;});
