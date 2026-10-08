const assert=require('node:assert/strict');
(async()=>{
 const {createAccess}=await import('../server/access.js');
 const data={products:{p:{id:'p',name:'Prueba',price:55}},settings:{},users:{cash:{id:'cash'}},shifts:{shift:{id:'shift',userId:'cash'}},orders:{}};
 const read=path=>path.split('/').filter(Boolean).reduce((node,key)=>node?.[key],data)||null;
 let effects=0, simulateRace=false;
 const access=createAccess({db:async(_,path)=>structuredClone(read(path)),mutateDb:async(_,path,fn)=>{
   const id=path.split('/').at(-1);
   if(simulateRace){fn(null);return fn(structuredClone(data.orders[id]));}
   const result=fn(structuredClone(read(path)));data.orders[id]=structuredClone(result);return result;
 },onOrderCreated:async()=>{effects++}});
 const actor={id:'cash',role:'cashier'},input={items:[{productId:'p',qty:2}],total:110,payment:'Efectivo',payWith:110,paidAt:'yes',shiftId:'shift',userId:'cash'};
 await access.createOrder({},actor,'same',input);assert.equal(effects,1);
 await access.createOrder({},actor,'same',input);assert.equal(effects,1);
 await assert.rejects(access.createOrder({},actor,'same',{...input,payment:'Tarjeta'}),error=>error.status===409);
 simulateRace=true;await access.createOrder({},actor,'same',input);assert.equal(effects,1,'CAS retry must not repeat creation effects');
 console.log('PASS continuity server: same ID is idempotent; different payment rejected; CAS retry does not repeat order-created effects.');
})().catch(error=>{console.error(error);process.exitCode=1;});
