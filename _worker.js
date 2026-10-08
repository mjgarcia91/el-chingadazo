import { instance, assertInstance } from './server/instance.js';
import './js/hours.js';
import { createStoryProof, cleanupStoryProofs } from './server/story-proof.js';
import { createShiftMaintenance, shiftExpired } from './server/shift-maintenance.js';
import { createTestReset } from './server/test-reset.js';
import { createFinance } from './server/finance.js';
import { createAccess } from './server/access.js';
import { createDelivery } from './server/delivery.js';
import { createPush } from './server/push.js';
import { createFamily } from './server/family.js';
import { createPayerGame } from './server/payer-game.js';
import { createChupisticaGame } from './server/chupistica-game.js';
import { createManager } from './server/manager.js';
import { createUpdates } from './server/updates-v112.js';
import { createBackupService } from './server/backup-service.js';
import { createDining } from './server/dining.js';
import { createDiningCheckout } from './server/dining-checkout.js';
const DB = instance.firebase.databaseURL.replace(/\/$/, '') + '/app';
const API_KEY = instance.firebase.apiKey;
let googleToken = null;
let googleTokenUntil = 0;
const attempts = new Map();
const analyticsAttempts = new Map();

const json = (body, status = 200) => new Response(JSON.stringify(body, (key, value) =>
  /^(error|message|lastError)$/.test(key) && typeof value === 'string' && /firebase|fiberbase|identitytoolkit|securetoken|auth\//i.test(value)
    ? 'No se pudo completar la operación. Inténtalo nuevamente o contacta al restaurante.' : value), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const b64url = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let raw = "";
  bytes.forEach((b) => { raw += String.fromCharCode(b); });
  return btoa(raw).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const pemBytes = (pem) => {
  const raw = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const bin = atob(raw); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};
async function privateKey(sa) {
  return crypto.subtle.importKey("pkcs8", pemBytes(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
async function signedJwt(sa, payload) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const input = head + "." + body;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await privateKey(sa), new TextEncoder().encode(input));
  return input + "." + b64url(sig);
}
function serviceAccount(env) {
  return assertInstance(env);
}
async function accessToken(env) {
  if (googleToken && Date.now() < googleTokenUntil) return googleToken;
  const sa = serviceAccount(env); const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(sa, {
    iss: sa.client_email, sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/identitytoolkit",
    iat: now, exp: now + 3500
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!res.ok) throw new Error("Firebase rechazó la cuenta de servicio.");
  const data = await res.json(); googleToken = data.access_token; googleTokenUntil = Date.now() + 50 * 60 * 1000;
  return googleToken;
}
async function db(env, path, init = {}) {
  const token = await accessToken(env);
  const res = await fetch(DB + path + ".json?access_token=" + encodeURIComponent(token), {
    ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) }
  });
  if (!res.ok) throw new Error("Firebase " + res.status);
  return res.status === 204 ? null : res.json();
}
async function mutateDb(env, path, mutator, attempts = 5, allowCreate = false) {
  const token = await accessToken(env);
  const url = DB + path + ".json?access_token=" + encodeURIComponent(token);
  for (let n = 0; n < attempts; n += 1) {
    const currentRes = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
    if (!currentRes.ok) throw new Error("Firebase " + currentRes.status);
    const current = await currentRes.json();
    if (!current && !allowCreate) throw new Error("El registro no existe.");
    const next = mutator(current);
    const saveRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": currentRes.headers.get("etag") || "*" },
      body: JSON.stringify(next)
    });
    if (saveRes.ok) return (await saveRes.json()) || next;
    if (saveRes.status !== 412) throw new Error("Firebase " + saveRes.status);
  }
  throw new Error("La orden cambió en otro dispositivo. Inténtalo nuevamente.");
}
async function pinKey(env, pin) {
  if (!env.PIN_PEPPER) throw new Error("Falta configurar PIN_PEPPER en Cloudflare.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.PIN_PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(pin));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function deviceSignature(env, value) {
  if (!env.PIN_PEPPER) throw new Error("Falta configurar PIN_PEPPER en Cloudflare.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.PIN_PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
async function authorizedDevice(request, env) {
  const match = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)chingadazo_staff_device=([^;]+)/);
  if (!match) return false;
  const parts = decodeURIComponent(match[1]).split(".");
  if (parts.length !== 2) return false;
  const payload = parts[0];
  if ((await deviceSignature(env, payload)) !== parts[1]) return false;
  const expires = Number(payload || 0);
  return Number.isFinite(expires) && Date.now() < expires;
}
async function verifyFirebaseUser(idToken) {
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken })
  });
  const data = await res.json();
  if (!res.ok || !data.users || !data.users[0]) throw new Error("Sesión Firebase inválida.");
  return data.users[0];
}
async function firebaseUserByUid(env, uid) {
  const sa = serviceAccount(env);
  const token = await accessToken(env);
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/projects/" + encodeURIComponent(sa.project_id) + "/accounts:lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ localId: [uid] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Firebase no permitió comprobar el UID.");
  return data.users && data.users[0] ? data.users[0] : null;
}
async function customToken(env, uid, profile) {
  const sa = serviceAccount(env); const now = Math.floor(Date.now() / 1000);
  return signedJwt(sa, {
    iss: sa.client_email, sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now, exp: now + 3600, uid,
    claims: { staff: true, role: profile.role, name: profile.name }
  });
}
function limited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now(); const row = attempts.get(ip) || { n: 0, until: now + 10 * 60 * 1000 };
  if (now > row.until) { row.n = 0; row.until = now + 10 * 60 * 1000; }
  row.n += 1; attempts.set(ip, row);
  return row.n > 8;
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
const FUNNEL_EVENTS = new Set(["visit","menu_view","product_view","cart_add","cart_view","auth_view","register_start","register_complete","email_pending","login_success","checkout_start","location_confirmed","order_complete","ai_view","ai_accept","ai_surprise","profile_view","family_create","family_join","family_checkout","payer_game_create","payer_game_join","payer_game_draw","chupistica_create","chupistica_join","chupistica_start","chupistica_answer","live_order_view"]);
function hondurasDay(offset=0) {
  const d=new Date(Date.now()+offset*86400000);
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Tegucigalpa",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=type=>parts.find(p=>p.type===type)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function hnDateTime(value) {
  return new Intl.DateTimeFormat("es-HN", { timeZone:"America/Tegucigalpa", dateStyle:"medium", timeStyle:"medium" }).format(new Date(value));
}
function amount(value) { return "L. " + Number(value || 0).toFixed(2); }
async function requireStaff(request, env, roles=["admin","cashier","kitchen"]) {
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const user=await verifyFirebaseUser(token), role=await db(env,"/roles/"+encodeURIComponent(user.localId));
  if(!roles.includes(role)) throw Object.assign(new Error("Acceso no autorizado."),{status:403});
  const profile=await db(env,"/users/auth-"+encodeURIComponent(user.localId));
  if(profile?.active===false) throw Object.assign(new Error("Usuario desactivado."),{status:403});
  return {user,role,profile,actor:"auth-"+user.localId};
}
async function staffDirectory(request, env) {
  if (!await authorizedDevice(request, env)) return json({error:"Dispositivo no autorizado."},403);
  const [usersNode,ordersNode,shiftsNode,pinByUid]=await Promise.all([db(env,"/users"),db(env,"/orders"),db(env,"/shifts"),db(env,"/staffPinByUid")]);
  const users=Object.values(usersNode||{}),orders=Object.values(ordersNode||{}),shifts=Object.values(shiftsNode||{}),day=hondurasDay();
  const staff=users.filter(u=>u&&u.active!==false&&u.directoryHidden!==true&&["admin","cashier","kitchen"].includes(u.role)).map(u=>{
    const latest=shifts.filter(s=>s&&s.userId===u.id).sort((a,b)=>String(b.openedAt||"").localeCompare(String(a.openedAt||"")))[0];
    const open=latest&&!latest.closedAt&&hondurasDayFromIso(latest.openedAt)===day?latest:null;
    const openedAt=open?Date.parse(open.openedAt):Infinity;
    const sales=open?orders.filter(o=>o&&o.paidBy===u.id&&o.paidAt&&Date.parse(o.paidAt)>=openedAt&&hondurasDayFromIso(o.paidAt)===day&&(o.shiftId===open.id||!o.shiftId)&&!o.cancelledAt&&o.status!=="cancelado"):[];
    const uid=u.authUid||(String(u.id||"").startsWith("auth-")?String(u.id).slice(5):"");
    return {id:u.id,name:u.name||"Empleado",role:u.role,photoURL:u.photoURL||"",pinReady:!!(uid&&pinByUid&&pinByUid[uid]),salesCount:sales.length,salesTotal:sales.reduce((a,o)=>a+Number(o.total||0),0),shiftOpen:!!open,openedAt:open?.openedAt||""};
  });
  return json({day,staff});
}

async function resetStaffPin(request, env) {
  await requireStaff(request,env,["admin"]);
  const data=await body(request),userId=String(data.userId||""),pin=String(data.pin||"");
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(userId))return json({error:"Empleado inválido."},400);
  if(!/^\d{6}$/.test(pin))return json({error:"El PIN debe tener exactamente 6 números."},400);
  const profile=await db(env,"/users/"+encodeURIComponent(userId));
  if(!profile||profile.active===false||!["admin","cashier","kitchen"].includes(profile.role))return json({error:"Empleado no encontrado."},404);
  const uid=String(profile.authUid||(userId.startsWith("auth-")?userId.slice(5):("staff-"+crypto.randomUUID().replace(/-/g,"")))).slice(0,120);
  const hash=await pinKey(env,pin),existing=await db(env,"/staffPins/"+hash);
  if(existing&&existing.profileId!==userId&&("auth-"+existing.uid)!==userId)return json({error:"Ese PIN ya pertenece a otro empleado."},409);
  const oldHash=await db(env,"/staffPinByUid/"+encodeURIComponent(uid));
  if(oldHash&&oldHash!==hash)await db(env,"/staffPins/"+oldHash,{method:"DELETE"});
  const now=new Date().toISOString(),saved={...profile,authUid:uid,authProvider:profile.role==="admin"&&profile.email?"password":"custom",password:"",pin:"",active:true,updatedAt:now};
  await db(env,"/staffPins/"+hash,{method:"PUT",body:JSON.stringify({uid,profileId:userId,role:saved.role,name:saved.name||"Empleado",active:true})});
  await db(env,"/staffPinByUid/"+encodeURIComponent(uid),{method:"PUT",body:JSON.stringify(hash)});
  await db(env,"/roles/"+encodeURIComponent(uid),{method:"PUT",body:JSON.stringify(saved.role)});
  await db(env,"/users/"+encodeURIComponent(userId),{method:"PUT",body:JSON.stringify(saved)});
  if(userId!=="auth-"+uid){
    await db(env,"/users/auth-"+encodeURIComponent(uid),{method:"PUT",body:JSON.stringify({...saved,id:"auth-"+uid,legacyProfileId:userId,directoryHidden:true})});
  }
  const rateKey=await pinKey(env,'rate:'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  await db(env,'/pinLimits/'+rateKey,{method:'DELETE'});
  return json({ok:true,userId,profile:{id:userId,name:saved.name,role:saved.role,photoURL:saved.photoURL||""}});
}
function hondurasDayFromIso(value) {
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return "";
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Tegucigalpa",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
async function operationalSettings(request, env) {
  const {role}=await requireStaff(request,env,["admin","cashier"]);
  const data=await body(request), action=String(data.action||"");
  if(action==="preparation"){
    const minutes=data.minutes;
    if(!Number.isInteger(minutes)||minutes<1||minutes>240)return json({error:"El tiempo debe ser un número entero entre 1 y 240 minutos."},400);
    await db(env,"/settings/waitMin",{method:"PUT",body:JSON.stringify(minutes)});
    return json({ok:true,waitMin:minutes,changedByRole:role});
  }
  if(action!=="delivery") return json({error:"Ajuste no reconocido."},400);
  const value=data.enabled===true;
  await db(env,"/settings/deliveryEnabled",{method:"PUT",body:JSON.stringify(value)});
  return json({ok:true,deliveryEnabled:value,changedByRole:role});
}
function shiftEmailHtml(shift, totals, orders) {
  const rows=orders.map(o=>`<tr><td>${escapeEmail(o.code||o.id)}</td><td>${escapeEmail(o.customerName||"Cliente")}</td><td>${escapeEmail(o.payment||"")}</td><td style="text-align:right">${amount(o.total)}</td></tr>`).join("");
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#191919"><h2>Cierre de turno · El Chingadazo</h2><p><b>Empleado:</b> ${escapeEmail(shift.userName||shift.userId)}<br><b>Apertura:</b> ${hnDateTime(shift.openedAt)}<br><b>Cierre:</b> ${hnDateTime(shift.closedAt)}</p><table cellpadding="7" cellspacing="0" border="1" style="border-collapse:collapse"><tr><td>Transacciones</td><td>${totals.n}</td></tr><tr><td>Venta total</td><td>${amount(totals.sales)}</td></tr><tr><td>Efectivo</td><td>${amount(totals.cash)}</td></tr><tr><td>Tarjeta</td><td>${amount(totals.card)}</td></tr><tr><td>Transferencia</td><td>${amount(totals.transfer)}</td></tr><tr><td>Fondo inicial</td><td>${amount(shift.fondo)}</td></tr><tr><td>Efectivo esperado</td><td>${amount(shift.expected)}</td></tr><tr><td>Efectivo contado</td><td>${shift.arqueoPending?"Pendiente de arqueo":amount(shift.counted)}</td></tr><tr><td>Diferencia</td><td>${shift.arqueoPending?"Pendiente":amount(shift.diff)}</td></tr></table><p><b>Nota:</b> ${escapeEmail(shift.note||"Sin nota")}</p><h3>Detalle de transacciones</h3><table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;width:100%"><thead><tr><th>Orden</th><th>Cliente</th><th>Pago</th><th>Total</th></tr></thead><tbody>${rows||"<tr><td colspan=4>Sin ventas</td></tr>"}</tbody></table></body></html>`;
}
function escapeEmail(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function sendShiftEmail(env, to, shift, totals, orders) {
  if(!env.RESEND_API_KEY) return {status:"pending_configuration",error:"Falta configurar RESEND_API_KEY."};
  if (!env.SHIFT_REPORT_FROM || !to) return {status:"pending_configuration",error:"Falta configurar remitente o destinatario de El Chingadazo."};
  const from=env.SHIFT_REPORT_FROM;
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject:`Cierre ${shift.userName||"turno"} · ${hondurasDayFromIso(shift.closedAt)}`,html:shiftEmailHtml(shift,totals,orders)})});
  const payload=await res.json().catch(()=>({}));
  return res.ok?{status:"sent",id:payload.id||""}:{status:"failed",error:payload.message||`Correo ${res.status}`};
}
async function closeShiftSecure(request, env) {
  const {actor,profile,role}=await requireStaff(request,env,["admin","cashier"]),data=await body(request);
  const shiftId=String(data.shiftId||"").trim(),counted=Number(data.counted),note=String(data.note||"").trim().slice(0,500);
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(shiftId)||!Number.isFinite(counted)||counted<0)return json({error:"Datos del cierre inválidos."},400);
  const before=await db(env,"/shifts/"+encodeURIComponent(shiftId));
  if(!before||before.testArchivedAt||(before.userId!==actor&&role!=="admin"))return json({error:"El turno no existe o pertenece a otra persona."},409);
  if(before.closedAt){
    if(!before.arqueoPending)return json({shift:before,alreadyClosed:true});
    const shift=await mutateDb(env,"/shifts/"+encodeURIComponent(shiftId),current=>{
      if(!current||current.testArchivedAt)throw Object.assign(new Error("Turno archivado."),{status:409});
      if(!current.arqueoPending)return current;
      return {...current,counted,diff:Math.round((counted-Number(current.expected||0))*100)/100,arqueoPending:false,reconciledBy:actor,reconciledAt:new Date().toISOString(),reconciliationNote:note};
    });
    return json({shift,reconciled:true});
  }
  if(shiftExpired(before)){await createShiftMaintenance({db,mutateDb}).expire(env);return json({shift:await db(env,"/shifts/"+encodeURIComponent(shiftId)),alreadyClosed:true});}
  const all=Object.values((await db(env,"/orders"))||{}),from=Date.parse(before.openedAt),closedAt=new Date().toISOString(),to=Date.parse(closedAt);
  const orders=all.filter(o=>o&&o.status!=="cancelado"&&o.paidAt&&Date.parse(o.paidAt)>=from&&Date.parse(o.paidAt)<=to&&(o.shiftId===shiftId||(!o.shiftId&&o.paidBy===before.userId)));
  const sum=xs=>xs.reduce((a,o)=>a+Number(o.total||0),0),cash=sum(orders.filter(o=>o.payment==="Efectivo")),card=sum(orders.filter(o=>o.payment==="Tarjeta")),transfer=sum(orders.filter(o=>o.payment==="Transferencia"));
  const totals={n:orders.length,cash,card,transfer,sales:cash+card+transfer},expected=Number(before.fondo||0)+cash;
  let shift={...before,userName:before.userName||profile?.name||"Empleado",closedAt,closedBy:actor,counted,expected,diff:counted-expected,n:totals.n,sales:totals.sales,cash,card,transfer,note,emailStatus:"sending",emailTo:""};
  let applied=false;
  shift=await mutateDb(env,"/shifts/"+encodeURIComponent(shiftId),current=>{
    applied=false;if(!current||current.closedAt||current.testArchivedAt)return current;
    applied=true;return {...current,...shift};
  });
  if(!applied)return json({shift,alreadyClosed:true});
  const settings=(await db(env,"/settings"))||{},toEmail=env.SHIFT_REPORT_TO||settings.shiftReportEmail||"";
  const email=await sendShiftEmail(env,toEmail,shift,totals,orders).catch(error=>({status:"failed",error:error.message}));
  shift={...shift,emailStatus:email.status,emailId:email.id||"",emailError:email.error||"",emailTo:toEmail,emailUpdatedAt:new Date().toISOString()};
  shift=await mutateDb(env,"/shifts/"+encodeURIComponent(shiftId),current=>current?.testArchivedAt?current:{...current,emailStatus:email.status,emailId:email.id||"",emailError:email.error||"",emailTo:toEmail,emailUpdatedAt:new Date().toISOString()});
  return json({shift,email});
}
async function retryShiftEmail(request,env){
  const {actor,role}=await requireStaff(request,env,["admin","cashier"]),data=await body(request),shiftId=String(data.shiftId||"");
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(shiftId))return json({error:"Turno inválido."},400);
  let shift=await db(env,"/shifts/"+encodeURIComponent(shiftId));
  if(!shift?.closedAt||(role!=="admin"&&shift.userId!==actor))return json({error:"Cierre no autorizado."},403);
  const orders=Object.values((await db(env,"/orders"))||{}).filter(o=>o&&!o.testArchivedAt&&o.status!=="cancelado"&&o.paidAt&&Date.parse(o.paidAt)>=Date.parse(shift.openedAt)&&Date.parse(o.paidAt)<=Date.parse(shift.closedAt)&&(o.shiftId===shiftId||(!o.shiftId&&o.paidBy===shift.userId)));
  const totals={n:Number(shift.n||orders.length),cash:Number(shift.cash||0),card:Number(shift.card||0),transfer:Number(shift.transfer||0),sales:Number(shift.sales||0)};
  const settings=(await db(env,"/settings"))||{},toEmail=env.SHIFT_REPORT_TO||settings.shiftReportEmail||"",email=await sendShiftEmail(env,toEmail,shift,totals,orders).catch(error=>({status:"failed",error:error.message}));
  shift={...shift,emailStatus:email.status,emailId:email.id||shift.emailId||"",emailError:email.error||"",emailTo:toEmail,emailUpdatedAt:new Date().toISOString()};
  shift=await mutateDb(env,"/shifts/"+encodeURIComponent(shiftId),current=>current?.testArchivedAt?current:{...current,emailStatus:email.status,emailId:email.id||current?.emailId||"",emailError:email.error||"",emailTo:toEmail,emailUpdatedAt:new Date().toISOString()});
  return json({shift,email});
}
async function updateStaffPhoto(request,env){
  await requireStaff(request,env,["admin"]);const data=await body(request),userId=String(data.userId||""),photoURL=String(data.photoURL||"");
  if(!/^auth-[A-Za-z0-9_-]{1,150}$/.test(userId))return json({error:"Empleado inválido."},400);
  if(photoURL&&(!/^data:image\/(jpeg|png|webp);base64,/i.test(photoURL)||photoURL.length>260000))return json({error:"La foto es demasiado grande."},400);
  const profile=await db(env,"/users/"+encodeURIComponent(userId));if(!profile||!["admin","cashier","kitchen"].includes(profile.role))return json({error:"Empleado no encontrado."},404);
  const saved={...profile,photoURL,updatedAt:new Date().toISOString()};await db(env,"/users/"+encodeURIComponent(userId),{method:"PUT",body:JSON.stringify(saved)});return json({profile:saved});
}
function analyticsLimited(request) {
  const ip=request.headers.get("CF-Connecting-IP")||"unknown", now=Date.now();
  const row=analyticsAttempts.get(ip)||{n:0,until:now+10*60*1000};
  if(now>row.until){row.n=0;row.until=now+10*60*1000;}
  row.n+=1;analyticsAttempts.set(ip,row);return row.n>80;
}
async function recordFunnel(request,env) {
  if(analyticsLimited(request)) return json({ok:true});
  const data=await body(request), event=String(data.event||"");
  if(!FUNNEL_EVENTS.has(event)) return json({error:"Evento inválido."},400);
  const device=["mobile","desktop"].includes(data.device)?data.device:"other";
  const mode=["browser","installed"].includes(data.mode)?data.mode:"browser";
  const day=hondurasDay();
  await mutateDb(env,`/analytics/${day}`,current=>{
    const next=current&&typeof current==="object"?current:{};
    next.events=next.events&&typeof next.events==="object"?next.events:{};
    next.devices=next.devices&&typeof next.devices==="object"?next.devices:{};
    next.modes=next.modes&&typeof next.modes==="object"?next.modes:{};
    next.events[event]=Number(next.events[event]||0)+1;
    next.devices[device]=Number(next.devices[device]||0)+1;
    next.modes[mode]=Number(next.modes[mode]||0)+1;
    next.updatedAt=new Date().toISOString();
    return next;
  },5,true);
  return json({ok:true});
}
async function funnelReport(request,env) {
  await requireStaff(request,env,["admin"]);
  const meta=await db(env,"/analytics/_meta")||{};
  const days=Array.from({length:14},(_,i)=>hondurasDay(i-13));
  const rows=await Promise.all(days.map(async day=>({day,...((await db(env,"/analytics/"+day))||{})})));
  const finalMeta=await db(env,"/analytics/_meta")||{};
  if((finalMeta.resetId||"initial")!==(meta.resetId||"initial"))return json({error:"La medición se reinició. Vuelve a abrir este reporte."},409);
  return json({days:rows,resetId:meta.resetId||"initial",resetAt:meta.resetAt||null,privacy:"Conteos agregados; no se guardan nombres, correos, DNI, teléfonos, direcciones ni ubicación."});
}
async function resetFunnel(request,env) {
  const staff=await requireStaff(request,env,["admin"]),input=await body(request);
  if(input.confirmation!=="REINICIAR METRICAS" || !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId||""))return json({error:"Confirmación de reinicio inválida."},400);
  const resetId=crypto.randomUUID(),resetAt=new Date().toISOString();
  const saved=await mutateDb(env,"/analytics",current=>{
    current=current&&typeof current==='object'?current:{};
    const meta=current._meta||{};
    if(meta.requestId===input.requestId)return current;
    if((meta.resetId||'initial')!==input.expectedResetId)throw Object.assign(new Error('La medición cambió. Actualiza la pantalla antes de reiniciar.'),{status:409});
    const days={},next={...current};
    for(const key of Object.keys(current))if(/^\d{4}-\d{2}-\d{2}$/.test(key)){days[key]=current[key];delete next[key];}
    next._archives={...(current._archives||{}),[resetId]:{days,from:meta.resetAt||null,archivedAt:resetAt,archivedBy:staff.actor}};
    next._meta={resetId,resetAt,requestId:input.requestId,resetBy:staff.actor};
    return next;
  },5,true);
  return json({ok:true,resetId:saved._meta.resetId,resetAt:saved._meta.resetAt});
}
async function uploadDriverDocument(env, objectName, bytes, mime) {
  if (!env.DRIVER_DOCS) throw Object.assign(new Error("Falta crear el almacenamiento privado DRIVER_DOCS en Cloudflare."), { status: 503 });
  await env.DRIVER_DOCS.put(objectName, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "private, no-store" },
    customMetadata: { private: "true", purpose: "driver-verification" }
  });
  return { key: objectName };
}
async function driverDocumentExists(env,key) {
  if(!env.DRIVER_DOCS) throw Object.assign(new Error("El almacenamiento de documentos no está configurado."),{status:503});
  return !!(await env.DRIVER_DOCS.head(key));
}
async function readDriverDocument(env, objectName) {
  if (!env.DRIVER_DOCS) return json({ error: "Falta configurar el almacenamiento privado." }, 503);
  const object = await env.DRIVER_DOCS.get(objectName);
  if (!object) return json({ error: "Documento no disponible." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
async function computeDeliveryRoute(env, origin, destination) {
  if (!env.GOOGLE_ROUTES_API_KEY) return null;
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_ROUTES_API_KEY,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: "TWO_WHEELER", routingPreference: "TRAFFIC_AWARE", languageCode: "es-419", units: "METRIC"
    })
  });
  if (!res.ok) return null;
  const data = await res.json(); const route = data.routes && data.routes[0];
  if (!route) return null;
  return { distanceKm: Number(route.distanceMeters || 0) / 1000, durationMin: Number(String(route.duration || "0s").replace("s", "")) / 60,
    polyline: route.polyline?.encodedPolyline || "" };
}
async function staticDeliveryMap(request, env, orderId) {
  if(!env.GOOGLE_ROUTES_API_KEY) return json({error:"Google Maps todavía no está configurado."},503);
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const user=await verifyFirebaseUser(token), actor="auth-"+user.localId;
  const [role,order,trip,settings]=await Promise.all([db(env,"/roles/"+encodeURIComponent(user.localId)),db(env,"/orders/"+encodeURIComponent(orderId)),db(env,"/deliveries/"+encodeURIComponent(orderId)),db(env,"/settings")]);
  if(!order||!trip)return json({error:"Ruta no disponible."},404);
  if(role!=="admin"&&trip.driverId!==actor&&order.userId!==actor)return json({error:"Ruta no autorizada."},403);
  const params=new URLSearchParams({size:"640x360",scale:"2",maptype:"roadmap",language:"es",key:env.GOOGLE_ROUTES_API_KEY});
  params.append("markers",`color:0xffc400|label:R|${Number(settings?.restaurantLat)},${Number(settings?.restaurantLng)}`);
  params.append("markers",`color:0x111111|label:C|${Number(order.deliveryLat)},${Number(order.deliveryLng)}`);
  const poly=["accepted","heading_pickup"].includes(trip.status)?trip.pickupRoutePolyline:trip.routePolyline;
  if(poly)params.append("path",`weight:6|color:0xffc400ff|enc:${poly}`);
  if((role==="admin"||trip.driverId===actor||["picked_up","delivered"].includes(trip.status))&&trip.location?.lat)params.append("markers",`color:0x00c978|label:M|${trip.location.lat},${trip.location.lng}`);
  const res=await fetch("https://maps.googleapis.com/maps/api/staticmap?"+params);
  if(!res.ok)return json({error:"Activa Maps Static API para mostrar el mapa."},502);
  return new Response(res.body,{headers:{"Content-Type":res.headers.get("Content-Type")||"image/png","Cache-Control":"private, max-age=20","X-Content-Type-Options":"nosniff"}});
}
async function staffMe(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await verifyFirebaseUser(token);
  const role = await db(env, "/roles/" + encodeURIComponent(user.localId));
  if (!role || !["admin", "cashier", "kitchen"].includes(role)) return json({ error: "Esta cuenta no tiene acceso de personal." }, 403);
  const id = "auth-" + user.localId;
  const stored = await db(env, "/users/" + encodeURIComponent(id));
  if (stored?.active === false) return json({error:"Usuario desactivado."},403);
  return json({ ...(stored || { id, authUid: user.localId, authProvider: "password", name: user.displayName || user.email || "Administrador", email: user.email || "", phone: "", dni: "", points: 0, addresses: [] }), role, password:"", pin:"" });
}
async function authorizeDevice(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = await verifyFirebaseUser(token);
  const role = await db(env, "/roles/" + encodeURIComponent(admin.localId));
  if (role !== "admin") return json({ error: "Solo un administrador puede autorizar este dispositivo." }, 403);
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  const value = payload + "." + await deviceSignature(env, payload);
  return new Response(JSON.stringify({ ok: true, expires }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `chingadazo_staff_device=${encodeURIComponent(value)}; Max-Age=2592000; Path=/api/; HttpOnly; Secure; SameSite=Strict`
    }
  });
}
async function provision(request, env) {
  await requireStaff(request, env, ["admin"]);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = await verifyFirebaseUser(token);
  const adminRole = await db(env, "/roles/" + encodeURIComponent(admin.localId));
  if (adminRole !== "admin") return json({ error: "Solo un administrador puede crear empleados." }, 403);
  const data = await body(request);
  const pin = String(data.pin || ""); const role = String(data.role || ""); const name = String(data.name || "").trim();
  if (!/^\d{6}$/.test(pin)) return json({ error: "El PIN debe tener exactamente 6 números." }, 400);
  if (!name || name.length > 100 || /[<>\x00-\x1f]/.test(name) || !["admin", "cashier", "kitchen"].includes(role)) return json({ error: "Nombre o rol inválido." }, 400);
  const uid = String(data.uid || ("staff-" + crypto.randomUUID().replace(/-/g, ""))).slice(0, 120);
  let authRecord = null;
  if (role === "admin" && data.uid) {
    authRecord = await firebaseUserByUid(env, uid);
    if (!authRecord) return json({ error: "Ese UID no existe en Firebase Authentication." }, 404);
  }
  const hash = await pinKey(env, pin);
  if (await db(env, "/staffPins/" + hash)) return json({ error: "Ese PIN ya pertenece a otro empleado." }, 409);
  const id = "auth-" + uid; const now = new Date().toISOString();
  const previous = await db(env, "/users/" + encodeURIComponent(id));
  const photo = String(data.photoURL || "");
  if (photo && (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo) || photo.length > 260000)) return json({ error: "La foto debe ser JPG, PNG o WebP y pesar menos de 190 KB." }, 400);
  const profile = {
    ...(previous && typeof previous === "object" ? previous : {}),
    id, authUid: uid, authProvider: authRecord ? "password" : "custom", role, name,
    email: (previous && previous.email) || (authRecord && authRecord.email) || "",
    phone: (previous && previous.phone) || "", dni: (previous && previous.dni) || "",
    points: Number((previous && previous.points) || 0),
    addresses: (previous && previous.addresses) || [], password: "", pin: "", active: true,
    photoURL: photo || (previous && previous.photoURL) || "",
    createdAt: (previous && previous.createdAt) || now, updatedAt: now
  };
  // Commit access, profile and PIN together; concurrent creations cannot claim the same PIN.
  await mutateDb(env, '', current => {
    if (current?.roles?.[admin.localId] !== 'admin' || current.users?.['auth-'+admin.localId]?.active === false) throw Object.assign(new Error('Acceso no autorizado.'),{status:403});
    if (current.staffPins?.[hash]) throw Object.assign(new Error('Ese PIN ya pertenece a otro empleado.'),{status:409});
    const oldHash=current.staffPinByUid?.[uid];
    if(oldHash && current.staffPins?.[oldHash]?.uid===uid)delete current.staffPins[oldHash];
    (current.staffPins ||= {})[hash]={uid,role,name,active:true};
    (current.staffPinByUid ||= {})[uid]=hash;
    (current.roles ||= {})[uid]=role;
    (current.users ||= {})[id]=profile;
    return current;
  });
  return json({ profile });
}
async function login(request, env) {
  if (!await authorizedDevice(request, env)) return json({ error: "Este dispositivo no ha sido autorizado por un administrador." }, 403);
  const rateKey=await pinKey(env,'rate:'+(request.headers.get('CF-Connecting-IP') || 'unknown'));
  const rate=await db(env,'/pinLimits/'+rateKey),now=Date.now();
  if (rate&&rate.until>now&&rate.n>=8) return json({ error: "Demasiados PIN incorrectos. Espera 10 minutos o entra como administrador con correo." }, 429);
  const data = await body(request); const pin = String(data.pin || "");
  if (!/^\d{6}$/.test(pin)) return json({ error: "Escribe los 6 números del PIN." }, 400);
  const record = await db(env, "/staffPins/" + await pinKey(env, pin));
  if (!record || record.active !== true) {
    await mutateDb(env,'/pinLimits/'+rateKey,r=>{
      const at=Date.now();if(!r||r.until<at)r={n:0,until:at+600000};r.n+=1;return r;
    },5,true);
    return json({ error: "PIN incorrecto." }, 401);
  }
  if(rate)await db(env,'/pinLimits/'+rateKey,{method:'DELETE'});
  const profileId=String(record.profileId||("auth-"+record.uid));
  const profile = await db(env, "/users/" + encodeURIComponent(profileId));
  if (!profile || profile.active === false) return json({ error: "Usuario desactivado." }, 403);
  const currentRole=await db(env,'/roles/'+encodeURIComponent(record.uid));
  if(!['admin','cashier','kitchen'].includes(currentRole))return json({error:'Rol desactivado.'},403);
  profile.role=currentRole;profile.password='';profile.pin='';
  const token = await customToken(env, record.uid, profile);
  return json({ token, profile });
}
async function changeOrderStatus(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await verifyFirebaseUser(token);
  const role = await db(env, "/roles/" + encodeURIComponent(user.localId));
  if (!["admin", "cashier", "kitchen"].includes(role)) return json({ error: "Esta cuenta no pertenece al personal." }, 403);
  const data = await body(request);
  const id = String(data.id || "").trim();
  const status = String(data.status || "").trim();
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || !["nuevo", "preparacion", "listo", "camino", "entregado", "cancelado"].includes(status)) return json({ error: "Orden o estado inválido." }, 400);
  const profile=await db(env,'/users/auth-'+user.localId);
  if(profile?.active===false)return json({error:'Usuario desactivado.'},403);
  if (status === "cancelado" && role !== "admin") return json({ error: "Solo un administrador puede cancelar una orden." }, 403);
  if (role === "kitchen" && !["preparacion","listo"].includes(status)) return json({error:"Cocina solo puede preparar y marcar listo."},403);
  const before = await db(env, "/orders/" + encodeURIComponent(id));
  if (!before) return json({ error: "La orden ya no existe." }, 404);
  if (before.type === "delivery" && status === "entregado") {
    return json({ error: "En delivery, solamente el repartidor asignado puede confirmar ‘Entregado al cliente’. Caja únicamente confirma la entrega del paquete al repartidor." }, 409);
  }
  if (before.type === "delivery" && status === "camino") {
    const at = new Date().toISOString();
    await mutateDb(env, "/deliveries/" + encodeURIComponent(id), current => {
      if (!current?.driverId) throw Object.assign(new Error("Primero un repartidor debe aceptar la orden."), { status: 409 });
      if (current.status === "delivered") return current;
      if (!["accepted", "heading_pickup", "picked_up"].includes(current.status)) throw Object.assign(new Error("La entrega no está lista para entregarse al repartidor."), { status: 409 });
      return current.status === "picked_up" ? current : { ...current, status: "picked_up", pickedUpAt: at, handedOffAt: at, handedOffBy: "auth-" + user.localId, updatedAt: at, revision: crypto.randomUUID() };
    });
  }
  let paymentBlocked = false;
  const now = new Date().toISOString();
  const actor = "auth-" + user.localId;
  const order = await mutateDb(env, "/orders/" + encodeURIComponent(id), (o) => {
    paymentBlocked = false;
    if (["entregado", "facturada", "cancelado"].includes(o.status)) return o;
    if (status === "entregado" && (!o.invoiced || !o.paidAt)) {
      paymentBlocked = true;
      if (o.source === "app" || o.channel === "app") {
        o.cashierRequestedAt = o.cashierRequestedAt || now;
        o.cashierRequestedBy = o.cashierRequestedBy || actor;
        o.updatedAt = now;
      }
      return o;
    }
    const rank = {programado:0,nuevo:1,preparacion:2,listo:3,camino:4,entregado:5};
    if (status !== "cancelado" && (rank[status] || 0) < (rank[o.status] || 0)) return o;
    o.status = status;
    o.revision = crypto.randomUUID();
    o.statusAt = now;
    o.statusBy = actor;
    o.updatedAt = now;
    if (status === "preparacion" && !o.receivedAt) {
      o.receivedAt = now;
      o.receivedBy = actor;
    }
    if (status === "entregado") {
      o.deliveredAt = o.deliveredAt || now;
      o.deliveredBy = actor;
    }
    return o;
  });
  if (paymentBlocked) return json({ error: "CONTROL DE CAJA: falta confirmar el pago y facturar. La orden fue enviada a Caja.", order }, 409);
  await access.award(env,order);
  const statusText={nuevo:"recibido",preparacion:"en preparación",listo:"listo",camino:"en camino",entregado:"entregado",cancelado:"cancelado"}[order.status]||order.status;
  await push.notifyCustomer(env,order,"Actualización de tu pedido",`${order.code||order.id} · ${statusText}`).catch(()=>null);
  return json({ order });
}
async function invoiceOrderSecure(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await verifyFirebaseUser(token);
  const role = await db(env, "/roles/" + encodeURIComponent(user.localId));
  if (!["admin", "cashier"].includes(role)) return json({ error: "Solo Caja o Administración pueden facturar." }, 403);
  const profile = await db(env, "/users/auth-" + encodeURIComponent(user.localId));
  if (profile?.active === false) return json({ error: "Usuario desactivado." }, 403);
  const data = await body(request);
  const id = String(data.id || "").trim();
  const payment = String(data.payment || "").trim();
  const shiftId = String(data.shiftId || "").trim();
  const payWith = Number(data.payWith || 0);
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) return json({ error: "Orden inválida." }, 400);
  if (!["Efectivo", "Tarjeta", "Transferencia"].includes(payment)) return json({ error: "Forma de pago inválida." }, 400);
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(shiftId)) return json({ error: "Abre tu turno antes de facturar." }, 409);
  if (!Number.isFinite(payWith) || payWith < 0) return json({ error: "Monto recibido inválido." }, 400);
  const actor = "auth-" + user.localId;
  const shift = await db(env, "/shifts/" + encodeURIComponent(shiftId));
  if (!shift || shift.closedAt || shiftExpired(shift) || shift.userId !== actor) return json({ error: "Tu turno no está abierto o pertenece a otro empleado." }, 409);
  let alreadyInvoiced = false;
  const order = await mutateDb(env, "/orders/" + encodeURIComponent(id), (current) => {
    if (!current) throw Object.assign(new Error("La orden ya no existe."), { status: 404 });
    if (current.status === "cancelado") throw Object.assign(new Error("Una orden cancelada no puede facturarse."), { status: 409 });
    alreadyInvoiced = !!(current.invoiced && current.paidAt);
    if (alreadyInvoiced) return current;
    if (payment === "Efectivo" && payWith < Number(current.total || 0)) {
      throw Object.assign(new Error("El efectivo recibido no cubre el total."), { status: 400 });
    }
    const now = new Date().toISOString();
    return {
      ...current,
      payment,
      paymentChannel: payment === "Tarjeta" ? "pos" : payment === "Transferencia" ? "transfer" : "cash",
      payWith: payment === "Efectivo" ? payWith : 0,
      needsChange: payment === "Efectivo" && payWith > Number(current.total || 0),
      cashReceivedFrom: payment === "Efectivo" ? (current.type === "delivery" ? "driver" : "customer") : "",
      changeGiven: payment === "Efectivo" ? Math.max(0, payWith - Number(current.total || 0)) : 0,
      paidAt: current.paidAt || now,
      paidBy: current.paidBy || actor,
      invoiced: true,
      invoicedAt: current.invoicedAt || now,
      invoicedBy: current.invoicedBy || actor,
      shiftId,
      updatedAt: now,
      revision: crypto.randomUUID()
    };
  });
  await access.award(env, order);
  if(!alreadyInvoiced) await manager.recordSale(env,order).catch(async(error)=>{
    const incidentId=`incident-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
    await db(env,`/managerIncidents/${incidentId}`,{method:"PUT",body:JSON.stringify({id:incidentId,type:"inventory",severity:"high",area:"Inventario",message:"No se pudo descontar automáticamente una venta: "+String(error.message||error).slice(0,300),referenceId:order.id,status:"open",createdAt:new Date().toISOString()})}).catch(()=>null);
  });
  if(!alreadyInvoiced) await push.notifyCustomer(env,order,"Pago confirmado",`${order.code||order.id} · Tu pago fue registrado correctamente.`).catch(()=>null);
  return json({ order, alreadyInvoiced });
}
async function mediaAsset(url, env) {
  const rawId = url.pathname.slice("/api/media/".length);
  if (!rawId || rawId.includes("/")) return new Response("Not found", { status: 404 });
  const id = decodeURIComponent(rawId);
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(id))return new Response('Not found',{status:404});
  const value = await db(env, "/media/" + encodeURIComponent(id));
  if (typeof value !== "string") return new Response("Not found", { status: 404 });
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match || !/^image\/(png|jpeg|webp|gif)$/.test(match[1])) return new Response("Invalid media", { status: 415 });
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function savePromotion(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await verifyFirebaseUser(token);
  if (await db(env, "/roles/" + encodeURIComponent(user.localId)) !== "admin") return json({ error: "Solo un administrador puede cambiar promociones." }, 403);
  const data = await body(request);
  const clean = (value, max) => {
    const s = String(value || "").trim();
    if (s.length > max || /[<>]/.test(s)) throw new Error("Texto inválido: no uses etiquetas HTML.");
    return s;
  };
  if (data.kind === "bonus") {
    const value = Number(data.value);
    if (!Number.isInteger(value) || value < 0 || value > 100000) return json({ error: "Escribe entre 0 y 100000 puntos." }, 400);
    await db(env, "/settings/welcomeBonus", { method: "PUT", body: JSON.stringify(value) });
    return json({ value });
  }
  if (!["promo", "blast"].includes(data.kind)) return json({ error: "Operación inválida." }, 400);
  const entry = {
    id: clean(data.id, 100) || crypto.randomUUID(), title: clean(data.title, 160),
    body: clean(data.body, 1500), at: new Date().toISOString(), updatedBy: user.localId
  };
  if (!entry.title || !entry.body) return json({ error: "Completa título y detalle." }, 400);
  if (data.kind === "promo") Object.assign(entry, { hours: clean(data.hours, 160), active: data.active !== false });
  const node = data.kind === "promo" ? "promos" : "blasts";
  await mutateDb(env, "/settings", (settings) => {
    const list = Array.isArray(settings[node]) ? settings[node] : Object.values(settings[node] || {});
    const index = list.findIndex(x => x.id === entry.id);
    if (data.kind === "promo" && index >= 0 && data.active === undefined) entry.active = list[index].active !== false;
    if (index < 0) list.push(entry); else list[index] = { ...list[index], ...entry };
    settings[node] = node === "blasts" ? list.slice(-20) : list;
    return settings;
  });
  const pushResult=data.kind==="blast" ? await push.notifyCustomers(env,entry.title,entry.body,entry.id) : null;
  return json({ entry, push: pushResult });
}

const push=typeof createPush==="function"?createPush({db,verifyFirebaseUser,json}):{notifyDrivers:async()=>{},notifyStaff:async()=>{},notifyCustomer:async()=>{},notifyCustomers:async()=>{},config:()=>json({enabled:false,vapidKey:""}),subscribe:()=>json({error:"Push no disponible."},503),test:()=>json({error:"Push no disponible."},503)};
const manager = createManager({ db, mutateDb, verifyFirebaseUser, json, readBody: body });
const access = createAccess({db,mutateDb,verifyFirebaseUser,json,isShiftExpired:shiftExpired,expireShifts:env=>createShiftMaintenance({db,mutateDb}).expire(env),computeRoute:computeDeliveryRoute,onOrderCreated:async(env,order)=>{
  const tasks=[push.notifyDrivers(env,order),push.notifyStaff(env,order)];
  if(order?.invoiced&&order?.paidAt)tasks.push(manager.recordSale(env,order));
  return Promise.allSettled(tasks);
}});
const delivery = createDelivery({ db, mutateDb, verifyFirebaseUser, json, readBody: body,
  uploadDocument: uploadDriverDocument, readDocument: readDriverDocument, documentExists: driverDocumentExists, notifyDriverApproved: push.notifyDriverApproved, computeRoute: computeDeliveryRoute,
  awardOrder: access.award, notifyCustomer: push.notifyCustomer });
const family = createFamily({ db, mutateDb, verifyFirebaseUser, json });
const diningCheckout=()=>createDiningCheckout({db,mutateDb,isShiftExpired:shiftExpired,recordSale:manager.recordSale});
const payerGame = createPayerGame({ db, mutateDb, verifyFirebaseUser, json });
const chupisticaGame = createChupisticaGame({ db, mutateDb, verifyFirebaseUser, json });
export default {
  async scheduled(event,env){
    if (!instance.configured) return;
    assertInstance(env);
    if(event.cron==='*/5 * * * *'){
      if(env.DINING_CONSUMPTIONS_ENABLED==='true')await diningCheckout().reconcile(env);
      return;
    }
    if (event.cron === '0 9 * * *') {
      if (env.BACKUP_DAILY_ENABLED === 'true') await createBackupService({ db, mutateDb, identity: access.identity, json }).run(env);
      return;
    }
    const tasks=[cleanupStoryProofs(env),delivery.flushApprovalPushes(env)];
    if(event.cron==='0 5 * * *')tasks.push(createShiftMaintenance({db,mutateDb}).expire(env));
    const results=await Promise.allSettled(tasks);
    if(results.some(r=>r.status==='rejected'))throw new Error('Falló una tarea programada de mantenimiento.');
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    // Never disclose project internals, even if a future asset configuration is changed.
    const blockedPaths = [
      "/server/", "/tests/", "/scripts/", "/internal/", "/.git/", "/.github/"
    ];
    const blockedFiles = new Set([
      "/wrangler.jsonc", "/firebase-rules.production.json",
      "/README.md", "/.assetsignore", "/DESPLEGAR-CLOUDFLARE.bat",
      "/CONFIGURAR-NOTIFICACIONES-PUSH.bat", "/CONFIGURAR-GOOGLE-MAPS.bat",
      "/CONFIGURAR-GERENTE-IA.bat", "/REPARAR-CUENTA-SERVICIO-PUSH.bat"
    ]);
    if (blockedPaths.some((prefix) => url.pathname.startsWith(prefix)) ||
        blockedFiles.has(url.pathname) || /^\/(?:INSTALAR|PRUEBAS|REVISION|PROGRAMA)-/i.test(url.pathname)) {
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
    }
    try {
      if (url.pathname.startsWith('/api/') && request.method !== 'GET' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({error:'Origen no autorizado.'},403);
      if (url.pathname.startsWith('/api/')) assertInstance(env);
      if (url.pathname === '/api/backups') return await createBackupService({ db, mutateDb, identity: access.identity, json }).handle(request, env);
      if (['/api/dining','/api/dining/kitchen'].includes(url.pathname)) return await createDining({db,mutateDb,identity:access.identity,json,quoteItems:access.quoteItems,checkout:diningCheckout(),consumptionsEnabled:env.DINING_CONSUMPTIONS_ENABLED==='true'}).handle(request,env);
      if (url.pathname === '/api/test-reset') return await createTestReset({db,mutateDb,identity:access.identity,json,expireShifts:()=>createShiftMaintenance({db,mutateDb}).expire(env)}).handle(request,env);
      if (url.pathname === '/api/finance') return await createFinance({db,identity:access.identity,json}).handle(request,env);
      if (url.pathname === '/api/staff-manage' && request.method === 'POST') return await createUpdates({db,mutateDb,identity:access.identity,requireStaff,json}).staff(request,env);
      if (url.pathname === '/api/instagram-proof') return await createStoryProof({db,mutateDb,identity:access.identity}).handle(request,env);
      if (url.pathname === '/api/instagram-stories' && ['GET','POST'].includes(request.method)) return await createUpdates({db,mutateDb,identity:access.identity,requireStaff,json,proofInfo:(...args)=>createStoryProof({db,mutateDb,identity:access.identity}).info(...args)}).stories(request,env);
      if (url.pathname.startsWith('/api/data/')) return await access.route(request,env);
      if (url.pathname === "/api/analytics/event" && request.method === "POST") return await recordFunnel(request,env);
      if (url.pathname === "/api/analytics/reset" && request.method === "POST") return await resetFunnel(request,env);
      if (url.pathname === "/api/analytics/report" && request.method === "GET") return await funnelReport(request,env);
      if (url.pathname === "/api/family" && ["GET", "POST"].includes(request.method)) return await family.route(request, env);
      if (url.pathname === "/api/payer-game" && ["GET", "POST"].includes(request.method)) return await payerGame.route(request, env);
      if (url.pathname === "/api/chupistica" && ["GET", "POST"].includes(request.method)) return await chupisticaGame.route(request, env);
      if (url.pathname === "/api/manager/overview" && request.method === "GET") return await manager.overview(request, env, url);
      if (url.pathname === "/api/manager/costs" && request.method === "POST") return await manager.saveCost(request, env);
      if (url.pathname === "/api/manager/decision" && request.method === "POST") return await manager.decision(request, env);
      if (url.pathname === "/api/manager/ask" && request.method === "POST") return await manager.ask(request, env);
      if (url.pathname === "/api/manager/telemetry" && request.method === "POST") return await manager.telemetry(request, env);
      if (url.pathname === "/api/manager/incident" && request.method === "POST") return await manager.incidentAction(request, env);
      if (url.pathname === "/api/admin-promotion" && request.method === "POST") return await savePromotion(request, env);
      if (url.pathname === "/api/staff-login" && request.method === "POST") return await login(request, env);
      if (url.pathname === "/api/staff-authorize" && request.method === "POST") return await authorizeDevice(request, env);
      if (url.pathname === "/api/staff-provision" && request.method === "POST") return await provision(request, env);
      if (url.pathname === "/api/staff-pin" && request.method === "POST") return await resetStaffPin(request, env);
      if (url.pathname === "/api/staff-me" && request.method === "GET") return await staffMe(request, env);
      if (url.pathname === "/api/staff-directory" && request.method === "GET") return await staffDirectory(request, env);
      if (url.pathname === "/api/operations/settings" && request.method === "POST") return await operationalSettings(request, env);
      if (url.pathname === "/api/close-shift" && request.method === "POST") return await closeShiftSecure(request, env);
      if (url.pathname === "/api/resend-shift-report" && request.method === "POST") return await retryShiftEmail(request, env);
      if (url.pathname === "/api/staff-photo" && request.method === "POST") return await updateStaffPhoto(request, env);
      if (url.pathname === "/api/invoice-order" && request.method === "POST") return await invoiceOrderSecure(request, env);
      if (url.pathname === "/api/order-status" && request.method === "POST") return await changeOrderStatus(request, env);
      if (url.pathname === "/api/delivery/quote" && request.method === "POST") return await access.quoteDelivery(request, env);
      if (url.pathname === "/api/delivery/profile" && ["GET", "POST"].includes(request.method)) return await delivery.profile(request, env);
      if (url.pathname === "/api/delivery/document" && request.method === "POST") return await delivery.documentUpload(request, env, url);
      if (url.pathname === "/api/delivery/orders" && request.method === "GET") return await delivery.orders(request, env);
      if (url.pathname === "/api/delivery/accept" && request.method === "POST") return await delivery.accept(request, env);
      if (url.pathname === "/api/delivery/reject" && request.method === "POST") return await delivery.rejectOffer(request, env);
      if (url.pathname === "/api/delivery/avatar" && request.method === "GET") return await delivery.avatar(request, env);
      if (url.pathname === "/api/delivery/location" && request.method === "POST") return await delivery.location(request, env);
      if (url.pathname === "/api/delivery/status" && request.method === "POST") return await delivery.status(request, env);
      if (url.pathname === "/api/delivery/push-config" && request.method === "GET") return push.config(env);
      if (url.pathname === "/api/delivery/push-subscribe" && request.method === "POST") { const result=await push.subscribe(request,env); await delivery.retryApprovalPush(request,env).catch(()=>{}); return result; }
      if (url.pathname === "/api/delivery/push-test" && request.method === "POST") return await push.test(request,env);
      if (url.pathname === "/api/push-config" && request.method === "GET") return push.config(env);
      if (url.pathname === "/api/push-subscribe" && request.method === "POST") return await push.subscribe(request,env);
      if (url.pathname === "/api/push-test" && request.method === "POST") return await push.test(request,env);
      if (url.pathname.startsWith("/api/delivery/map/") && request.method === "GET") return await staticDeliveryMap(request,env,decodeURIComponent(url.pathname.slice("/api/delivery/map/".length)));
      if (url.pathname === "/api/delivery/rating" && request.method === "POST") return await delivery.rating(request, env);
      if (url.pathname === "/api/delivery/admin" && ["GET", "POST"].includes(request.method)) return await delivery.admin(request, env);
      if (url.pathname.startsWith("/api/delivery/track/") && request.method === "GET") return await delivery.track(request, env, decodeURIComponent(url.pathname.slice("/api/delivery/track/".length)));
      if (url.pathname.startsWith("/api/delivery/document/") && request.method === "GET") {
        const parts = url.pathname.slice("/api/delivery/document/".length).split("/").map(decodeURIComponent);
        if (parts.length === 2) return await delivery.documentRead(request, env, parts[0], parts[1]);
      }
      if (url.pathname.startsWith("/api/delivery/proof/") && request.method === "GET") return await delivery.proofRead(request, env, decodeURIComponent(url.pathname.slice("/api/delivery/proof/".length)));
      if (url.pathname.startsWith("/api/media/") && request.method === "GET") return await mediaAsset(url, env);
    } catch (error) { return json({ error: error.message || "Error interno." }, error.status || 500); }
    if (url.pathname.startsWith('/api/')) return json({error:'Ruta no disponible.'},404);
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/" && url.searchParams.has("personal")) {
      return Response.redirect(new URL("/personal", url.origin), 308);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
      const assetUrl=new URL("/index.html",url.origin);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/personal" || url.pathname === "/personal/")) {
      const assetUrl=new URL("/personal.html",url.origin);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/delivery" || url.pathname === "/delivery/")) {
      const assetUrl=new URL("/delivery/index.html",url.origin);
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    return env.ASSETS.fetch(request);
  }
};
