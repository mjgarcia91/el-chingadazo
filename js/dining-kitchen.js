window.DiningKitchen=(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let active=null;
 function stop(){if(active){clearInterval(active.timer);active.host.onclick=null;active=null;}}
 function mount(host,{user,api,isActive}){
  if(!host)return;if(active?.host===host&&active.userId===user.id)return;stop();
  const session={host,userId:user.id,state:null,pending:null,busy:false,stale:true,message:'Cargando comandas…'};active=session;
  const journal='chingadazo-kitchen-intent:'+user.id,valid=()=>active===session&&host.isConnected&&isActive();
  try{session.pending=JSON.parse(localStorage.getItem(journal)||'null');}catch{session.blocked=true;session.message='No se pudo leer la operación pendiente.';}
  function draw(){
   if(!valid())return;host.hidden=session.state?.consumptionsEnabled===false;
   host.innerHTML=`<h3>Comandas de mesas</h3><p class="hint">Cada tarjeta contiene solo los productos de un envío. Preparar no significa cobrar.</p><p role="status">${esc(session.message)}</p><button class="btn ghost" data-kitchen-refresh ${session.busy?'disabled':''}>Actualizar comandas</button>${session.pending?'<button class="btn gold" data-kitchen-retry>Consultar cambio pendiente</button>':''}<div class="dining-kitchen-grid">${(session.state?.batches||[]).map(b=>`<article class="dining-detail"><h4>${b.tableKind==='bar'?'Barra':'Mesa'} ${Number(b.tableNumber)} · ${esc(b.id.slice(-6))}</h4><p>${esc(({nuevo:'Nueva',preparacion:'En preparación',listo:'Lista para servir'})[b.status])}</p><ul>${b.items.map(i=>`<li><strong>${i.qty} × ${esc(i.name)}</strong><p>${esc(i.modsText)} ${esc(i.note)}</p></li>`).join('')}</ul>${b.status!=='listo'?`<button class="btn gold" data-kitchen-batch="${esc(b.id)}" ${session.busy||session.stale||session.pending||session.blocked||navigator.onLine===false?'disabled':''}>${b.status==='nuevo'?'Preparar':'Marcar lista'}</button>`:'<p>Esperando al personal de salón.</p>'}</article>`).join('')||'<p>No hay comandas pendientes.</p>'}</div>`;
  }
  async function refresh(){
   if(!valid()||session.busy)return;session.busy=true;
   try{const state=await api('/api/dining/kitchen');if(!valid())return;session.state=state;session.stale=false;session.message='Comandas actualizadas.';}
   catch(error){session.stale=true;session.message=error.message;}finally{session.busy=false;draw();}
  }
  async function send(batch){
   if(!valid()||session.busy||session.blocked||navigator.onLine===false)return;
   if(!navigator.locks?.request){session.message='Usa un navegador compatible para proteger cambios.';draw();return;}
   await navigator.locks.request(journal,{ifAvailable:true},async lock=>{
    if(!lock){session.message='Otra pestaña está enviando un cambio.';draw();return;}
    let command;
    try{
     const stored=JSON.parse(localStorage.getItem(journal)||'null');
     if(stored&&JSON.stringify(stored)!==JSON.stringify(session.pending)){session.pending=stored;session.message='Se recuperó un cambio pendiente; consulta su resultado.';draw();return;}
     if(!session.pending&&(session.stale||!batch))return;
     command=session.pending||{action:'batchStatus',accountId:batch.accountId,batchId:batch.id,status:batch.status==='nuevo'?'preparacion':'listo',operationId:crypto.randomUUID(),expectedRevision:session.state.revision};
     const raw=JSON.stringify(command);localStorage.setItem(journal,raw);if(localStorage.getItem(journal)!==raw)throw Error();session.pending=command;
    }catch{session.message='No se pudo guardar el intento; no se envió.';draw();return;}
    session.busy=true;draw();
    try{
     const state=await api('/api/dining/kitchen',{method:'POST',body:JSON.stringify(command)});if(!valid())return;
     if(state.operationId!==command.operationId)throw Error('Cambio sin confirmar. Consulta el pendiente.');
     localStorage.removeItem(journal);session.pending=null;session.state=state;session.stale=false;session.message='Cambio confirmado por el servidor.';
    }catch(error){
     session.message=error.message;session.stale=true;
     if([400,409,413].includes(error.status)){try{localStorage.removeItem(journal);session.pending=null;}catch{}}
    }finally{session.busy=false;draw();}
   });
  }
  host.onclick=event=>{
   if(event.target.closest('[data-kitchen-refresh]'))return refresh();
   if(event.target.closest('[data-kitchen-retry]'))return send();
   const button=event.target.closest('[data-kitchen-batch]');if(button&&!button.disabled)return send(session.state.batches.find(b=>b.id===button.dataset.kitchenBatch));
  };
  session.timer=setInterval(refresh,15000);draw();refresh();
 }
 return {mount,stop};
})();
