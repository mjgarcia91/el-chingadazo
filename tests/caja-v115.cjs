const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const code=app.slice(app.indexOf('async function sellPosTicket('),app.indexOf('\nfunction myDeskOrders'));
let events=[],orders=[],release,fail=false,printerFail=false;
const state={posTicket:[{productId:'p',name:'Torta',unit:100,qty:1}],posName:'',posPay:'Efectivo',posPayWith:100,posChannel:'mostrador'};
const ctx=vm.createContext({STATE:state,Date,Number,Error,Store:{uid:()=> 'order-one',get:()=>({orders})},myOpenShift:()=>({id:'shift'}),currentUser:()=>({id:'cash',role:'admin'}),opensDrawer:o=>o.payment==='Efectivo',posSubtotal:()=>100,pointsEarned:()=>10,confirm:()=>true,alert:m=>events.push(['alert',m]),go:()=>{},render:()=>{},autoPrintEnabled:()=>true,ensureCustomer:()=>null,
 Cloud:{pushOrder:async o=>{events.push(['push',structuredClone(o)]);if(fail)throw Error('offline');await new Promise(r=>release=r);orders=[{...structuredClone(o),code:'TT-SERVER',total:100}];return true;},sync:async()=>{throw Error('unnecessary network');}},
 openCashDrawer:async o=>events.push(['drawer',o.code]),printTicket:async(o,k)=>{events.push(['print',o.code,k]);if(printerFail)throw Error('impresora desconectada');}
});vm.runInContext(code,ctx);
(async()=>{
 let first=ctx.sellPosTicket(true);await ctx.sellPosTicket(true);assert.equal(events.filter(e=>e[0]==='push').length,1);assert(state.posSending);release();await first;
 assert.equal(events.filter(e=>e[0]==='drawer').length,1);assert.deepEqual(events.filter(e=>e[0]==='print').map(e=>e[1]),['TT-SERVER','TT-SERVER']);assert.equal(state.posTicket.length,0);assert(!state.posSending);
 state.posTicket=[{productId:'p',qty:1,unit:100}];state.posPayWith=100;fail=true;events=[];await ctx.sellPosTicket(true);assert.equal(state.posTicket.length,1);assert(state.pendingPosOrder);assert(!events.some(e=>e[0]==='print'));const request=JSON.stringify(state.pendingPosOrder);
 fail=false;printerFail=true;first=ctx.sellPosTicket(true);assert.equal(JSON.stringify(state.pendingPosOrder),request);release();await first;assert.equal(state.posTicket.length,0);assert(!state.pendingPosOrder);assert(events.some(e=>e[0]==='alert'&&e[1].includes('No vuelvas a cobrar')));
 printerFail=false;state.posPay='Tarjeta';state.posTicket=[{productId:'p',qty:1,unit:100}];events=[];first=ctx.sellPosTicket(false);release();await first;assert(!events.some(e=>['drawer','print'].includes(e[0])));
 console.log('PASS caja: concurrent click, authoritative receipt code, immutable retry, failed printer preserves committed sale, card/no-print. Hardware mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
