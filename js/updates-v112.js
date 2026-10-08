async function uploadStoryProof(file,orderId){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecciona una captura JPG, PNG o WebP. No subas el video.');
  if(file.size>20*1024*1024)throw new Error('La imagen original supera 20 MB.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No se pudo leer la imagen.'));img.src=url;});
    const ratio=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw new Error('No se pudo preparar la captura.');
    const token=await AuthBridge.idToken();
    const res=await fetch('/api/instagram-proof?orderId='+encodeURIComponent(orderId),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/jpeg'},body:blob});
    const result=await res.json();if(!res.ok)throw new Error(result.error||'No se pudo subir la captura.');return result.proof;
  }finally{URL.revokeObjectURL(url);}
}
async function updatesApi(path, input) {
  const token = await AuthBridge.idToken();
  if (!token) throw new Error('Inicia sesión para continuar.');
  const res = await fetch(path, {method:input ? 'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(input ? {body:JSON.stringify(input)} : {})});
  const result = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(result.error || 'No se pudo guardar. Intenta nuevamente.');
  return result;
}
let storyRows = null, storyLoading = false, storyError = '', storyOwner = '';
async function loadStories() {
  if (storyLoading) return;
  const owner = currentUser()?.id;
  if (!owner) return;
  storyLoading = true; storyError = '';
  try {
    const result = await updatesApi('/api/instagram-stories');
    if (currentUser()?.id === owner) { storyRows = result.requests; storyOwner = owner; }
  } catch (e) { storyError = e.message; }
  finally { storyLoading = false; render(); }
}
function viewStories() {
  const u=currentUser();
  if (!u) return viewLogin();
  if (!['admin','customer'].includes(u.role)) return viewLogin();
  const admin=canAdmin(), requests=storyOwner===u.id ? storyRows : null;
  if (!requests && !storyLoading && !storyError) setTimeout(loadStories,0);
  const orders=(Store.get().orders||[]).filter(o=>o.userId===u.id && o.status==='entregado' && o.invoiced && o.paidAt && Number(o.total)>0 && !(requests||[]).some(r=>r.orderId===o.id));
  const statuses={pending:'Pendiente de revisión',approved:'300 puntos acreditados',rejected:'No aprobada'};
  return `<div class="section-h"><h2>${admin?'Revisar historias':'Tu historia vale 300 puntos'}</h2><button class="btn ghost" data-go="${admin?'admin-promos':'account'}">Volver</button></div>
    <section class="card-block"><h3>Comparte tu comida y gana 300 Puntos Chingadazo</h3><p>Publica una historia original con la comida de un pedido pagado y entregado. Etiqueta a <b>(Instagram pendiente)</b>, mantén tu cuenta pública y ten al menos <b>500 seguidores</b>.</p><p>Tu historia puede ser una foto o un video. Mantenla visible durante sus 24 horas completas, sin borrarla antes. Cuando cumpla 23 horas, toma una captura donde se vean tu usuario, la comida, la etiqueta y la antigüedad de la historia (23 h). Carga aquí la captura antes de que cumpla 24 horas, junto con el enlace y la fecha y hora de publicación. No subas el video ni conversaciones privadas.</p><p><b>Los puntos no se entregan automáticamente:</b> al cumplirse 24 horas desde la publicación declarada, Administración revisará el cumplimiento y la captura. Una captura aislada no demuestra por sí sola la permanencia durante todo el período. Si no podemos comprobar que cumplió las condiciones, no se acreditan puntos.</p><p>La captura estará disponible durante 7 días desde su carga y se eliminará automáticamente; revisaremos la solicitud antes de que venza. Conservaremos el registro de participación y puntos, sin la fotografía. Una participación por pedido y máximo una cada 7 días. Historias borradas, contenido reutilizado, seguidores falsos o pruebas alteradas no califican. No compartas tu contraseña. Promoción del restaurante, sin patrocinio de Instagram.</p></section>
    ${admin?'<p class="hint">Revisa las capturas antes de que venzan sus 7 días de conservación y comprueba los requisitos al completar las 24 horas de publicación. El tiempo transcurrido o un enlace expirado no demuestran que se mantuvo publicada.</p>':`<form class="form card-block" id="storyForm"><label>Pedido<select name="orderId" required><option value="">Selecciona tu pedido</option>${orders.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.code||o.id)} · ${money(o.total)}</option>`).join('')}</select></label>${orders.length?'':'<p>Podrás participar cuando tengas un pedido pagado y entregado.</p>'}<label>Usuario de Instagram<input name="handle" required maxlength="31" placeholder="@tuusuario"></label><label>Número de seguidores<input name="followers" type="number" required min="500" max="1000000000" step="1"></label><label>Enlace de la historia<input name="url" type="url" required placeholder="https://www.instagram.com/stories/tuusuario/..."></label><label>Fecha y hora en que publicaste la historia (hora de tu dispositivo)<input name="publishedAt" type="datetime-local" required></label><label>Captura de pantalla con la historia a las 23 horas<input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required></label><small>JPG, PNG o WebP. La imagen se optimiza antes de subirla. Eliminación automática a los 7 días.</small><label class="choice-row"><input name="accepted" type="checkbox" required> Acepto las condiciones y autorizo la revisión de mi historia y seguidores para esta promoción.</label><button class="btn gold" type="submit" ${orders.length?'':'disabled'}>Solicitar 300 puntos</button></form>`}
    <div class="section-h"><h3>Solicitudes</h3><button class="btn ghost" type="button" data-stories-refresh>Actualizar</button></div>${storyError?`<p role="alert">${escapeHtml(storyError)}</p>`:''}${storyLoading?'<p>Cargando…</p>':''}
    ${(requests||[]).map(r=>`<article class="card-block"><h3>${escapeHtml(statuses[r.status]||r.status)}</h3><p>${admin?escapeHtml(r.customerName)+' · ':''}${escapeHtml(r.orderCode)} · @${escapeHtml(r.handle)} · ${Number(r.followers)} seguidores declarados</p><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">Abrir historia</a><p>${r.publishedAt?`Publicación declarada: ${fmtHn(r.publishedAt)}<br>`:""}Solicitada: ${fmtHn(r.submittedAt)}<br>Revisable desde: ${fmtHn(r.eligibleAt)}</p>${r.proof?`<p>Captura: ${Date.now()>=Date.parse(r.proof.expiresAt)?'Vencida · ya no disponible':`<button class="btn ghost" type="button" data-story-proof="${escapeHtml(r.proof.key)}">Ver captura</button>`}<br>Disponible hasta ${fmtHn(r.proof.expiresAt)}</p>`:!admin&&r.status==='pending'?`<form class="form" data-attach-story-proof="${escapeHtml(r.orderId)}"><label>Captura de tu historia a las 23 horas<input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn gold">Cargar comprobante</button></form>`:'<p>Falta cargar la captura.</p>'}${r.reason?`<p>${escapeHtml(r.reason)}</p>`:''}${admin&&r.status==='pending'?`<form class="form" data-story-review="${escapeHtml(r.orderId)}" data-story-user="${escapeHtml(r.userId)}"><label>Evidencia comprobada o motivo del rechazo<textarea name="reason" required maxlength="500" placeholder="Describe la comprobación de publicación, duración, seguidores y pedido."></textarea></label><label class="choice-row"><input name="verified" type="checkbox"> Verifiqué todos los requisitos y las 24 horas completas.</label><button class="btn green" type="submit" value="approve" ${Date.now()<Date.parse(r.eligibleAt)?'disabled':''}>Aprobar y acreditar 300 puntos</button><button class="btn danger" type="submit" value="reject">Rechazar</button></form>`:''}</article>`).join('')||'<p class="hint">No hay solicitudes para mostrar.</p>'}`;
}
document.addEventListener('click',async e=>{
  const proofButton=e.target.closest('[data-story-proof]');
  if(proofButton){
    proofButton.disabled=true;
    try{const token=await AuthBridge.idToken(),res=await fetch('/api/instagram-proof?key='+encodeURIComponent(proofButton.dataset.storyProof),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!res.ok){const error=await res.json();throw new Error(error.error||'Captura no disponible.');}
      const url=URL.createObjectURL(await res.blob()),img=document.createElement('img');img.alt='Comprobante de historia de Instagram';img.style.cssText='display:block;max-width:100%;max-height:70vh;object-fit:contain;margin:12px auto';img.onload=img.onerror=()=>URL.revokeObjectURL(url);img.src=url;proofButton.replaceWith(img);
    }catch(error){alert(error.message);proofButton.disabled=false;}return;
  }

  const refresh=e.target.closest('[data-stories-refresh]'); if(refresh){await loadStories();return;}
  if(e.target.closest('[data-sales-today]')){STATE.salesFrom=STATE.salesTo=STATE.calDay=hnYmd();const p=hnParts();STATE.calY=p.y;STATE.calM=p.m-1;document.activeElement?.blur();render();return;}
  const button=e.target.closest('[data-staff-remove]');
  if(!button)return;
  if(!confirm('¿Eliminar este usuario del personal? Se bloqueará su acceso y se conservarán sus ventas históricas.'))return;
  button.disabled=true;
  try{const result=await updatesApi('/api/staff-manage',{action:'remove',userId:button.dataset.staffRemove});Store.patch(d=>d.users.forEach(u=>{if(result.ids.includes(u.id))u.active=false;}));STATE.staffDirectory=null;render();}
  catch(error){alert(error.message);}finally{button.disabled=false;}
});
document.addEventListener('submit',async e=>{
  const f=e.target;
  if(f.id==='salesRangeForm'){
    e.preventDefault();const from=f.elements.from.value,to=f.elements.to.value;
    if(!from||!to||from>to){alert('La fecha inicial debe ser anterior o igual a la final.');return;}
    STATE.salesFrom=from;STATE.salesTo=to;STATE.calDay=from;STATE.calY=Number(from.slice(0,4));STATE.calM=Number(from.slice(5,7))-1;document.activeElement?.blur();render();return;
  }
  if(!f.matches('[data-staff-name-form], [data-story-review], [data-attach-story-proof], #storyForm'))return;
  e.preventDefault();const buttons=[...f.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
    if(f.matches('[data-attach-story-proof]')){
      const proof=await uploadStoryProof(f.elements.proof.files[0],f.dataset.attachStoryProof);
      await updatesApi('/api/instagram-stories',{action:'attach-proof',orderId:f.dataset.attachStoryProof,proofKey:proof.key});await loadStories();
    }else if(f.matches('[data-staff-name-form]')){
      const result=await updatesApi('/api/staff-manage',{action:'rename',userId:f.dataset.staffNameForm,name:f.elements.name.value});
      Store.patch(d=>{const u=d.users.find(x=>x.id===result.profile.id);if(u)Object.assign(u,result.profile);});STATE.staffDirectory=null;
    }else if(f.id==='storyForm'){
      const publishedAt=new Date(f.elements.publishedAt.value).toISOString(),age=Date.now()-Date.parse(publishedAt);
      if(age<23*3600000||age>=24*3600000)throw new Error('Envía la captura cuando la historia tenga entre 23 y 24 horas.');
      const proof=await uploadStoryProof(f.elements.proof.files[0],f.elements.orderId.value);
      await updatesApi('/api/instagram-stories',{publishedAt,proofKey:proof.key,action:'submit',orderId:f.elements.orderId.value,handle:f.elements.handle.value,followers:Number(f.elements.followers.value),url:f.elements.url.value,accepted:f.elements.accepted.checked});
      f.reset(); await loadStories();
    }else{
      await updatesApi('/api/instagram-stories',{action:e.submitter?.value,userId:f.dataset.storyUser,orderId:f.dataset.storyReview,reason:f.elements.reason.value,verified:f.elements.verified.checked});
      await loadStories();
    }
    document.activeElement?.blur();render();
  }catch(error){alert(error.message);}finally{buttons.forEach(b=>b.disabled=false);}
});
