const assert=require('node:assert/strict');
(async()=>{
 const {createManager}=await import('../server/manager.js');
 let marker;const sale={id:'sale',paidAt:'2026-10-03T04:00:00Z',invoiced:true,items:[{productId:'without-recipe',qty:1}]};
 const persist=value=>{const copy=structuredClone(value);if(Array.isArray(copy.plan)&&!copy.plan.length)delete copy.plan;return copy;};
 const service=createManager({db:async(_,p)=>p.startsWith('/orders/')?sale:p.startsWith('/inventoryConsumption/')?marker:null,mutateDb:async(_,p,fn)=>{marker=persist(fn(marker));return structuredClone(marker);}});
 assert.equal((await service.recordSale({},sale)).recorded,true);assert.equal(marker.movementCount,0);assert.equal(marker.status,'recorded');
 assert.equal((await service.recordSale({},sale)).duplicate,true);
 console.log('PASS empty inventory plan survives database omission of empty arrays');
})().catch(e=>{console.error(e);process.exitCode=1});
