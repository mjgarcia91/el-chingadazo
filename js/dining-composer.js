/* Drafts are local evidence; the server validates every submitted line. */
window.DiningComposer=(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const storageKey=(userId,tableId,accountId)=>`chingadazo-dining-draft:${userId}:${tableId}:${accountId||'new'}`;
 function confirm(userId,tableId,accountId,draftId){
  const key=storageKey(userId,tableId,accountId),stored=JSON.parse(localStorage.getItem(key)||'null');
  if(stored?.id===draftId)localStorage.removeItem(key);
 }
 function mount(host,{user,table,accountId,products,onSend,canSend,canEdit=()=>true}){
  const key=storageKey(user.id,table.id,accountId);let alive=true,release=()=>{},locked=false,busy=false,selected='',message='Preparando guardado local…',draft={id:'',items:[]};
  const menu=(products||[]).filter(p=>p.available!==false),money=n=>'L '+Number(n).toFixed(2);
  function persist(items){
   if(!locked||busy||!canEdit())return false;
   const next={id:crypto.randomUUID(),items},value=JSON.stringify(next);
   try{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error();draft=next;message='Borrador guardado en este equipo. Falta enviar a cocina.';return true;}
   catch{message='No se pudo guardar. No abandones esta pantalla; no se agregó el producto.';return false;}
  }
  function draw(){
   if(!alive)return;
   const p=menu.find(x=>x.id===selected),disabled=!locked||busy||!canEdit();
   host.innerHTML=`<h4>Agregar productos · ${table.kind==='bar'?'Barra':'Mesa'} ${Number(table.number)}</h4><p role="status">${esc(message)}</p>
    <form><label>Producto<select name="product" ${disabled?'disabled':''}><option value="">Elige un producto</option>${menu.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)} · ${money(x.price)}</option>`).join('')}</select></label>
    ${p?`${(p.modifiers||[]).map(g=>`<fieldset><legend>${esc(g.name)}${g.required?' · obligatorio':''}</legend>${g.multi?(g.options||[]).map(o=>`<label class="dining-check"><input type="checkbox" name="mod-${esc(g.id)}" value="${esc(o.id)}">${esc(o.name)} (+${money(o.price||0)})</label>`).join(''):`<select name="mod-${esc(g.id)}" aria-label="${esc(g.name)}" ${g.required?'required':''}><option value="">Seleccionar</option>${(g.options||[]).map(o=>`<option value="${esc(o.id)}">${esc(o.name)} (+${money(o.price||0)})</option>`).join('')}</select>`}</fieldset>`).join('')}
    <label>Cantidad<input type="number" name="qty" min="1" max="50" value="1" required></label><label>Nota para cocina<input name="note" maxlength="500" placeholder="Ej. sin cebolla"></label><button class="btn ghost" ${disabled?'disabled':''}>Agregar al pedido</button>`:''}</form>
    <h4>Por enviar</h4>${draft.items.length?`<ul class="dining-draft-lines">${draft.items.map((i,n)=>`<li><strong>${i.qty} × ${esc(i.name)}</strong><span>${esc(i.modsText||'')} ${esc(i.note||'')}</span><b>${money(i.unit*i.qty)}</b><button type="button" class="btn ghost" data-consumption-remove="${n}" aria-label="Quitar ${esc(i.name)}" ${disabled?'disabled':''}>Quitar</button></li>`).join('')}</ul><p>Total nuevo: <strong>${money(draft.items.reduce((sum,i)=>sum+i.unit*i.qty,0))}</strong>`:'<p>No hay productos pendientes.</p>'}
    <button class="btn gold" type="button" data-consumption-send ${disabled||!draft.items.length||!canSend()||navigator.onLine===false?'disabled':''}>Agregar a cuenta y enviar a cocina</button><p class="hint">Esto no registra un pago. Sin red, conserva el borrador; no se considera enviado.</p>`;
  }
  host.onchange=event=>{if(event.target.name==='product'){selected=event.target.value;draw();host.querySelector('[name="product"]')?.focus();}};
  host.onsubmit=event=>{
   event.preventDefault();event.stopPropagation();if(!locked||busy||!canEdit())return;
   const form=new FormData(event.target),p=menu.find(x=>x.id===selected);if(!p)return;
   const qty=Number(form.get('qty')),mods={},labels=[];let unit=Number(p.price);
   if(!Number.isInteger(qty)||qty<1||qty>50)return;
   for(const g of p.modifiers||[]){
    const ids=form.getAll('mod-'+g.id).filter(Boolean);if(g.required&&!ids.length){message='Selecciona '+g.name;draw();return;}
    mods[g.id]=g.multi?ids:(ids[0]||[]);const names=[];
    for(const id of ids){const option=g.options.find(o=>o.id===id);unit+=Number(option.price||0);names.push(option.name);}
    if(names.length)labels.push(g.name+': '+names.join(', '));
   }
   if(draft.items.length>=50){message='Envía este pedido antes de agregar más líneas.';draw();return;}
   if(persist([...draft.items,{productId:p.id,name:p.name,qty,unit,mods,modsText:labels.join(' · '),note:String(form.get('note')||'').trim()}]))draw();
   else host.querySelector('[role="status"]').textContent=message;
  };
  host.onclick=async event=>{
   const remove=event.target.closest('[data-consumption-remove]'),send=event.target.closest('[data-consumption-send]');
   if(!remove&&!send)return;event.stopPropagation();if(!locked||busy||!canEdit())return;
   if(remove){persist(draft.items.filter((_,n)=>n!==Number(remove.dataset.consumptionRemove)));draw();return;}
   if(!canSend()||navigator.onLine===false||!draft.items.length)return;
   busy=true;draw();const submitted=draft;
   try{if(await onSend(submitted.items,submitted.id)){confirm(user.id,table.id,accountId,submitted.id);draft={id:'',items:[]};message='Pedido confirmado en el servidor.';}else message='Conservamos el borrador hasta confirmar el envío.';}
   catch(error){message=error.message||'No se confirmó el pedido; conserva el borrador.';}
   finally{busy=false;draw();}
  };
  draw();
  if(!navigator.locks?.request){message='Este navegador no permite proteger borradores. Usa un navegador compatible.';draw();}
  else navigator.locks.request(key,{ifAvailable:true},async lock=>{
   if(!alive)return;if(!lock){message='Esta cuenta está abierta para edición en otra pestaña.';draw();return;}
   try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){if(!Array.isArray(saved.items)||typeof saved.id!=='string')throw Error();draft=saved;}locked=true;message=draft.items.length?'Borrador recuperado. Falta enviar a cocina.':'Elige productos para esta mesa.';draw();await new Promise(resolve=>{release=resolve;});}
   catch{locked=false;message='No se pudo leer el borrador local. No se enviará ningún pedido.';draw();}
  });
  return {stop(){alive=false;release();host.onclick=null;host.onchange=null;host.onsubmit=null;}};
 }
 return {mount,confirm};
})();
