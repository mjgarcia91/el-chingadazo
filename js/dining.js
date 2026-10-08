/* Private staff view. A local journal is evidence of intent, never authority. */
window.DiningUI = (() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let active=null;
  function stop(){if(active){active.composer?.stop();clearInterval(active.timer);active.host.onclick=null;active.host.onsubmit=null;active=null;}}
  function mount(host,{user,api,isActive,products=()=>[],onCash}) {
    if(active?.host===host&&active.user.id===user.id)return;
    stop();
    if(!host||!['admin','cashier'].includes(user?.role))return;
    const session={host,user,state:null,selected:'',busy:false,loading:false,stale:true,message:'Cargando salón…',pending:null,editing:false};active=session;
    const journal='chingadazo-dining-intent:'+user.id;
    try {session.pending=JSON.parse(localStorage.getItem(journal)||'null');}catch{session.message='No se puede leer el pendiente local. Revisa el almacenamiento.';session.blocked=true;}
    const valid=()=>active===session&&host.isConnected&&isActive();
    const name=t=>'Mesa '+t.number;
    const options=(values,selected,label)=>values.map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(label(v))}</option>`).join('');
    const money=value=>'L '+Number(value||0).toFixed(2);
    function accountDetails(account,disabled){
      if(!session.state?.consumptionsEnabled)return '<p>Sin consumos habilitados en esta etapa.</p>';
      return `<p class="dining-balance">${account.status==='paid'?'Pagada · ocupada':account.status==='checkout'?'Pago por confirmar · no volver a cobrar':'Saldo pendiente'}: <strong>${money(account.status==='paid'?0:account.total)}</strong></p>${account.status==='paid'?`<button class="btn gold" data-dining-action="release" ${disabled?'disabled':''}>Liberar mesa</button>`:''}${onCash?'<button class="btn gold" data-dining-action="cash">Ver cuenta en Caja</button>':''}<ul>${(account.items||[]).map(i=>`<li>${i.qty} × ${esc(i.name)} · ${money(i.unit*i.qty)}<small>${esc(i.modsText)} ${esc(i.note)}</small></li>`).join('')}</ul>
        ${Object.values(account.batches||{}).map(b=>`<p>Comanda ${esc(b.id.slice(-6))} · ${esc(({nuevo:'En cola de cocina',preparacion:'En preparación',listo:'Lista para servir',servido:'Servida'})[b.status])}</p>${b.status==='listo'?`<button class="btn ghost" data-dining-action="serve" data-batch="${esc(b.id)}" ${disabled?'disabled':''}>Marcar servida</button>`:''}`).join('')}`;
    }
    function draw(){
      if(!valid())return;
      const s=session.state,admin=user.role==='admin',disabled=session.busy||session.stale||session.pending||session.blocked||navigator.onLine===false;
      const tables=Object.values(s?.tables||{}).sort((a,b)=>a.number-b.number),table=s?.tables?.[session.selected],account=s?.accounts?.[table?.accountId];
      let position=0;while(position<200&&tables.some(t=>t.active&&t.row===Math.floor(position/4)+1&&t.column===position%4+1))position++;
      const composerKey=table?.id+':'+(table?.accountId||''),previousComposer=host.querySelector('#diningComposer');
      const preserveComposer=previousComposer&&session.composer&&session.composerKey===composerKey&&!session.busy&&!session.pending;
      if(!preserveComposer){session.composer?.stop();session.composer=null;}
      host.innerHTML=`<div class="dining-heading"><div><span class="dining-eyebrow">EL CHINGADAZO · SALÓN</span><h2>Mesas</h2></div><button class="btn ghost" data-dining-action="refresh" ${session.busy?'disabled':''}>Actualizar</button></div>
        <p class="dining-notice">${s?.consumptionsEnabled?'Selecciona una mesa para ver su cuenta. Las mesas pagadas se liberan aquí con Liberar mesa. Para cobrar, entra a Ver cuenta en Caja.':'Configuración y cuentas vacías. Los consumos, comandas y cobros de mesas todavía no están habilitados. Caja habitual sigue disponible.'}</p>
        <p role="status" aria-live="polite" class="dining-status">${esc(navigator.onLine===false?'Sin conexión. No se pueden modificar mesas. ':session.message)} ${session.stale?'Información sin actualizar.':''}</p>
        ${session.pending?'<button class="btn gold" data-dining-action="retry">Consultar operación pendiente</button>':''}
        ${!s?'':!s.initialized?`<p>El salón aún no está preparado.</p>${admin?'<button class="btn gold" data-dining-action="initialize">Preparar 30 mesas</button>':'<p>Solicita a administración que prepare el salón.</p>'}`:s.layoutVersion===1?`<p>La actualización conserva las cuentas y convierte la distribución anterior en un salón de mesas numeradas.</p>${admin?'<button class="btn gold" data-dining-action="flattenSalon">Actualizar a salón de 30 mesas</button>':'<p>Administración debe completar la actualización del salón.</p>'}`:`
        ${admin?`<button class="btn gold" data-dining-action="new" ${disabled?'disabled':''}>Agregar mesa</button>`:''}
        <p class="hint">${tables.filter(t=>t.active&&!t.accountId).length} libres · ${tables.filter(t=>t.accountId).length} ocupadas · ${tables.filter(t=>!t.active).length} fuera de servicio</p>
        <div class="dining-workspace"><section><h3>Salón</h3><div class="dining-grid" aria-label="Plano de mesas">${tables.sort((a,b)=>a.row-b.row||a.column-b.column).map(t=>`<button class="dining-table ${t.accountId?'occupied':!t.active?'inactive':'free'} ${session.selected===t.id?'selected':''}" style="--dining-row:${Number(t.row)};--dining-column:${Number(t.column)}" data-dining-table="${esc(t.id)}" aria-pressed="${session.selected===t.id}"><strong>${esc(name(t))}</strong><span>${!t.active?'Fuera de servicio':t.accountId?(s.accounts[t.accountId]?.status==='checkout'?'En cobro':'Ocupada'):'Libre'}</span></button>`).join('')||'<p>No hay mesas. Administración puede agregarlas.</p>'}</div></section>
        <aside class="dining-detail">${table?`<h3>${esc(name(table))}</h3>${account?`<p>Cuenta abierta · ${esc(new Date(account.openedAt).toLocaleString('es-HN'))}</p>${accountDetails(account,disabled)}<label for="diningDestination">Trasladar cuenta a</label><select id="diningDestination">${options(tables.filter(t=>t.active&&!t.accountId).sort((a,b)=>a.number-b.number),'',name)}</select><button class="btn gold" data-dining-action="transfer" ${disabled||account.status!=='open'?'disabled':''}>Trasladar cuenta</button>${admin&&!(account.items||[]).length?`<button class="btn ghost" data-dining-action="cancelEmpty" ${disabled?'disabled':''}>Cerrar cuenta vacía</button>`:''}`:s.consumptionsEnabled?'<p>Agrega el primer pedido para abrir la cuenta.</p>':`<button class="btn gold" data-dining-action="open" ${disabled||!table.active?'disabled':''}>Abrir cuenta vacía</button>`}${s.consumptionsEnabled&&table.active&&(!account||account.status==='open')?'<details open><summary>Agregar productos</summary><section id="diningComposer"></section></details>':''}`:'<h3>Selecciona una mesa</h3><p>Consulta su cuenta o edita su número y posición.</p>'}
        ${admin?`<details ${session.editing?'open':''}><summary>${table?'Editar mesa':'Nueva mesa'}</summary><form id="diningTableForm"><label>Número<input name="number" type="number" min="1" max="999" required value="${table?.number||Math.max(30,...tables.map(t=>t.number))+1}"></label><div class="dining-position"><label>Fila<input name="row" type="number" min="1" max="50" value="${table?.row||Math.floor(position/4)+1}" required></label><label>Columna<input name="column" type="number" min="1" max="4" value="${table?.column||position%4+1}" required></label></div><label class="dining-check"><input name="active" type="checkbox" ${table?.active!==false?'checked':''}>Activa</label><button class="btn gold" ${disabled?'disabled':''}>${table?'Guardar cambios':'Guardar nueva mesa'}</button></form></details>`:''}</aside></div>`}`;
      const composerHost=host.querySelector('#diningComposer');
      if(composerHost&&preserveComposer)composerHost.replaceWith(previousComposer);
      else if(composerHost&&window.DiningComposer){session.composerKey=composerKey;session.composer=window.DiningComposer.mount(composerHost,{user,table,accountId:table.accountId||'',products:products(),canEdit:()=>!session.busy&&!session.pending&&!session.blocked,canSend:()=>!session.busy&&!session.stale&&!session.pending&&!session.blocked,onSend:(items,draftId)=>send('consume',{tableId:table.id,accountId:table.accountId||'',items,draftId})});}
    }
    async function refresh(){
      if(session.loading||!valid())return;session.loading=true;
      try {const data=await api('/api/dining');if(!valid())return;session.state=data;session.stale=false;session.message='Salón actualizado · '+new Date().toLocaleTimeString('es-HN');}
      catch(error){session.stale=true;session.message=error.message;}
      finally{session.loading=false;if(!host.contains(document.activeElement)||!document.activeElement.matches('input,select'))draw();}
    }
    async function send(action,fields={}){
      if(!navigator.locks?.request){session.message='Este navegador no permite proteger operaciones entre pestañas. Usa un navegador compatible.';draw();return;}
      await navigator.locks.request(journal,{ifAvailable:true},async lock=>{
        if(!lock){session.message='Hay una operación en otra pestaña. Espera y actualiza.';draw();return;}
        try {
          const pending=JSON.parse(localStorage.getItem(journal)||'null');
          if(pending&&JSON.stringify(pending)!==JSON.stringify(session.pending)){session.pending=pending;session.message='Se recuperó una operación pendiente. Consulta su resultado.';draw();return;}
          await execute(action,fields);
        }catch{session.message='No se pudo leer el guardado local. No se envió el cambio.';draw();}
      });
    }
    async function execute(action,fields={}){
      if(session.busy||!valid())return;
      if(navigator.onLine===false){session.message='Espera a recuperar la conexión.';draw();return;}
      if(action!=='retry'&&(session.pending||session.stale||session.blocked)){session.message='Actualiza o resuelve la operación pendiente antes de continuar.';draw();return;}
      const command=action==='retry'?session.pending:{action,...fields,operationId:crypto.randomUUID(),expectedRevision:session.state?.revision||0};
      if(!command)return;
      try {const value=JSON.stringify(command);localStorage.setItem(journal,value);if(localStorage.getItem(journal)!==value)throw Error();session.pending=command;}
      catch{session.message='No se pudo guardar el intento en este equipo. No se envió el cambio.';draw();return;}
      session.busy=true;draw();
      try{
        const data=await api('/api/dining',{method:'POST',body:JSON.stringify(command)});
        if(!valid())return;
        if(data.operationId!==command.operationId)throw Error('Respuesta sin confirmar; conserva el pendiente.');
        if(command.action==='consume'&&command.draftId)window.DiningComposer?.confirm(user.id,command.tableId,command.accountId,command.draftId);
        localStorage.removeItem(journal);session.pending=null;session.state=data;session.stale=false;session.message='Cambio confirmado por el servidor.';
      }catch(error){
        if(!valid())return;
        session.message=error.message;session.stale=true;
        if([400,409,413].includes(error.status)){try{localStorage.removeItem(journal);session.pending=null;}catch{}}
      }finally{session.busy=false;draw();}
    }
    host.onclick=event=>{
      const table=event.target.closest('[data-dining-table]'),button=event.target.closest('[data-dining-action]');
      if(table){session.selected=table.dataset.diningTable;session.editing=false;draw();return;}
      if(!button||button.disabled)return;
      const action=button.dataset.diningAction,selected=session.state?.tables?.[session.selected];
      if(action==='cash')return onCash?.(selected);
      if(action==='release')return send('release',{accountId:selected.accountId});
      if(action==='serve')return send('batchStatus',{accountId:selected.accountId,batchId:button.dataset.batch,status:'servido'});
      if(action==='refresh')return refresh();
      if(action==='new'){session.selected='';session.editing=true;draw();host.querySelector('[name="number"]')?.focus();return;}
      if(action==='initialize'&&!confirm('¿Preparar las mesas 1–30? No se reemplaza ningún salón existente.'))return;
      if(action==='flattenSalon'&&!confirm('¿Cambiar a un salón único con mesas numeradas? Se conservan las cuentas y una copia de la distribución anterior.'))return;
      if(action==='cancelEmpty'&&!confirm('¿Cerrar esta cuenta vacía? Su historial se conservará. No es un cobro.'))return;
      const fields=action==='open'?{tableId:selected.id}:action==='transfer'?{accountId:selected.accountId,destinationTableId:host.querySelector('#diningDestination')?.value}:action==='cancelEmpty'?{accountId:selected.accountId}:{};
      send(action,fields);
    };
    host.onsubmit=event=>{
      event.preventDefault();const form=event.target,f=new FormData(form);
      if(form.id==='diningTableForm')send('saveTable',{tableId:session.selected||'table-'+crypto.randomUUID(),table:{number:Number(f.get('number')),kind:'table',zoneId:'salon',row:Number(f.get('row')),column:Number(f.get('column')),active:f.has('active'),temporary:false}});
    };
    session.timer=setInterval(()=>{if(!valid()){stop();return;}const editingConfiguration=[...host.querySelectorAll('details[open]')].some(detail=>!detail.querySelector('#diningComposer'));if(!session.busy&&!editingConfiguration&&!document.activeElement?.matches('input,select'))refresh();},15000);
    draw();refresh();
  }
  return {mount,stop};
})();
