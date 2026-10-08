/* Caja edits only the new batch. Accepted consumption remains immutable on the server. */
window.DiningCash=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>'L '+Number(v||0).toFixed(2),name=t=>(t.kind==='bar'?'Barra ':'Mesa ')+t.number;
 let active=null;
 const pending=()=>!!active?.intent||!!active?.busy;
 function stop(){if(active){clearInterval(active.timer);active.host.onclick=null;active=null;}}
 function mount(host,o){
  if(active?.host===host)return;stop();if(!host)return;
  const s={host,o,state:null,busy:false,intent:null,choosing:false,message:'Cargando mesas en espera…'};active=s;
  const journal='chingadazo-cash-dining:'+o.user.id,valid=()=>active===s&&host.isConnected;
  try{s.intent=JSON.parse(localStorage.getItem(journal)||'null')}catch{s.blocked=true;s.message='No se pudo leer el intento local. No cierres la cuenta.'}
  const selected=()=>s.state?.accounts?.[o.getContext().posDiningAccountId];
  function draw(){
   if(!valid())return;
   const state=s.state,a=selected(),table=state?.tables?.[a?.tableId],disabled=s.busy||s.intent||s.blocked||!o.ready()||navigator.onLine===false;
   const expanded=host.querySelector('details.dining-cash')?.open||s.choosing||s.payment||s.intent||s.blocked||s.error||o.fullScreen;
   const count=Object.keys(state?.accounts||{}).length;
   if(a)o.onAccount?.(name(table)+' · '+(a.status==='paid'?'Pagada':money(a.total))+' · ver consumos');
   host.innerHTML=`<details class="dining-cash" ${expanded?'open':''}><summary>${a?`${esc(name(table))} · ${a.status==='paid'?'Pagada':money(a.total)}`:`Mesas en espera · ${count}`}<span>Ver / gestionar</span></summary><div class="dining-cash-body"><button class="btn ghost" data-cash-refresh ${s.busy||s.payment?'disabled':''}>Actualizar mesas</button><p role="status" aria-live="polite">${esc(s.message)}</p>
    ${s.intent?'<button class="btn gold" data-cash-retry>Consultar operación pendiente · no volver a cobrar</button>':''}
    ${s.payment?`<div class="cash-payment-controls" role="group" aria-label="Confirmar cobro"><h3>Total a pagar</h3><p class="cash-amount">${money(s.payment.total)}</p><label for="diningPayment">Forma de pago</label><select id="diningPayment"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select><label for="diningCashReceived">Efectivo recibido (solo efectivo)</label><input id="diningCashReceived" type="number" min="0" step="0.01"><button class="btn ghost" data-cash-exact>Importe exacto</button><p id="diningChange" role="status">Ingresa el efectivo recibido.</p><p>Confirma únicamente después de recibir el efectivo, la aprobación de la tarjeta o la transferencia.</p><div class="pos-sale-buttons"><button class="btn gold" data-cash-confirm="yes" ${disabled?'disabled':''}>Cobrar e imprimir</button><button class="btn ghost" data-cash-confirm="no" ${disabled?'disabled':''}>Cobrar sin imprimir</button></div><button class="btn ghost" data-cash-cancel-payment>Volver sin cobrar</button></div>`:''}
    ${state&&!state.consumptionsEnabled?'<p>Consumos de mesas todavía no habilitados.</p>':''}
    ${state&&o.getContext().posDiningAccountId&&!a?'<p>La cuenta cambió de estado en otro equipo. Conserva cualquier producto nuevo y revisa la mesa.</p><button class="btn ghost" data-cash-back>Salir de esta selección</button>':''}
    ${s.choosing?`<label for="cashDiningDestination">Guardar pedido en</label><select id="cashDiningDestination">${Object.values(state?.tables||{}).filter(t=>t.active&&!t.accountId).sort((a,b)=>a.number-b.number).map(t=>`<option value="${esc(t.id)}">${esc(name(t))}</option>`).join('')}</select><button class="btn gold" data-cash-save ${disabled?'disabled':''}>Confirmar mesa y enviar pedido</button><button class="btn ghost" data-cash-cancel>Cancelar selección</button>`:''}
    ${a?`<h3>${esc(name(table))} · ${a.status==='paid'?'Pagada · ocupada':a.status==='checkout'?'Cobro en conciliación':'Cuenta abierta'}</h3><p><strong>Pendiente: ${money(a.status==='paid'?0:a.total)}</strong> · Total registrado: ${money(a.total)}</p><ul>${(a.items||[]).map(i=>`<li>${i.qty} × ${esc(i.name)} · ${money(i.qty*i.unit)} <small>${esc(i.modsText)} ${esc(i.note)}</small></li>`).join('')}</ul><p class="hint">Los productos que agregues en Caja son nuevos; lo anterior no se reenvía a cocina.</p><div class="queue-actions"><button class="btn ghost" data-cash-summary>Imprimir resumen (no es pago)</button><button class="btn gold" data-cash-checkout ${disabled||a.status!=='open'||o.getTicket().length?'disabled':''}>Cobrar cuenta completa</button>${a.status==='paid'?`<button class="btn ghost" data-cash-release ${disabled||o.getTicket().length?'disabled':''}>Liberar mesa</button>`:''}<button class="btn ghost" data-cash-back ${disabled||o.getTicket().length?'disabled':''}>Atender otra cuenta</button></div>`:
    `<div class="dining-cash-list">${Object.values(state?.accounts||{}).map(a=>{const t=state.tables[a.tableId];return `<article class="order"><b>${esc(name(t))}</b><p>${a.status==='paid'?'Pagada · ocupada':a.status==='checkout'?'Cobro en conciliación':'Pendiente: '+money(a.total)}</p><button class="btn gold" data-cash-open="${esc(a.id)}" ${disabled?'disabled':''}>${a.status==='paid'?'Ver mesa':'Añadir pedido / cobrar'}</button></article>`}).join('')||'<p>No hay cuentas de mesa pendientes.</p>'}</div>`}</div></details>`;
   if(s.payment&&o.fullScreen){
    const body=host.querySelector('.dining-cash-body'),receipt=document.createElement('aside');receipt.className='cash-receipt';
    for(const child of [...body.children])if(child.matches('h3,ul,p:not([role])'))receipt.append(child);
    body.append(receipt);host.querySelector('[data-cash-cancel-payment]').textContent='Volver a mesas';
   }
  }
  function change(){
   const field=host.querySelector('#diningCashReceived'),method=host.querySelector('#diningPayment'),out=host.querySelector('#diningChange');if(!field||!out)return;
   field.setCustomValidity('');field.disabled=method.value!=='Efectivo';
   const n=Number(field.value);out.textContent=method.value!=='Efectivo'?'Verifica la confirmación del pago antes de cobrar.':!field.value||!Number.isFinite(n)?'Ingresa el efectivo recibido.':n<s.payment.total?'Faltan '+money(s.payment.total-n):'Cambio: '+money(n-s.payment.total);
  }
  host.oninput=change;host.onchange=change;
  s.cancelPayment=()=>{if(s.busy||s.intent)return;s.payment=null;draw();o.onPayment?.(false)};
  s.startPayment=()=>{
   const a=selected();if(s.busy||s.intent||s.blocked)return;
   if(o.getTicket().length||!a||a.status!=='open'||!a.items?.length){s.message='Guarda los productos nuevos y selecciona una cuenta abierta antes de cobrar.';o.onWaiting?.();draw();return;}
   if(!o.getPayment().shiftId){s.message='Abre tu turno antes de cobrar.';o.onWaiting?.();draw();return;}
   s.payment={total:a.total,accountId:a.id};draw();o.onPayment?.(true);
  };
  async function refresh(){try{const data=await o.api('/api/dining');if(!valid())return;s.state=data;s.error=false;s.message='Actualizado. En espera significa pendiente de pago, no de preparación.'}catch(e){s.message=e.message;s.state=null;s.error=true}draw();if(o.paymentOnMount){o.paymentOnMount=false;s.startPayment()}}
  async function execute(command){
   if(s.busy||s.blocked||!o.ready()||navigator.onLine===false)return;
   if(!navigator.locks?.request){s.message='Usa un navegador compatible con guardado protegido.';draw();return;}
   await navigator.locks.request(journal,{ifAvailable:true},async lock=>{
    if(!lock)return;
    s.busy=true;
    try{
     const saved=JSON.parse(localStorage.getItem(journal)||'null');
     if(saved&&JSON.stringify(saved)!==JSON.stringify(command)){s.intent=saved;throw Error('Hay otro intento pendiente. Consulta su resultado.')}
     await o.save();
     if(!valid())return;
     const value=JSON.stringify(command);localStorage.setItem(journal,value);if(localStorage.getItem(journal)!==value)throw Error('No se pudo proteger el intento.');s.intent=command;draw();
     const result=await o.api('/api/dining',{method:'POST',body:JSON.stringify(command)});
     if(!valid())return;
     if(result.operationId!==command.operationId)throw Error('Respuesta sin confirmar.');
     if(command.action==='consume'){
      if(o.getContext().posDiningConfirmedOp!==command.operationId){
       if(JSON.stringify(o.getTicket())!==command.draft)throw Error('Pedido confirmado, pero el borrador cambió. Conservamos el intento para revisión.');
       await o.clear(command.operationId);o.setContext({});await o.save();
      }
     }
     localStorage.removeItem(journal);s.intent=null;s.state=result;s.message=command.action==='checkout'?'Pago confirmado. No vuelvas a cobrar. La mesa continúa ocupada.':'Cambio confirmado y guardado en el servidor.';s.choosing=false;
     if(command.action==='release'){o.setContext({});await o.save()}
     if(command.action==='checkout'){const a=result.accounts?.[command.accountId];if(a?.checkout?.sale)await o.printSale(a.checkout.sale,command.printReceipt)}
     o.changed(command.action);
    }catch(e){s.message=e.message;if([400,412,413].includes(e.status)||(e.status===409&&command.action!=='checkout')){localStorage.removeItem(journal);s.intent=null}}
    finally{s.busy=false;draw();if(command.action==='checkout'&&!s.payment)o.onPayment?.(false)}
   });
  }
  const command=(action,fields)=>({action,...fields,operationId:crypto.randomUUID(),expectedRevision:s.state.revision});
  async function consume(tableId,accountId=''){
   if(!o.getTicket().length||!s.state||s.intent)return;
   return execute(command('consume',{tableId,accountId,items:structuredClone(o.getTicket()),draft:JSON.stringify(o.getTicket())}));
  }
  s.hold=async()=>{
   if(!s.state?.consumptionsEnabled){s.message='Actualiza las mesas antes de guardar.';draw();o.onWaiting?.();return}
   const a=selected();if(a)return consume(a.tableId,a.id);
   s.choosing=true;draw();o.onWaiting?.();host.scrollIntoView?.({behavior:'smooth',block:'start'});
  };
  host.onclick=async event=>{
   const b=event.target.closest('button');if(!b||b.disabled)return;
   if(b.hasAttribute('data-cash-refresh'))return refresh();
   if(b.hasAttribute('data-cash-retry'))return execute(s.intent);
   if(b.hasAttribute('data-cash-cancel')){s.choosing=false;draw();return}
   if(b.hasAttribute('data-cash-cancel-payment'))return s.cancelPayment();
   if(b.hasAttribute('data-cash-exact')){host.querySelector('#diningCashReceived').value=s.payment.total;change();return}
   if(b.hasAttribute('data-cash-confirm')){
    const payment=host.querySelector('#diningPayment').value,payWith=payment==='Efectivo'?Number(host.querySelector('#diningCashReceived').value):0,shiftId=o.getPayment().shiftId;
    if(payment==='Efectivo'&&(!Number.isFinite(payWith)||payWith<s.payment.total)){host.querySelector('#diningCashReceived').setCustomValidity('El efectivo no cubre el total.');host.querySelector('#diningCashReceived').reportValidity();return}
    const cmd=command('checkout',{accountId:s.payment.accountId,payment,payWith,shiftId,printReceipt:b.dataset.cashConfirm!=='no'});s.payment=null;return execute(cmd);
   }
   if(b.hasAttribute('data-cash-save'))return consume(host.querySelector('#cashDiningDestination').value);
   if(b.dataset.cashOpen){if(o.getTicket().length){s.message='Guarda o termina el pedido actual antes de abrir otra mesa.';draw();return}const a=s.state.accounts[b.dataset.cashOpen];o.setContext({posDiningAccountId:a.id,posDiningTableId:a.tableId});await o.save();o.changed();draw();return}
   if(b.hasAttribute('data-cash-back')){if(s.intent||s.busy)return;o.setContext({});await o.save();o.changed();draw();return}
   const a=selected();if(!a)return;
   if(b.hasAttribute('data-cash-release'))return execute(command('release',{accountId:a.id}));
   if(b.hasAttribute('data-cash-checkout'))return s.startPayment();
   if(b.hasAttribute('data-cash-summary')){
    if(window.ChingadazoNative?.isApp){
     b.disabled=true;
     try{await window.ChingadazoPrinter.summary(a,name(s.state.tables[a.tableId]));}
     catch(error){alert('No se confirmó el resumen USB: '+error.message+' Comprueba el papel antes de reintentar. No se ha cobrado esta cuenta.');}
     finally{b.disabled=false;}return;
    }
    const frame=document.createElement('iframe');frame.title='Resumen de mesa';frame.style.display='none';document.body.append(frame);
    frame.contentDocument.write('<!doctype html><html lang="es"><title>Resumen — no es pago</title><body><h1>El Chingadazo · '+esc(name(s.state.tables[a.tableId]))+'</h1><h2>RESUMEN · NO ES COMPROBANTE DE PAGO</h2><ul>'+a.items.map(i=>'<li>'+i.qty+' × '+esc(i.name)+' '+money(i.qty*i.unit)+'</li>').join('')+'</ul><p>Total: '+money(a.total)+'</p></body></html>');frame.contentDocument.close();frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000);
   }
  };
  s.timer=setInterval(()=>{if(valid()&&!s.busy&&!s.choosing&&!s.payment&&!host.contains(document.activeElement))refresh()},15000);draw();refresh();
 }
 return {mount,stop,pending,hold:()=>active?.hold(),startPayment:()=>active?.startPayment(),cancelPayment:()=>active?.cancelPayment()};
})();
