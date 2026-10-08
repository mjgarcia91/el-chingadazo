const assert=require('node:assert/strict');
(async()=>{
 const {createDining}=await import('../server/dining.js');let state=null,version=0;
 const service=createDining({consumptionsEnabled:true,quoteItems:async(_,items)=>items.map(i=>({...i,name:'Synthetic'})),db:async()=>structuredClone(state),mutateDb:async(_,path,fn)=>{
  for(let i=0;i<5;i++){const expected=version,current=structuredClone(state);await Promise.resolve();const next=fn(current);await Promise.resolve();if(version!==expected)continue;state=next;version++;return structuredClone(state)}throw Error('CAS contention');
 },identity:async r=>({id:r.headers.get('actor')||'admin',role:'admin'}),json:x=>new Response(JSON.stringify(x))});
 const call=(body,actor='admin')=>service.handle(new Request('https://test.local/api/dining',{method:'POST',headers:{actor},body:JSON.stringify(body)}),{});
 await call({action:'initialize',operationId:'init',expectedRevision:0});
 const revision=state.revision;
 const results=await Promise.allSettled(['one','two'].map(operationId=>call({action:'open',tableId:'table-1',operationId,expectedRevision:revision},operationId)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.keys(state.accounts).length,1);assert.equal(Object.values(state.tables).filter(t=>t.accountId).length,1);
 const id=state.tables['table-1'].accountId,rev=state.revision;
 const transfers=await Promise.allSettled(['table-2','table-3'].map(destinationTableId=>call({action:'transfer',accountId:id,destinationTableId,operationId:'move-'+destinationTableId,expectedRevision:rev})));
 assert.equal(transfers.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.values(state.tables).filter(t=>t.accountId===id).length,1);assert.equal(state.tables['table-1'].accountId,'');
 const account=state.accounts[id];account.items=[{productId:'p',qty:1,unit:1}];account.total=1;
 await assert.rejects(call({action:'cancelEmpty',accountId:id,operationId:'bad-close',expectedRevision:state.revision}),e=>e.status===409);
 await assert.rejects(call({action:'open',tableId:'__proto__',operationId:'bad-key',expectedRevision:state.revision}),e=>e.status===400);
 const firstItems=[{productId:'p',qty:1,unit:50}],consumeRevision=state.revision;
 const consumes=await Promise.allSettled(['consume-a','consume-b'].map(operationId=>call({action:'consume',tableId:'table-5',items:firstItems,operationId,expectedRevision:consumeRevision})));
 assert.equal(consumes.filter(r=>r.status==='fulfilled').length,1,'Only one concurrent first consumption wins');
 const diningAccount=state.accounts[state.tables['table-5'].accountId];assert.equal(diningAccount.total,50);assert.equal(Object.keys(diningAccount.batches).length,1);
 const same={action:'consume',tableId:'table-5',accountId:diningAccount.id,items:firstItems,operationId:'same-consume',expectedRevision:state.revision};
 await Promise.all([call(same),call(same)]);assert.equal(state.accounts[diningAccount.id].total,100);assert.equal(Object.keys(state.accounts[diningAccount.id].batches).length,2,'Concurrent retry cannot append twice');
 const {createSnapshot,verifySnapshot}=await import('../server/backups.js');const restored=await verifySnapshot(await createSnapshot({dining:state}));assert.deepEqual(restored.dining,state);
 console.log('PASS dining CAS: one concurrent opener, one destination, no orphan account, no close with consumptions, unsafe key rejected, verified backup roundtrip.');
})().catch(e=>{console.error(e);process.exitCode=1});
