// Private operations: all rewards are recorded atomically with the customer's balance.
export function createUpdates({db, mutateDb, identity, requireStaff, json, proofInfo=async()=>{throw Object.assign(new Error("Carga la captura de pantalla."),{status:400});}}) {
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
  const key = value => /^[A-Za-z0-9_-]{1,150}$/.test(value || '');
  const clean = value => String(value || '').trim();
  const rows = node => Object.values(node || {}).filter(Boolean);
  const safe = profile => { const {password, pin, rewardLedger, redemptions, ...rest} = profile; return rest; };
  const day = 86400000;
  async function staff(request, env) {
    const actor = await requireStaff(request, env, ['admin']);
    const input = await request.json(), id = clean(input.userId);
    if (!key(id)) fail('Usuario inválido.');
    const profile = await db(env, '/users/' + id);
    if (!profile || !['admin','cashier','kitchen'].includes(profile.role)) fail('Personal no encontrado.', 404);
    const uid = profile.authUid || (id.startsWith('auth-') ? id.slice(5) : '');
    const ids = new Set([id, ...(uid ? ['auth-' + uid] : []), ...(profile.legacyProfileId ? [profile.legacyProfileId] : [])]);
    const now = new Date().toISOString();
    if (input.action === 'rename') {
      const name = clean(input.name);
      if (!name || name.length > 100 || /[<>\x00-\x1f]/.test(name)) fail('Escribe un nombre de 1 a 100 caracteres.');
      const updates = {};
      for (const target of ids) {
        if (!key(target)) fail('Perfil inválido.');
        if (await db(env, '/users/' + target)) { updates['users/' + target + '/name'] = name; updates['users/' + target + '/updatedAt'] = now; }
      }
      const hash = uid && await db(env, '/staffPinByUid/' + uid);
      if (hash) updates['staffPins/' + hash + '/name'] = name;
      await db(env, '', {method:'PATCH', body:JSON.stringify(updates)});
      return json({profile:safe({...profile, name, updatedAt:now})});
    }
    if (input.action !== 'remove') fail('Acción inválida.');
    if (ids.has(actor.actor) || uid === actor.user.localId) fail('No puedes eliminar tu propia cuenta administrativa.',409);
    // Recheck access and open shifts inside one CAS transaction. Concurrent
    // administrators cannot remove each other and leave the business locked out.
    await mutateDb(env, '', app => {
      if (!app || app.roles?.[actor.user.localId] !== 'admin' || app.users?.[actor.actor]?.active === false) fail('Acceso no autorizado.',403);
      if (rows(app.shifts).some(s => ids.has(s.userId) && !s.closedAt)) fail('Cierra primero el turno de este empleado.',409);
      for (const target of ids) {
        if (!key(target)) fail('Perfil inválido.');
        if (app.users?.[target]) Object.assign(app.users[target],{active:false,deletedAt:now,deletedBy:actor.actor});
      }
      if (uid) {
        const hash = app.staffPinByUid?.[uid];
        if (app.roles) delete app.roles[uid];
        if (app.staffPinByUid) delete app.staffPinByUid[uid];
        if (hash && app.staffPins) delete app.staffPins[hash];
      }
      return app;
    });
    return json({ok:true, ids:[...ids]});
  }
  async function stories(request, env) {
    const a = await identity(request, env);
    if (!a) fail('Inicia sesión.',401);
    if (!['admin','customer'].includes(a.role)) fail('Acceso no autorizado.',403);
    if (request.method === 'GET') {
      const profiles = a.role === 'admin' ? rows(await db(env,'/users')) : [await db(env,'/users/' + a.id)];
      return json({requests:profiles.filter(Boolean).flatMap(u => rows(u.storyRequests).map(r => ({...r, userId:u.id, customerName:u.name}))).sort((x,y) => y.submittedAt.localeCompare(x.submittedAt))});
    }
    const input = await request.json(), now = Date.now(), at = new Date(now).toISOString();
    if (input.action === 'submit') {
      if (a.role !== 'customer' || a.user.emailVerified !== true) fail('Usa tu cuenta de cliente con correo verificado.',403);
      const orderId = clean(input.orderId), handle = clean(input.handle).replace(/^@/,'').toLowerCase();
      if (!key(orderId) || !/^[a-z0-9._]{1,30}$/.test(handle)) fail('Pedido o usuario de Instagram inválido.');
      let url; try { url = new URL(input.url); } catch { fail('Escribe el enlace de tu historia.'); }
      if (url.protocol !== 'https:' || !['instagram.com','www.instagram.com'].includes(url.hostname) || url.username || url.password || url.port || !new RegExp('^/stories/' + handle.replace(/\./g,'\\.') + '/[0-9]+/?$','i').test(url.pathname)) fail('El enlace debe ser una historia del usuario de Instagram indicado.');
      const followers = Number(input.followers);
      if (!Number.isInteger(followers) || followers < 500 || followers > 1000000000 || input.accepted !== true) fail('Requiere al menos 500 seguidores y aceptar las condiciones.');
      const order = await db(env,'/orders/' + orderId);
      if (!order || order.userId !== a.id || order.status !== 'entregado' || !order.invoiced || !order.paidAt || !(Number(order.total)>0)) fail('Selecciona un pedido tuyo pagado y entregado.',409);
      const published=Date.parse(input.publishedAt);
      if(!Number.isFinite(published)||now-published<23*3600000||now-published>=day)fail('Envía la captura cuando la historia tenga entre 23 y 24 horas.',409);
      const proof=await proofInfo(env,input.proofKey,a.id,orderId);
      const existingProfile = await db(env,'/users/' + a.id);
      if (existingProfile?.storyRequests?.[orderId] || rows(existingProfile?.storyRequests).some(r => now-Date.parse(r.submittedAt)<7*day)) fail('Este pedido ya participó o aún no han pasado 7 días desde tu última solicitud.',409);
      const storyId = url.pathname.split('/')[3];
      await mutateDb(env,'/instagramStoryClaims/' + storyId, claim => {
        if (claim && (claim.userId !== a.id || claim.orderId !== orderId)) fail('Esta historia ya está vinculada a otra solicitud.',409);
        return claim || {userId:a.id,orderId,createdAt:at};
      },5,true);
      const result = await mutateDb(env,'/users/' + a.id,u => {
        if (!u || u.active === false) fail('Cuenta no disponible.',403);
        u.storyRequests ||= {};
        if (u.storyRequests[orderId]) fail('Este pedido ya tiene una solicitud.',409);
        if (rows(u.storyRequests).some(r => now-Date.parse(r.submittedAt)<7*day)) fail('Puedes participar una vez cada 7 días.',409);
        u.storyRequests[orderId] = {orderId,orderCode:order.code||orderId,handle,url:url.origin+url.pathname,followers,status:'pending',submittedAt:at,eligibleAt:new Date(published+day).toISOString(),publishedAt:new Date(published).toISOString(),proof,policyVersion:117,points:300};
        return u;
      });
      return json({request:result.storyRequests[orderId]});
    }
    if(input.action==='attach-proof'){
      if(a.role!=='customer')fail('Solo el cliente puede cargar su comprobante.',403);
      const orderId=clean(input.orderId);if(!key(orderId))fail('Pedido inválido.');
      const proof=await proofInfo(env,input.proofKey,a.id,orderId);
      const result=await mutateDb(env,'/users/'+a.id,u=>{
        const r=u?.storyRequests?.[orderId];if(!r||r.status!=='pending')fail('Solicitud no disponible.',409);
        if(r.proof)fail('Esta solicitud ya tiene comprobante.',409);
        r.proof=proof;return u;
      });return json({request:result.storyRequests[orderId]});
    }
    if (a.role !== 'admin') fail('Solo Administración puede revisar solicitudes.',403);
    const id = clean(input.userId), orderId = clean(input.orderId);
    if (!key(id) || !key(orderId) || !['approve','reject'].includes(input.action)) fail('Solicitud inválida.');
    const order = await db(env,'/orders/' + orderId);
    if (input.action === 'approve' && (!order || order.userId !== id || order.status !== 'entregado' || !order.invoiced || !order.paidAt)) fail('El pedido ya no cumple las condiciones.',409);
    const before=(await db(env,'/users/'+id))?.storyRequests?.[orderId];
    if(input.action==='approve'&&before?.status==='pending')await proofInfo(env,before.proof?.key,id,orderId);
    const result = await mutateDb(env,'/users/' + id,u => {
      if (!u || u.active === false) fail('Cuenta no disponible.',404);
      const r = u.storyRequests?.[orderId];
      if (!r) fail('Solicitud no encontrada.',404);
      if (r.status !== 'pending') return u; // Safe repeated clicks/retries: never credit twice.
      const reason = clean(input.reason).slice(0,500);
      if (input.action === 'approve') {
        if (now < Date.parse(r.eligibleAt)) fail('Espera hasta la fecha indicada para revisar las 24 horas de publicación.',409);
        if (input.verified !== true || !reason) fail('Confirma la revisión y describe la evidencia de las 24 horas.');
        u.rewardLedger ||= {};
        const ledger = 'instagram-' + orderId;
        if (!u.rewardLedger[ledger]) { u.points = Number(u.points||0)+300; u.rewardLedger[ledger]=300; }
        u.pointsUpdatedAt=at;
        r.status='approved'; r.awardedAt=at;
      } else { if (!reason) fail('Indica el motivo del rechazo.'); r.status='rejected'; }
      r.reviewedBy=a.id; r.reviewedAt=at; r.reason=reason;
      return u;
    });
    return json({request:result.storyRequests[orderId]});
  }
  return {staff,stories};
}
