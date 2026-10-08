import { instance, assertInstance } from './instance.js';
// Firebase Cloud Messaging HTTP v1 for background web-push notifications.
// The server derives the audience from Firebase Authentication; the browser
// cannot subscribe itself as another role.
export function createPush({ db, verifyFirebaseUser, json }) {
  const enc = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  const utf = (text) => new TextEncoder().encode(text);
  const allowedStaff = new Set(["admin", "cashier", "kitchen"]);

  async function actor(request, env) {
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!token) throw Object.assign(new Error("Inicia sesión para activar las notificaciones."),{status:401});
    const user=await verifyFirebaseUser(token), id="auth-"+user.localId;
    const [role,profile,driver]=await Promise.all([
      db(env,"/roles/"+encodeURIComponent(user.localId)),
      db(env,"/users/"+encodeURIComponent(id)),
      db(env,"/drivers/"+encodeURIComponent(id))
    ]);
    if(profile?.active===false) throw Object.assign(new Error("Usuario desactivado."),{status:403});
    if(role==="driver_pending" && driver?.status==="pending") return {id,audience:"drivers"};
    if(String(role).startsWith("driver_") || (driver && driver.status!=="approved")) throw Object.assign(new Error("Solicitud no autorizada para notificaciones."),{status:403});
    if(role==="driver") {
      if(driver?.status!=="approved") throw Object.assign(new Error("Repartidor no autorizado."),{status:403});
      return {id,audience:"drivers"};
    }
    if(allowedStaff.has(role)) return {id,audience:"staff"};
    return {id,audience:"customers"};
  }

  async function subscribe(request, env) {
    const a=await actor(request,env), input=await request.json(), token=String(input.token||"").trim();
    if(token.length<50 || token.length>4096) throw Object.assign(new Error("Suscripción push inválida."),{status:400});
    const digest=enc(await crypto.subtle.digest("SHA-256",utf(token))).slice(0,40);
    const entry={token,updatedAt:new Date().toISOString(),platform:String(input.platform||"web").slice(0,250)};
    await db(env,`/pushTokens/${a.audience}/${encodeURIComponent(a.id)}/${digest}`,{method:"PUT",body:JSON.stringify(entry)});
    return json({ok:true,audience:a.audience});
  }

  async function oauth(env) {
    const service=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON||"{}");
    if(!service.client_email || !service.private_key || !service.project_id) throw Object.assign(new Error("La cuenta de servicio de Firebase está incompleta."),{status:503});
    const now=Math.floor(Date.now()/1000), header=enc(utf(JSON.stringify({alg:"RS256",typ:"JWT"}))), claims=enc(utf(JSON.stringify({iss:service.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3500})));
    const pem=service.private_key.replace(/-----[^-]+-----/g,"").replace(/\s/g,"");
    const raw=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey("pkcs8",raw,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
    const sig=enc(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf(`${header}.${claims}`)));
    const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${header}.${claims}.${sig}`})});
    if(!res.ok) {
      let failure={};
      try { failure=await res.json(); } catch {}
      const detail=String(failure.error_description||failure.error||"").toLowerCase();
      let message=`Firebase rechazó la cuenta de servicio (${res.status}).`;
      if(detail.includes("invalid jwt signature")) message="La clave privada de la cuenta de servicio no es válida. Descarga un JSON nuevo de Firebase y vuelve a configurarlo sin copiar ni convertir su contenido.";
      else if(detail.includes("invalid_grant") || failure.error==="invalid_grant") message=`Firebase rechazó la clave de la cuenta de servicio: ${String(failure.error_description||"clave inválida").slice(0,180)}. Descarga una clave JSON nueva y vuelve a configurarla.`;
      else if(detail.includes("disabled") || detail.includes("permission")) message="La cuenta de servicio no tiene permiso para Firebase Cloud Messaging.";
      throw Object.assign(new Error(message),{status:503});
    }
    const body=await res.json();
    if(!body.access_token) throw Object.assign(new Error("Firebase no entregó autorización para enviar notificaciones."),{status:503});
    return {token:body.access_token,project:service.project_id};
  }

  async function send(env, audience, recipientIds, message) {
    assertInstance(env);
    if (!instance.publicOrigin || !/^https:\/\//.test(instance.publicOrigin)) throw Object.assign(new Error('Falta la dirección pública de El Chingadazo.'), {status:503});
    if(!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw Object.assign(new Error("Las credenciales push no están configuradas."),{status:503});
    const [auth,allTokens]=await Promise.all([oauth(env),db(env,`/pushTokens/${audience}`)]);
    if(!allTokens) return {attempted:0,sent:0,failed:0,removed:0,errors:[]};
    const wanted=recipientIds?new Set(recipientIds):null, jobs=[];
    for(const [ownerId,entries] of Object.entries(allTokens)) {
      if(wanted && !wanted.has(ownerId)) continue;
      for(const [digest,entry] of Object.entries(entries||{}).slice(0,5)) {
        if(!entry?.token) continue;
        const payload={message:{token:entry.token,notification:{title:message.title,body:message.body},data:{url:message.url||"/",tag:message.tag||"chingadazo-alert"},webpush:{headers:{Urgency:"high",TTL:message.ttl||"300"},notification:{icon:instance.publicOrigin + "/assets/logo.jpg",badge:instance.publicOrigin + "/assets/logo.jpg",tag:message.tag||"chingadazo-alert",renotify:true,requireInteraction:true,vibrate:[500,120,500,120,900]},fcm_options:{link:instance.publicOrigin +(message.url||"/")}}}};
        jobs.push({ownerId,digest,promise:fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.project)}/messages:send`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(payload)})});
      }
    }
    const result={attempted:Math.min(jobs.length,200),sent:0,failed:0,removed:0,errors:[]};
    const responses=await Promise.all(jobs.slice(0,200).map(async job=>{
      try { return {job,res:await job.promise}; }
      catch(error) { return {job,error}; }
    }));
    for(const item of responses) {
      if(item.res?.ok) { result.sent++; continue; }
      result.failed++;
      let detail={};
      try { detail=await item.res?.json(); } catch {}
      const status=detail?.error?.status||"", messageText=detail?.error?.message||item.error?.message||`HTTP ${item.res?.status||0}`;
      if(item.res?.status===404 || status==="UNREGISTERED" || (status==="INVALID_ARGUMENT" && /registration|token/i.test(messageText))) {
        await db(env,`/pushTokens/${audience}/${encodeURIComponent(item.job.ownerId)}/${encodeURIComponent(item.job.digest)}`,{method:"DELETE"}).catch(()=>{});
        result.removed++;
      }
      if(result.errors.length<3) result.errors.push(messageText.slice(0,220));
    }
    return result;
  }

  async function test(request,env) {
    const a=await actor(request,env);
    const result=await send(env,a.audience,[a.id],{
      title:a.audience==="drivers"?"🏍️ Prueba de nueva entrega":"🔔 Prueba de notificación",
      body:"Todo listo. Este dispositivo recibirá avisos aunque la aplicación esté cerrada.",
      url:a.audience==="drivers"?"/delivery/":"/",tag:"chingadazo-push-test"
    });
    if(!result.attempted) return json({error:"Este usuario todavía no tiene un dispositivo suscrito."},409);
    if(!result.sent) return json({error:result.errors[0]||"Firebase no pudo entregar la notificación.",result},502);
    return json({ok:true,result});
  }

  async function notifyDrivers(env, order) {
    if(order?.type!=="delivery") return;
    const drivers=await db(env,"/drivers") || {}, approved=Object.entries(drivers).filter(([,profile])=>profile?.status==="approved").map(([id])=>id);
    return send(env,"drivers",approved,{title:"🏍️ Nueva entrega disponible",body:`${order.code||order.id} · ${order.address||"Nueva ruta"}`,url:"/delivery/",tag:order.id});
  }
  async function notifyDriverApproved(env,id) {
    const p=await db(env,"/drivers/"+encodeURIComponent(id));
    if(!p || p.status!=="approved" || !p.emailVerified || p.applicationVersion!==123 || !p.approvalNotice || await db(env,"/roles/"+encodeURIComponent(p.authUid))!=="driver") return {sent:0,failed:0};
    return send(env,"drivers",[id],{title:p.approvalNotice.title,body:p.approvalNotice.body,url:"/delivery/",tag:p.approvalNotice.id,ttl:"86400"});
  }
  async function notifyStaff(env, order) {
    return send(env,"staff",null,{title:"🔔 Nuevo pedido",body:`${order.code||order.id} · ${order.customerName||"Cliente"} · ${order.type==="delivery"?"Delivery":"Recoger"}`,url:"/?personal=1",tag:order.id});
  }
  async function notifyCustomer(env, order, title, body) {
    if(!order?.userId) return;
    return send(env,"customers",[order.userId],{title:title||"Tu pedido se actualizó",body:body||`${order.code||order.id} · ${order.status||"en proceso"}`,url:"/?open=orders",tag:order.id});
  }
  async function notifyCustomers(env, title, body, tag="chingadazo-promo") {
    return send(env,"customers",null,{title,body,url:"/",tag});
  }

  return {
    config:(env)=>json({enabled:!!(env.FIREBASE_WEB_VAPID_KEY&&env.FIREBASE_SERVICE_ACCOUNT_JSON),vapidKey:env.FIREBASE_WEB_VAPID_KEY||""}),
    subscribe, test, notifyDriverApproved, notifyDrivers, notifyStaff, notifyCustomer, notifyCustomers
  };
}
