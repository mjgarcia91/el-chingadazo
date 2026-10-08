// Honduras is UTC-06 year round. Close at the first 23:00 after opening.
export function shiftEnd(s){
 const opened=Date.parse(s?.openedAt);if(!Number.isFinite(opened))return NaN;
 const local=new Date(opened-6*3600000);
 let end=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+1,5);
 if(end<=opened)end+=86400000;
 return end;
}
export function shiftExpired(s,now=Date.now()){
 return !!(s&&!s.closedAt&&!s.testArchivedAt&&shiftEnd(s)<=now);
}
export function createShiftMaintenance({db,mutateDb}){
 return {async expire(env,now=Date.now()){
  const shifts=await db(env,'/shifts')||{};
  const due=Object.entries(shifts).filter(([,s])=>shiftExpired(s,now));
  if(!due.length)return {closed:0};
  const orders=Object.values(await db(env,'/orders')||{});let closed=0;
  await mutateDb(env,'/shifts',current=>{
   closed=0;const next={...current};
   for(const [id] of due){
    const s=current?.[id];if(!shiftExpired(s,now))continue;
    const from=Date.parse(s.openedAt),to=shiftEnd(s);
    const sales=orders.filter(o=>o&&!o.testArchivedAt&&o.status!=='cancelado'&&!o.cancelledAt&&o.paidAt&&Date.parse(o.paidAt)>=from&&Date.parse(o.paidAt)<to&&(o.shiftId===id||(!o.shiftId&&o.paidBy===s.userId)));
    const sum=p=>Math.round(sales.filter(o=>o.payment===p).reduce((a,o)=>a+Math.round(Number(o.total||0)*100),0))/100;
    const cash=sum('Efectivo'),card=sum('Tarjeta'),transfer=sum('Transferencia');
    closed++;
    next[id]={...s,closedAt:new Date(to).toISOString(),autoClosed:true,closeReason:'daily_23_hn',closedBy:'system',autoClosedProcessedAt:new Date(now).toISOString(),counted:null,diff:null,arqueoPending:true,expected:Math.round((Number(s.fondo||0)+cash)*100)/100,n:sales.length,cash,card,transfer,sales:Math.round((cash+card+transfer)*100)/100,emailStatus:'not_requested',note:[s.note,'Turno cerrado automáticamente a las 11:00 p. m. (Honduras). Arqueo pendiente.'].filter(Boolean).join('\n')};
   }
   return next;
  });
  return {closed};
 }};
}
