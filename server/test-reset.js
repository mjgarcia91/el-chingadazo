// Administrator-only archival. Live records and their backup change in one Firebase CAS.
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const live=node=>Object.fromEntries(Object.entries(node||{}).filter(([,v])=>v&&!v.testArchivedAt));
const snapshot=root=>({orders:live(root.orders),shifts:live(root.shifts),deliveries:live(root.deliveries)});
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function blockers(root){
 const out=[];
 const open=Object.entries(live(root.shifts)).filter(([,s])=>!s.closedAt);
 if(open.length)out.push('Turnos todavía abiertos: '+open.map(([id,s])=>(s.userName||s.userId||'Sin usuario')+' · '+(s.openedAt||'sin fecha')+' · '+id).join('; ')+'. Revísalos en Turno y arqueo → Turnos pendientes de cierre.');
 if(root.settings?.open!==false)out.push('Marca el local como CERRADO desde Configuración antes de continuar.');
 return out;
}
export function createTestReset({db,mutateDb,identity,json,expireShifts=async()=>{}}){
 return {async handle(request,env){
  const actor=await identity(request,env);
  if(actor.role!=='admin')throw fail('Solo administración.',403);
  const url=new URL(request.url);
  if(request.method==='GET'&&url.searchParams.has('archive')){
   const id=url.searchParams.get('archive');
   if(!/^[a-z0-9-]{1,90}$/.test(id))throw fail('Respaldo inválido.',400);
   const saved=await db(env,'/operationArchives/'+id);
   if(!saved)throw fail('Respaldo inexistente.',404);
   return json(saved);
  }
  if(!['GET','POST'].includes(request.method))throw fail('Método no permitido.',405);
  await expireShifts();
  const root=await db(env,'')||{},data=snapshot(root),serialized=canonical(data),fingerprint=await digest(serialized);
  if(request.method==='GET')return json({fingerprint,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Object.keys(v).length])),blockers:blockers(root)});
  const input=await request.json();
  if(input.confirmation!=='ARCHIVAR PRUEBAS'||input.fingerprint!==fingerprint)throw fail('Los datos cambiaron. Obtén una vista previa nueva.');
  if(!Object.keys(data.orders).length&&!Object.keys(data.shifts).length)throw fail('No hay ventas ni turnos que archivar.');
  const id='reset-'+crypto.randomUUID(),at=new Date().toISOString();
  await mutateDb(env,'',current=>{
   if(!current||canonical(snapshot(current))!==serialized)throw fail('Los datos cambiaron. Obtén una vista previa nueva.');
   const reasons=blockers(current);if(reasons.length)throw fail(reasons.join(' '));
   const next=structuredClone(current);
   next.operationArchives={...(next.operationArchives||{}),[id]:{id,at,by:actor.id,...data}};
   for(const node of ['orders','shifts','deliveries'])for(const key of Object.keys(data[node])){
    next[node][key]={id:key,testArchivedAt:at,archiveId:id,...(node==='shifts'?{closedAt:at}:{status:node==='orders'?'cancelado':'cancelled'})};
   }
   next.settings={...next.settings,operationEpoch:id};
   return next;
  },5,true);
  return json({ok:true,archiveId:id,at});
 }};
}
