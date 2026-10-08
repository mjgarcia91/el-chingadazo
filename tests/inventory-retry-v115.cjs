const assert=require('node:assert/strict');
(async()=>{
 const {createManager}=await import('../server/manager.js');
 let state={orders:{o:{id:'o',invoiced:true,total:100,paidAt:new Date().toISOString(),items:[{productId:'p',qty:2}]}},recipes:{r:{id:'r',productId:'p',yieldQty:1,ingredients:[{ingredientId:'i',qty:3}]}},ingredients:{i:{id:'i',currentQty:100,currentCost:2}},inventoryConsumption:{},inventoryMovements:{}};
 const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state);
 const set=(p,v)=>{const keys=p.split('/').filter(Boolean),last=keys.pop();let n=state;for(const k of keys)n=n[k]||={};n[last]=structuredClone(v)};
 let fail=true;
 const manager=createManager({db:async(e,p,init)=>{if(init){if(p.startsWith('/inventoryMovements/')&&fail)throw Error('network interrupted after balance write');set(p,JSON.parse(init.body))}return structuredClone(get(p))},mutateDb:async(e,p,fn)=>{const v=fn(structuredClone(get(p)));set(p,v);return structuredClone(v)}});
 await assert.rejects(()=>manager.recordSale({},state.orders.o),/interrupted/);
 assert.equal(state.ingredients.i.currentQty,94);assert.equal(Object.keys(state.inventoryMovements).length,0);
 state.inventoryConsumption.o.processingAt='2020-01-01T00:00:00Z';state.recipes.r.ingredients[0].qty=20;fail=false;
 await manager.recordSale({},state.orders.o);assert.equal(state.ingredients.i.currentQty,94);assert.equal(Object.values(state.inventoryMovements)[0].qty,6);assert.equal(state.inventoryConsumption.o.status,'recorded');
 await manager.recordSale({},state.orders.o);assert.equal(state.ingredients.i.currentQty,94);assert.equal(Object.keys(state.inventoryMovements).length,1);
 state.inventoryConsumption.o={status:'processing',processingAt:'2020-01-01T00:00:00Z'};
 const legacy=await manager.recordSale({},state.orders.o);assert.equal(legacy.needsReview,true);assert.equal(state.ingredients.i.currentQty,94);
 state.orders.o.testArchivedAt='now';assert.equal((await manager.recordSale({},state.orders.o)).recorded,false);
 console.log('PASS inventory: interrupted index write, retry without double deduction, saved recipe plan, legacy partial records require review, archived sales skipped.');
})().catch(e=>{console.error(e);process.exitCode=1});
