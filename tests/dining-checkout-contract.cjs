const assert=require('node:assert/strict');
(async()=>{
 const {createDining}=await import('../server/dining.js');
 let state={schemaVersion:1,revision:1,zones:{},tables:{t:{id:'t',accountId:'a'}},accounts:{a:{id:'a',tableId:'t',status:'open',revision:1,total:100,items:[{productId:'p',qty:1,unit:100}]}},operations:{}},order=null;
 const actor={id:'cash',role:'cashier'};
 const service=createDining({db:async(_,path)=>path.startsWith('/orders/')?order:structuredClone(state),mutateDb:async(_,path,fn)=>{state=fn(structuredClone(state));return state},identity:async()=>actor,json:x=>x});
 await service.reserve({},actor,{accountId:'a',orderId:'o',expectedRevision:1,operationId:'reserve'});assert.equal(state.accounts.a.status,'checkout');
 await service.reserve({},actor,{accountId:'a',orderId:'o',expectedRevision:1,operationId:'reserve'});assert.equal(state.revision,2);
 await assert.rejects(service.complete({},actor,{accountId:'a',orderId:'o'}),e=>e.status===409);
 order={id:'o',diningAccountId:'wrong',paidAt:'yes',invoiced:true,total:100};await assert.rejects(service.complete({},actor,{accountId:'a',orderId:'o'}),e=>e.status===409);
 order.diningAccountId='a';order.items=[{productId:'p',qty:1,unit:100}];await service.complete({},actor,{accountId:'a',orderId:'o'});assert.equal(state.tables.t.accountId,'');assert.equal(state.accounts.a.status,'closed');
 await service.complete({},actor,{accountId:'a',orderId:'o'});assert.equal(state.revision,3);
 console.log('PASS dining checkout boundary: reservation replay, no browser proof, verified same-account sale, idempotent release. Not connected to cashier UI.');
})().catch(e=>{console.error(e);process.exitCode=1});
