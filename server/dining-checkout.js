// A durable salon reservation owns the sale. Projection may safely resume after a crash.
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})};
const key=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
export function createDiningCheckout({db,mutateDb,isShiftExpired,recordSale}){
 async function project(env,account){
  const sale=account.checkout?.sale;if(!sale)fail('Reserva sin comprobante; requiere revisión.');
  const order=await mutateDb(env,'/orders/'+sale.id,old=>{
   if(old&&(old.diningAccountId!==account.id||JSON.stringify(old.items)!==JSON.stringify(sale.items)||old.total!==sale.total||old.testArchivedAt||old.cancelledAt||old.status==='cancelado'||!old.invoiced||!old.paidAt))fail('La venta requiere revisión; no vuelvas a cobrar.');
   return old||sale;
  },5,true);
  let inventoryPending=true;
  try{
   const inventory=await recordSale(env,order);
   inventoryPending=!inventory?.recorded;
   if(inventoryPending)inventoryPending=!(await db(env,'/inventoryConsumption/'+sale.id))?.recordedAt;
  }catch{ /* Keep inventory reconciliation pending; the sale above is already durable. */ }
  return mutateDb(env,'/dining',state=>{
   const a=state?.accounts?.[account.id];
   if(['paid','closed'].includes(a?.status)&&a.orderId===sale.id){
    if(a.inventoryPending!==inventoryPending){a.inventoryPending=inventoryPending;a.revision++;state.revision++;}
    return state;
   }
   if(a?.status!=='checkout'||a.checkout?.sale?.id!==sale.id)fail('La reserva requiere revisión.');
   a.status='paid';a.orderId=sale.id;a.paidAt=sale.paidAt;a.inventoryPending=inventoryPending;a.revision++;state.revision++;
   a.history||=[];a.history.push({action:'paid',orderId:sale.id,at:sale.paidAt,by:sale.paidBy});
   return state;
  },5,true);
 }
 async function run(env,actor,input){
  if(!['admin','cashier'].includes(actor?.role))fail('Solo Caja o Administración pueden cobrar.',403);
  if(!key(input.accountId)||!key(input.operationId)||input.operationId.length>80||!key(input.shiftId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail('Cobro inválido.',400);
  if(!['Efectivo','Tarjeta','Transferencia'].includes(input.payment)||!Number.isFinite(input.payWith)||input.payWith<0)fail('Pago inválido.',400);
  const fingerprint=JSON.stringify([actor.id,input.accountId,input.operationId,input.expectedRevision,input.shiftId,input.payment,input.payWith]);
  const previous=(await db(env,'/dining'))?.accounts?.[input.accountId];
  if(previous?.checkout){
   if(previous.checkout.fingerprint!==fingerprint)fail('Esta cuenta ya tiene un cobro. Actualiza y consulta su resultado; no vuelvas a cobrar.',previous.checkout.sale?.revision===input.operationId?409:412);
   if(previous.status==='paid')return;
   return project(env,previous);
  }
  const shift=await db(env,'/shifts/'+input.shiftId);
  if(!shift||shift.closedAt||isShiftExpired(shift)||shift.userId!==actor.id)fail('Abre tu propio turno antes de cobrar.',412);
  const now=new Date().toISOString();
  const state=await mutateDb(env,'/dining',state=>{
   const a=state?.accounts?.[input.accountId];
   if(a?.checkout){if(a.checkout.fingerprint!==fingerprint)fail('Ya existe un cobro para esta cuenta.',a.checkout.sale?.revision===input.operationId?409:412);return state;}
   if(state?.revision!==input.expectedRevision||a?.status!=='open'||!a.items?.length||!(a.total>0)||state.tables[a.tableId]?.accountId!==a.id)fail('La cuenta cambió. Actualiza antes de cobrar.',412);
   if(input.payment==='Efectivo'&&input.payWith<a.total)fail('El efectivo no cubre el total.',400);
   const table=state.tables[a.tableId],id='dining-'+a.id;
   const sale={id,code:'CH-M-'+id.slice(-8).toUpperCase(),diningAccountId:a.id,tableId:table.id,customerName:(table.kind==='bar'?'Barra ':'Mesa ')+table.number,
    userId:actor.id,source:'caja',channel:'mesa',type:'dinein',status:'facturada',items:structuredClone(a.items),subtotal:a.total,total:a.total,tax:0,deliveryFee:0,tip:0,redeemValue:0,pointsEarned:0,
    payment:input.payment,payWith:input.payment==='Efectivo'?input.payWith:0,paymentChannel:input.payment==='Efectivo'?'cash':input.payment==='Tarjeta'?'pos':'transfer',
    needsChange:input.payment==='Efectivo'&&input.payWith>a.total,changeGiven:input.payment==='Efectivo'?input.payWith-a.total:0,cashReceivedFrom:input.payment==='Efectivo'?'customer':'',
    paidAt:now,paidBy:actor.id,invoiced:true,invoicedAt:now,invoicedBy:actor.id,shiftId:input.shiftId,createdAt:now,updatedAt:now,revision:input.operationId};
   a.checkout={fingerprint,sale,orderId:id,by:actor.id};a.status='checkout';a.revision++;state.revision++;
   return state;
  },5,true);
  return project(env,state.accounts[input.accountId]);
 }
 async function reconcile(env){
  const accounts=Object.values((await db(env,'/dining'))?.accounts||{}).filter(a=>(a.status==='checkout'||a.inventoryPending)&&a.checkout?.sale).sort((a,b)=>(b.status==='checkout')-(a.status==='checkout'));
  const results=await Promise.allSettled(accounts.slice(0,20).map(a=>project(env,a)));
  if(results.some(r=>r.status==='rejected'))fail('Hay cobros de mesas pendientes de conciliación.',503);
 }
 return {run,reconcile};
}
