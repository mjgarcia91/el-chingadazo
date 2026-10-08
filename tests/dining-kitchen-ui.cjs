const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<section></section>',{url:'https://test.local',runScripts:'outside-only'}),w=dom.window;
 w.navigator.locks={request:async(_,options,fn)=>fn({})};w.eval(fs.readFileSync('js/dining-kitchen.js','utf8'));
 const state={consumptionsEnabled:true,revision:1,batches:[{id:'batch-one',accountId:'account-one',tableNumber:3,tableKind:'table',status:'nuevo',createdAt:new Date().toISOString(),items:[{name:'Taco <script>',qty:2,note:'Sin cebolla'}]}]};let calls=0;
 w.DiningKitchen.mount(w.document.querySelector('section'),{user:{id:'cook'},isActive:()=>true,api:async(_,options)=>{
  if(options){const cmd=JSON.parse(options.body);calls++;assert.equal(cmd.status,'preparacion');state.batches[0].status='preparacion';state.revision++;return {...state,operationId:cmd.operationId};}return structuredClone(state);
 }});
 await new Promise(r=>setTimeout(r,10));assert.match(w.document.body.textContent,/Mesa 3/);assert(!w.document.querySelector('script'));w.document.querySelector('[data-kitchen-batch]').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(calls,1);assert.match(w.document.body.textContent,/Marcar lista/);assert.equal(w.localStorage.length,0);w.DiningKitchen.stop();w.close();
 console.log('PASS dining kitchen UI: table and incremental items, safe text, confirmed prepare action and pending cleanup.');
})().catch(e=>{console.error(e);process.exit(1)});
