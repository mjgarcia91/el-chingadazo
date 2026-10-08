const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.js','utf8');
(async()=>{
 let events=[], failPrepare=false, failSend=false, failConfirm=false, orders=[];
 const state={posTicket:[{productId:'p',qty:2,unit:55}],posName:'',posPay:'Efectivo',posPayWith:110,posChannel:'mostrador'};
 const ctx=vm.createContext({STATE:state,navigator:{onLine:true},ChingadazoContinuity:{},STAFF_DEVICE_MODE:true,localReady:true,localSignature:'saved',localWork:Promise.resolve(),localAccount:{prepare:async()=>{events.push('prepare');if(failPrepare)throw Error('disk full')},confirm:async()=>{events.push('confirm');if(failConfirm)throw Error('disk full')}},
   myOpenShift:()=>({id:'shift'}),currentUser:()=>({id:'cash'}),Store:{uid:()=> 'stable-order',get:()=>({orders})},posSubtotal:()=>110,pointsEarned:()=>10,autoPrintEnabled:()=>false,confirm:()=>true,ensureCustomer:()=>null,
   Cloud:{pushOrder:async order=>{events.push('send');orders=[structuredClone(order)];if(failSend)throw Error('response lost');return true}},render:()=>{},go:()=>{},alert:()=>{},opensDrawer:()=>false,printTicket:()=>{events.push('print')},localDraft:()=>({}),localAccountMessage:()=>{},managerApi:async()=>orders[0]});
 vm.runInContext(app.slice(app.indexOf('function posResultMatches('),app.indexOf('\nfunction myDeskOrders')),ctx);
 ctx.navigator.onLine=false;await ctx.sellPosTicket();assert.deepEqual(events,[]);assert.equal(state.posTicket.length,1);
 ctx.navigator.onLine=true;failPrepare=true;await ctx.sellPosTicket();assert.deepEqual(events,['prepare']);assert(!state.pendingPosOrder);assert.equal(state.posTicket.length,1);
 events=[];failPrepare=false;failSend=true;await ctx.sellPosTicket();assert.deepEqual(events,['prepare','send']);assert(state.pendingPosOrder);const exact=JSON.stringify(state.pendingPosOrder);
 events=[];failConfirm=true;await ctx.sellPosTicket();assert.deepEqual(events,['confirm']);assert.equal(JSON.stringify(state.pendingPosOrder),exact);
 events=[];failConfirm=false;await ctx.sellPosTicket();assert.deepEqual(events,['confirm']);assert.equal(state.posTicket.length,0);assert.equal(state.pendingPosOrder,null);
 console.log('PASS continuity send: offline blocked; disk-full never sends; lost response consults original ID; failed local confirmation retains intent; no duplicate send.');
})().catch(error=>{console.error(error);process.exitCode=1;});
