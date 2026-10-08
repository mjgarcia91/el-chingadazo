const assert=require('node:assert/strict');
(async()=>{
 const {createDining}=await import('../server/dining.js');let state=null,actor={id:'admin',role:'admin'},seq=0;
 const service=createDining({db:async()=>structuredClone(state),mutateDb:async(_,path,fn)=>{state=fn(structuredClone(state));return structuredClone(state)},identity:async()=>actor,json:x=>new Response(JSON.stringify(x)),consumptionsEnabled:true,quoteItems:async(_,items)=>items.map(i=>({...i,name:'Taco'}))});
 const call=async(action,fields={})=>(await service.handle(new Request('https://test.local/api/dining',{method:'POST',body:JSON.stringify({action,operationId:'op-'+(++seq),expectedRevision:state?.revision||0,...fields})}),{})).json();
 await call('initialize');await call('consume',{tableId:'table-3',items:[{productId:'taco',qty:1,unit:50}]});
 const id=state.tables['table-3'].accountId,batchId=Object.keys(state.accounts[id].batches)[0];
 actor={id:'cook',role:'kitchen'};
 const read=async()=>(await service.handle(new Request('https://test.local/api/dining/kitchen'),{})).json();
 const result=await read();assert.equal(result.batches.length,1);assert(!result.accounts);assert(!result.operations);assert(!('unit' in result.batches[0].items[0]));
 await assert.rejects(call('batchStatus',{accountId:id,batchId,status:'listo'}),e=>e.status===409);
 await call('batchStatus',{accountId:id,batchId,status:'preparacion'});await call('batchStatus',{accountId:id,batchId,status:'listo'});
 await assert.rejects(call('consume',{tableId:'table-3',accountId:id,items:[{productId:'taco',qty:1,unit:50}]}),e=>e.status===403);
 await assert.rejects(call('batchStatus',{accountId:id,batchId,status:'servido'}),e=>e.status===403);
 actor={id:'admin',role:'admin'};await call('transfer',{accountId:id,destinationTableId:'table-4'});
 assert.equal((await read()).batches[0].tableNumber,4,'Kitchen sees the current delivery table after transfer');
 await call('batchStatus',{accountId:id,batchId,status:'servido'});assert.equal((await read()).batches.length,0);assert.equal(state.accounts[id].total,50);
 console.log('PASS dining kitchen: incremental queue, private fields omitted, ordered transitions, current destination and no financial effect.');
})().catch(e=>{console.error(e);process.exitCode=1});
