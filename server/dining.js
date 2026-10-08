// All salon mutations share one CAS boundary; never emit effects inside its callback.
import {flattenLayout,initialLayout} from './dining-layout.js';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const key = value => typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const own = (object,id) => Object.hasOwn(object||{},id) ? object[id] : null;
const label = value => { if(typeof value!=='string' || !value.trim() || value.length>60 || /[<>]/.test(value))fail('Nombre inválido.');return value.trim(); };
function initial() {
  return initialLayout();
}
function view(state) {
  if(!state)return {initialized:false,revision:0,zones:{},tables:{},accounts:{}};
  if(state.schemaVersion!==1)fail('Versión del salón no compatible; no se modificó.',409);
  return {initialized:true,layoutVersion:state.layoutVersion||1,revision:state.revision,zones:state.zones,tables:state.tables,accounts:Object.fromEntries(Object.entries(state.accounts||{}).filter(([,a])=>['open','checkout'].includes(a.status)||(a.status==='paid'&&state.tables[a.tableId]?.accountId===a.id)))};
}
function normalize(input) {
  if(!input || typeof input!=='object' || !key(input.operationId) || input.operationId.length>80 || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision<0)fail('Operación o revisión inválida.');
  const command={action:input.action,operationId:input.operationId,expectedRevision:input.expectedRevision};
  if(!['initialize','flattenSalon','saveTable','saveZone','open','transfer','cancelEmpty','consume','batchStatus','release'].includes(input.action))fail('Acción no permitida.');
  for(const field of ({release:['accountId'],saveTable:['tableId'],saveZone:['zoneId'],open:['tableId'],transfer:['accountId','destinationTableId'],cancelEmpty:['accountId'],consume:['tableId'],batchStatus:['accountId','batchId']}[input.action]||[])) { if(!key(input[field]))fail('Identificador inválido.');command[field]=input[field]; }
  if(input.action==='batchStatus'){
    if(!['preparacion','listo','servido'].includes(input.status))fail('Estado de cocina inválido.');command.status=input.status;
  }
  if(input.action==='consume'){
    if(input.accountId && !key(input.accountId))fail('Cuenta inválida.');
    command.accountId=input.accountId||'';
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>50)fail('Pedido inválido.');
    command.items=input.items.map(item=>{
      if(!item||!key(item.productId)||!Number.isInteger(item.qty)||item.qty<1||item.qty>50||!Number.isFinite(item.unit)||item.unit<0)fail('Producto, cantidad o precio inválido.');
      if(item.mods!=null&&(typeof item.mods!=='object'||Array.isArray(item.mods)))fail('Opciones inválidas.');
      const mods={};
      for(const id of Object.keys(item.mods||{}).sort()){
        const choice=item.mods[id];if(!key(id)||!(Array.isArray(choice)?choice.length<=50&&choice.every(key):key(choice)))fail('Opciones inválidas.');
        mods[id]=Array.isArray(choice)?[...choice].sort():choice;
      }
      if(item.note!=null&&(typeof item.note!=='string'||item.note.length>500))fail('Nota inválida.');
      return {productId:item.productId,qty:item.qty,unit:item.unit,mods,note:item.note||''};
    });
  }
  if(input.action==='saveZone')command.name=label(input.name);
  if(input.action==='saveTable'){
    const t=input.table;
    if(!t || !key(t.zoneId) || !['table','bar'].includes(t.kind) || !Number.isInteger(t.number) || t.number<1 || t.number>999 || !Number.isInteger(t.row) || t.row<1 || t.row>50 || !Number.isInteger(t.column) || t.column<1 || t.column>4 || typeof t.active!=='boolean')fail('Revisa número, zona y posición (fila 1–50, columna 1–4).');
    command.table={zoneId:t.zoneId,kind:t.kind,number:t.number,row:t.row,column:t.column,active:t.active,temporary:t.temporary===true};
  }
  return command;
}
export function createDining({db,mutateDb,identity,json,quoteItems,checkout,consumptionsEnabled=false}) {
  const responseView=state=>({...view(state),consumptionsEnabled});
  function kitchenView(state){
    const batches=[];
    for(const account of Object.values(state?.accounts||{}))for(const batch of Object.values(account.batches||{})){
      if(batch.status==='servido')continue;
      const table=state.tables[account.tableId];
      batches.push({id:batch.id,accountId:account.id,tableId:table.id,tableNumber:table.number,tableKind:table.kind,status:batch.status,createdAt:batch.createdAt,revision:batch.revision,items:batch.items.map(({name,qty,modsText,note})=>({name,qty,modsText:modsText||'',note:note||''}))});
    }
    return {consumptionsEnabled,revision:state?.revision||0,batches:batches.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))};
  }
  async function handle(request,env) {
    const actor=await identity(request,env);
    if(!actor)fail('Inicia sesión.',401);
    if(!['admin','cashier','kitchen'].includes(actor.role))fail('No tienes permiso para administrar mesas.',403);
    const kitchen=new URL(request.url).pathname.endsWith('/kitchen');
    if(request.method==='GET'){
      if(kitchen)return json(kitchenView(await db(env,'/dining')));
      if(actor.role==='kitchen')fail('Cocina solo puede consultar comandas.',403);
      return json(responseView(await db(env,'/dining')));
    }
    if(request.method!=='POST')fail('Método no permitido.',405);
    if(Number(request.headers.get('content-length')||0)>12000)fail('Solicitud demasiado grande.',413);
    const reader=request.body?.getReader(),decoder=new TextDecoder();let raw='',bytes=0;
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>12000){await reader.cancel();fail('Solicitud demasiado grande.',413);}raw+=decoder.decode(value,{stream:true});}
    raw+=decoder.decode();
    let input;try{input=JSON.parse(raw)}catch{fail('Solicitud inválida.')}
    if(input?.action==='checkout'){
      if(!consumptionsEnabled||!checkout)fail('Cobro de mesas no habilitado.',409);
      await checkout.run(env,actor,input);
      return json({...responseView(await db(env,'/dining')),operationId:input.operationId});
    }
    const command=normalize(input),admin=actor.role==='admin';
    if(actor.role==='kitchen'&&(command.action!=='batchStatus'||command.status==='servido'))fail('Cocina solo puede preparar y marcar listo.',403);
    if(command.action==='batchStatus'&&!consumptionsEnabled)fail('Comandas no habilitadas.',409);
    if(['initialize','flattenSalon','saveTable','saveZone','cancelEmpty'].includes(command.action)&&!admin)fail('Solo administración puede hacer este cambio.',403);
    const fingerprint=JSON.stringify([actor.id,command]),now=new Date().toISOString();
    let pricedItems=null;
    if(command.action==='consume'){
      if(!consumptionsEnabled||!quoteItems)fail('Los consumos de mesas todavía no están habilitados.',409);
      // An accepted retry must remain valid even if the menu changes afterward.
      const previous=own((await db(env,'/dining'))?.operations,command.operationId);
      if(previous){if(previous.fingerprint!==fingerprint)fail('Este identificador pertenece a otra operación.',409);return json({...responseView(await db(env,'/dining')),operationId:command.operationId});}
      pricedItems=await quoteItems(env,command.items);
      if(pricedItems.some((item,index)=>Math.abs(item.unit-command.items[index].unit)>0.001))fail('El precio cambió. Revisa el pedido antes de enviarlo.',409);
    }
    const result=await mutateDb(env,'/dining',current=>{
      const state=current || (command.action==='initialize'?initial():null);
      if(!state)fail('Administración debe preparar el salón.',409);
      view(state);
      state.operations ||= {};state.accounts ||= {};
      const previous=own(state.operations,command.operationId);
      if(previous){if(previous.fingerprint!==fingerprint)fail('Este identificador pertenece a otra operación.',409);return state;}
      if(command.action!=='initialize' && state.revision!==command.expectedRevision)fail('El salón cambió en otro dispositivo. Actualiza y revisa antes de repetir.',409);
      const table=own(state.tables,command.tableId),account=own(state.accounts,command.accountId);
      switch(command.action){
        case 'release': {
          if(account?.status!=='paid'||!account.orderId)fail('Solo se libera una mesa pagada, sin saldo pendiente.',409);
          const source=own(state.tables,account.tableId);
          if(!source||source.accountId!==account.id)fail('La ocupación cambió.',409);
          source.accountId='';account.status='closed';account.closedAt=now;account.closedBy=actor.id;account.revision++;break;
        }
        case 'batchStatus': {
          const batch=own(account?.batches,command.batchId);
          if(!batch)fail('Comanda inexistente.',404);
          const next={nuevo:'preparacion',preparacion:'listo',listo:'servido'}[batch.status];
          if(command.status!==next)fail('La comanda cambió; revisa su estado.',409);
          batch.status=command.status;batch.revision++;batch.updatedAt=now;batch.updatedBy=actor.id;
          account.history.push({action:'batchStatus',batchId:batch.id,status:batch.status,at:now,by:actor.id});break;
        }
        case 'consume': {
          if(!table?.active)fail('Mesa no disponible.',409);
          if((table.accountId||'')!==command.accountId)fail('La cuenta de la mesa cambió. Actualiza antes de enviar.',409);
          if(table.accountId&&!account)fail('La cuenta requiere revisión; no se reemplazó.',409);
          let target=account;
          if(!target||target.status==='paid'){
            const id='account-'+command.operationId;
            target={id,tableId:table.id,status:'open',revision:0,openedAt:now,openedBy:actor.id,total:0,items:[],history:[{action:'open',tableId:table.id,number:table.number,kind:table.kind,at:now,by:actor.id}]};
            state.accounts[id]=target;table.accountId=id;
          }
          if(target.status!=='open'||target.tableId!==table.id)fail('Cuenta no disponible para consumos.',409);
          if((target.items||[]).length+pricedItems.length>200)fail('La cuenta requiere revisión: demasiadas líneas.',409);
          const batchId='batch-'+command.operationId;
          const lines=pricedItems.map((item,index)=>({...item,lineId:batchId+'-'+index,batchId}));
          target.items=[...(target.items||[]),...lines];
          target.total=Math.round(target.items.reduce((sum,item)=>sum+Math.round(item.unit*100)*item.qty,0))/100;
          target.batches||={};target.batches[batchId]={id:batchId,accountId:target.id,tableId:table.id,tableNumber:table.number,tableKind:table.kind,items:lines,status:'nuevo',createdAt:now,createdBy:actor.id,revision:1};
          target.revision++;target.history.push({action:'consume',batchId,at:now,by:actor.id});break;
        }
        case 'initialize': break; // Initialization never resets an existing salon.
        case 'flattenSalon': flattenLayout(state);break;
        case 'saveZone':
          if(state.layoutVersion===2)fail('El salón ahora es único. Actualiza la aplicación.',409);
          if(!own(state.zones,command.zoneId)&&Object.keys(state.zones).length>=20)fail('Límite de zonas alcanzado.',409);
          state.zones[command.zoneId]={id:command.zoneId,name:command.name};break;
        case 'saveTable': {
          const next=command.table;
          if(state.layoutVersion===2&&(next.kind!=='table'||next.zoneId!=='salon'||next.temporary))fail('Solo se permiten mesas numeradas en el salón único. Actualiza la aplicación.',409);
          if(!own(state.zones,next.zoneId))fail('Zona inexistente.',404);
          if(table?.accountId && !next.active)fail('No puedes desactivar una mesa ocupada.',409);
          if(!table&&Object.keys(state.tables).length>=200)fail('Límite de mesas alcanzado.',409);
          if(Object.values(state.tables).some(t=>t.id!==command.tableId && t.kind===next.kind && t.number===next.number))fail('Ese número ya existe.',409);
          if(next.active&&Object.values(state.tables).some(t=>t.id!==command.tableId&&t.active&&t.zoneId===next.zoneId&&t.row===next.row&&t.column===next.column))fail('Esa posición del plano ya está ocupada.',409);
          state.tables[command.tableId]={...next,id:command.tableId,accountId:table?.accountId||''};break;
        }
        case 'open': {
          if(!table?.active)fail('Mesa no disponible.',409);
          if(table.accountId)fail('La mesa ya tiene una cuenta.',409);
          const id='account-'+command.operationId;
          state.accounts[id]={id,tableId:table.id,status:'open',revision:1,openedAt:now,openedBy:actor.id,total:0,items:[],history:[{action:'open',tableId:table.id,number:table.number,kind:table.kind,at:now,by:actor.id}]};table.accountId=id;break;
        }
        case 'transfer': {
          const destination=own(state.tables,command.destinationTableId);
          if(!account || account.status!=='open')fail('Cuenta no disponible para traslado.',409);
          const source=own(state.tables,account.tableId);
          if(!source||source.accountId!==account.id)fail('La cuenta requiere revisión.',409);
          if(!destination?.active||destination.accountId)fail('El destino no está libre.',409);
          source.accountId='';destination.accountId=account.id;account.tableId=destination.id;account.revision++;
          account.history.push({action:'transfer',from:source.id,tableId:destination.id,number:destination.number,kind:destination.kind,at:now,by:actor.id});break;
        }
        case 'cancelEmpty': {
          if(!account || account.status!=='open' || (account.items||[]).length || Number(account.total)!==0 || account.orderId || account.checkout)fail('Solo puede cerrarse una cuenta vacía, sin cobros ni consumos.',409);
          const source=own(state.tables,account.tableId);if(!source||source.accountId!==account.id)fail('La cuenta requiere revisión.',409);
          source.accountId='';account.status='cancelled';account.closedAt=now;account.closedBy=actor.id;account.revision++;break;
        }
      }
      state.revision++;state.updatedAt=now;
      state.operations[command.operationId]={fingerprint,by:actor.id,at:now,revision:state.revision};
      if(new TextEncoder().encode(JSON.stringify(state)).length>4*1024*1024)fail('El historial del salón necesita archivo supervisado; no se borró información.',409);
      return state;
    },5,true);
    return json({...((kitchen||actor.role==='kitchen')?kitchenView(result):responseView(result)),operationId:command.operationId});
  }
  // Server-only boundary for the future cashier integration. Not routed to HTTP.
  async function reserve(env,actor,input) {
    if(!['admin','cashier'].includes(actor?.role))fail('Acceso no autorizado.',403);
    if(!key(input.accountId)||!key(input.orderId)||!key(input.operationId)||!Number.isSafeInteger(input.expectedRevision))fail('Reserva inválida.');
    const fingerprint=JSON.stringify([actor.id,input.accountId,input.orderId,input.expectedRevision]);
    return mutateDb(env,'/dining',state=>{
      if(!state)fail('Salón inexistente.',409);
      state.operations ||= {};
      const previous=own(state.operations,input.operationId);
      if(previous){if(previous.fingerprint!==fingerprint)fail('Identificador reutilizado.',409);return state;}
      const account=own(state.accounts,input.accountId);
      if(state.revision!==input.expectedRevision || account?.status!=='open' || !account.items?.length || !(account.total>0))fail('Cuenta no disponible para cobro.',409);
      account.status='checkout';account.checkout={orderId:input.orderId,by:actor.id};account.revision++;state.revision++;
      state.operations[input.operationId]={fingerprint,by:actor.id,at:new Date().toISOString(),revision:state.revision};return state;
    });
  }
  async function complete(env,actor,input) {
    if(!['admin','cashier'].includes(actor?.role))fail('Acceso no autorizado.',403);
    if(!key(input.accountId)||!key(input.orderId))fail('Confirmación inválida.');
    const order=await db(env,'/orders/'+input.orderId);
    if(order?.id!==input.orderId || order.diningAccountId!==input.accountId || !order.paidAt || order.invoiced!==true || order.status==='cancelado' || order.testArchivedAt)fail('No hay una venta confirmada de esta cuenta.',409);
    return mutateDb(env,'/dining',state=>{
      const account=own(state?.accounts,input.accountId);
      if(account?.status==='closed'&&account.orderId===input.orderId)return state;
      const contents=value=>JSON.stringify((value.items||[]).map(i=>[i.productId,i.qty,i.unit,i.mods||{},i.note||'']));
      if(account?.status!=='checkout'||account.checkout?.orderId!==input.orderId||Number(account.total)!==Number(order.total)||contents(account)!==contents(order))fail('La venta no corresponde a la reserva.',409);
      const table=own(state.tables,account.tableId);if(!table||table.accountId!==account.id)fail('La ocupación requiere revisión.',409);
      table.accountId='';account.status='closed';account.orderId=input.orderId;account.closedAt=new Date().toISOString();account.closedBy=actor.id;account.revision++;state.revision++;return state;
    });
  }
  return {handle,reserve,complete};
}
