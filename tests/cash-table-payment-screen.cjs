const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<section id="cash"></section>',{url:'https://test.local',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{structuredClone});Object.defineProperty(w.navigator,'locks',{value:{request:async(_,opts,fn)=>fn({})}});
 w.eval(fs.readFileSync('js/dining-cash.js','utf8'));
 const host=w.document.querySelector('#cash'),tick=()=>new Promise(r=>setTimeout(r,20));
 let pane='sale',ticket=[],calls=[],printed=[],lost=true;
 const state={revision:1,consumptionsEnabled:true,tables:{t:{id:'t',number:1,kind:'table'}},accounts:{a:{id:'a',tableId:'t',status:'open',total:50,items:[{name:'Taco',qty:1,unit:50}]}}};
 w.DiningCash.mount(host,{user:{id:'u'},fullScreen:true,onPayment:v=>pane=v?'payment':'waiting',onWaiting:()=>pane='waiting',getContext:()=>({posDiningAccountId:'a'}),getTicket:()=>ticket,ready:()=>true,save:async()=>{},getPayment:()=>({shiftId:'s'}),changed:()=>{},printSale:async(_,choice)=>printed.push(choice),api:async(_,opts)=>{if(!opts)return structuredClone(state);const c=JSON.parse(opts.body);calls.push(c);if(lost){lost=false;throw Error('Respuesta perdida')}const r=structuredClone(state);r.accounts.a.status='paid';r.accounts.a.checkout={sale:{id:'sale'}};return {...r,operationId:c.operationId}}});
 await tick();
 w.DiningCash.startPayment();await tick();assert.equal(pane,'payment');assert.equal(calls.length,0);
 host.querySelector('[data-cash-cancel-payment]').click();assert.equal(pane,'waiting');assert.equal(calls.length,0);
 ticket=[{name:'Otro'}];w.DiningCash.startPayment();assert.equal(pane,'waiting','Unsent products cannot be skipped');ticket=[];
 w.DiningCash.startPayment();host.querySelector('[data-cash-exact]').click();assert.match(host.querySelector('#diningChange').textContent,/0.00/);
 host.querySelector('[data-cash-confirm="no"]').click();await tick();assert(w.DiningCash.pending());assert.equal(calls.length,1);
 host.querySelector('[data-cash-retry]').click();await tick();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(printed[0],false);
 w.DiningCash.stop();dom.window.close();console.log('PASS table payment screen: cancel without write, guard new items, change, printing choice and exact retry.');
})().catch(e=>{console.error(e);process.exit(1)});
