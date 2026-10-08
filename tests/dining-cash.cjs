const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<section id="cash"></section>',{url:'https://test.local',runScripts:'dangerously'}),w=dom.window;
 Object.assign(w,{structuredClone,confirm:()=>true,alert:()=>{},print:()=>{}});Object.defineProperty(w.navigator,'locks',{value:{request:async(_,opts,fn)=>fn({})}});
 w.eval(fs.readFileSync('js/dining-cash.js','utf8'));
 let ticket=[{productId:'p',name:'Taco',qty:1,unit:50}],context={},state={initialized:true,consumptionsEnabled:true,revision:1,zones:{},tables:{t:{id:'t',number:1,kind:'table',active:true,accountId:''}},accounts:{}},calls=[],lost=true;
 const options={user:{id:'cash',role:'cashier'},api:async(path,opts)=>{if(!opts)return structuredClone(state);const cmd=JSON.parse(opts.body);calls.push(cmd);state={...state,revision:2,tables:{t:{...state.tables.t,accountId:'a'}},accounts:{a:{id:'a',tableId:'t',status:'open',total:50,items:ticket}}};if(lost){lost=false;throw Error('Respuesta perdida')}return {...state,operationId:cmd.operationId}},getTicket:()=>ticket,getContext:()=>context,setContext:v=>{context=v},ready:()=>true,save:async()=>{},clear:async()=>{ticket=[]},changed:()=>{},getPayment:()=>({payment:'Efectivo',payWith:50,shiftId:'s'}),printSale:async()=>{}};
 const tick=()=>new Promise(r=>setTimeout(r,20));
 w.DiningCash.mount(w.document.querySelector('#cash'),options);await tick();await w.DiningCash.hold();await tick();
 w.document.querySelector('[data-cash-save]').click();await tick();assert.equal(ticket.length,1);assert(w.DiningCash.pending());
 w.document.querySelector('[data-cash-retry]').click();await tick();assert.equal(ticket.length,0);assert.equal(calls.length,2);assert.equal(calls[0].operationId,calls[1].operationId);assert(!w.DiningCash.pending());
 assert(w.document.body.textContent.includes('Mesa 1'));assert(w.document.body.textContent.includes('50.00'));
 w.DiningCash.stop();dom.window.close();console.log('PASS Caja wait-list: assign table, preserve on lost response, exact retry and clear only after confirmation.');
})().catch(e=>{console.error(e);process.exitCode=1});
