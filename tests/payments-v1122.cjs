const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
let order,inputs,confirms,events,applied=true,fail=false,delay;
const ctx=vm.createContext({Set,Number,Math,console,money:n=>'L. '+Number(n).toFixed(2),currentUser:()=>({role:'cashier'}),myOpenShift:()=>({id:'shift'}),Store:{get:()=>({orders:[order]})},confirm:m=>{events.push(['confirm',m]);return confirms.length?confirms.shift():true},prompt:()=>inputs.shift(),alert:m=>events.push(['alert',m]),go:()=>{},render:()=>{},reportClientIncident:()=>{},printTicket:async(o,k)=>events.push(['print',k]),applyOrderStatus:async()=>{},window:{ChingadazoPrinter:{automatic:()=>true,drawer:async()=>events.push(['drawer'])}},Cloud:{invoiceOrder:async(id,data)=>{events.push(['invoice',data]);if(delay)await delay;if(fail)throw new Error('offline');return {...order,...data,invoiced:true,__transactionApplied:applied};},syncOrders:async()=>{}}});
vm.runInContext(app.slice(app.indexOf('function paymentMoney('),app.indexOf('function posSubtotal(')),ctx);
async function run(payment,received,total=100,extra={}){order={id:'x',total,payment,type:'pickup',needsChange:false,...extra};inputs=[received];confirms=[true,true,false];events=[];applied=true;fail=false;await ctx.collectPendingOrder('x',null,true);return events;}
(async()=>{
 for(const [payment,received,draw]of [['Efectivo','100',0],['Efectivo','200',1],['Efectivo','100.50',1],['Tarjeta',null,0],['Transferencia',null,0]]){
 const e=await run(payment,received);assert.equal(e.filter(x=>x[0]==='drawer').length,draw);assert.equal(e.filter(x=>x[0]==='print').length,1);assert(e.findIndex(x=>x[0]==='invoice')<e.findIndex(x=>x[0]==='print'));if(draw)assert.equal(e.find(x=>x[0]==='invoice')[1].payWith,Number(received));
 }
 for(const bad of [null,'','abc','Infinity','99','-1']){const e=await run('Efectivo',bad);assert(!e.some(x=>['invoice','print','drawer'].includes(x[0])),String(bad));}
 await run('Efectivo','100');events=[];inputs=['100'];confirms=[true,true];applied=false;await ctx.collectPendingOrder('x',null,true);assert(!events.some(x=>['print','drawer'].includes(x[0])));
 events=[];inputs=['100'];confirms=[true,true];applied=true;fail=true;await ctx.collectPendingOrder('x',null,true);assert(!events.some(x=>['print','drawer'].includes(x[0])));
 fail=false;events=[];confirms=[false];await ctx.collectPendingOrder('x',null,true);assert(!events.some(x=>x[0]==='invoice'));
 await run('Efectivo','150',100,{type:'delivery'});assert(events.some(x=>x[0]==='confirm'&&x[1].includes('repartidor')));
 events=[];inputs=['100'];confirms=[true,true,false];let release;delay=new Promise(r=>release=r);const first=ctx.collectPendingOrder('x',null,true);await ctx.collectPendingOrder('x',null,true);release();await first;delay=null;assert.equal(events.filter(x=>x[0]==='invoice').length,1);
 events=[];inputs=['100'];confirms=[true,true,false];await ctx.collectPendingOrder('x',null,false);assert.equal(events.filter(x=>x[0]==='drawer').length,0);assert(!events.some(x=>x[0]==='print'));
 console.log('PASS cash exact/change, card, transfer, invalid/canceled tender, duplicate, failed invoice, driver confirmation, concurrent click and no-print choice. Printer hardware mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
