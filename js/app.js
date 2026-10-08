const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => "L. " + Number(n || 0).toFixed(0);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (iso) => new Date(iso).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" });
const IS_STANDALONE = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const PERSONAL_QUERY = new URLSearchParams(location.search).has("personal");
const PERSONAL_PATH = /^\/personal(?:\/|\.html)?$/.test(location.pathname);
const STAFF_DEVICE_MODE = PERSONAL_PATH;
// El enlace anterior sigue funcionando, pero ya no comparte ni persiste el
// modo del personal dentro de la aplicación de clientes.
if (PERSONAL_QUERY && !PERSONAL_PATH) location.replace("/personal");
let deferredInstallPrompt = null;
let localAccount = null, localOperator = '', localGeneration = 0, localReady = false;
let localSignature = '', localMessage = '', localWork = Promise.resolve(), localSaving = 0;

function localDraft() {
  return { posTicket: STATE.posTicket, posName: STATE.posName, posPay: STATE.posPay, posPayWith: STATE.posPayWith, posChannel: STATE.posChannel,posDiningAccountId:STATE.posDiningAccountId||'',posDiningTableId:STATE.posDiningTableId||'',posDiningConfirmedOp:STATE.posDiningConfirmedOp||'' };
}
function localAccountMessage(message) {
  localMessage = message;
  const element = document.getElementById('localAccountStatus');
  if (element) element.textContent = message;
}
function syncLocalAccount() {
  if (!STAFF_DEVICE_MODE || !globalThis.ChingadazoContinuity) return;
  localAccount ||= ChingadazoContinuity.create();
  const operator = canCash() ? currentUser().id : '';
  if (operator !== localOperator) {
    localOperator = operator; localReady = false; localSignature = '';
    const generation = ++localGeneration;
    Object.assign(STATE, { posTicket: [], posName: '', posPay: 'Efectivo', posChannel: 'mostrador', posPayWith: '', pendingPosOrder: null, pendingPosId: null,posDiningAccountId:'',posDiningTableId:'',posDiningConfirmedOp:'' });
    localAccountMessage('Recuperando consumos guardados…');
    localWork = localWork.catch(() => {}).then(async () => {
      if (!operator) { await localAccount.close(); return; }
      const recovered = await localAccount.open(operator);
      if (generation !== localGeneration) return;
      if (recovered) Object.assign(STATE, ChingadazoContinuity.draft(recovered), { pendingPosOrder: recovered.pendingPosOrder || null, pendingPosId: recovered.pendingPosId || null });
      localReady = true; localSignature = JSON.stringify(localDraft());
      localAccountMessage(recovered?.pendingPosOrder ? 'Hay un intento de cobro sin conciliar. Consulta su resultado antes de continuar; no vuelvas a cobrar.' : recovered ? 'Consumos recuperados en este equipo. No implica envío a cocina.' : 'Guardado local preparado.');
      render();
    }).catch(() => { if (generation === localGeneration) { localAccountMessage('No se pudo abrir el guardado local. Cierra otras pestañas y vuelve a entrar; no se borraron los consumos.'); render(); } });
    return;
  }
  if (!operator || !localReady || STATE.pendingPosOrder) return;
  const value = structuredClone(localDraft()), signature = JSON.stringify(value);
  if (signature === localSignature) return;
  localSignature = signature;
  const generation = localGeneration;
  localAccountMessage('Guardando consumos…');
  localSaving++;
  localWork = localWork.catch(() => {}).then(() => localAccount.save(value)).then(() => {
    if (generation === localGeneration) localAccountMessage('Consumos guardados en este equipo. Pendientes de envío.');
  }).catch(() => {
    if (generation === localGeneration) { localSignature = ''; localAccountMessage('No se pudo guardar. No cierres la app; revisa espacio y permisos antes de cobrar.'); }
  }).finally(() => { localSaving--; });
}

function storedCart() {
  try {
    const value = JSON.parse(localStorage.getItem("chingadazo_cart") || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item.productId === "string"
      && Number.isInteger(Number(item.qty)) && Number(item.qty) > 0 && Number(item.qty) <= 50);
  } catch {
    try { localStorage.removeItem("chingadazo_cart"); } catch {}
    return [];
  }
}

const STATE = {
  view: STAFF_DEVICE_MODE ? "staff-access" : "home",
  cat: "destacados",
  cart: storedCart(),
  product: null,
  qty: 1,
  mods: {},
  note: "",
  lastSeen: Number(localStorage.getItem("chingadazo_last_seen") || 0),
  posCat: "alitas",
  posTicket: [],
  posChannel: "mostrador",
  posPay: "Efectivo",
  posChange: false,
  posPayWith: "",
  posName: "",
  cajaGuide: false,
  posMode: false,
  liveReady: false,
  needLivePaint: true,
  calY: null,
  calM: null,
  calDay: "",
  orderCalY: null,
  orderCalM: null,
  orderCalDay: "",
  deliveryAdmin: null,
  deliverySettingsDraft: null,
  deliveryTrack: null,
  deliveryTrackOrder: "",
  deliveryTrackCache: {},
  deliveryRatingsSyncing: false,
  deliveryRating: {},
  funnelReport: null,
  managerData: null,
  managerLoading: false,
  managerDay: "",
  managerAnswer: "",
  managerError: "",
  installPromptVisible: (() => {
    if (new URLSearchParams(location.search).has("personal") || IS_STANDALONE) return false;
    try { return Date.now() - Number(localStorage.getItem("chingadazo_install_later") || 0) > 24 * 60 * 60 * 1000; }
    catch { return true; }
  })(),
  pushSyncing: false,
  pushUser: "",
  recoverySentEmail: "",
  staffDirectory: null,
  staffDirectoryLoading: false,
  staffSelected: "",
  staffPin: "",
  staffLoginBusy: false,
  staffLoginMessage: "",
  checkoutLocation: null,
  checkoutDeliveryZone: "altos-chingadazo",
  checkoutDeliveryQuote: null,
  checkoutTip: 0,
  menuSearch: "",
  smartBudget: Number(localStorage.getItem("chingadazo_smart_budget") || 300),
  smartPeople: Number(localStorage.getItem("chingadazo_smart_people") || 2),
  smartSeed: Number(sessionStorage.getItem("chingadazo_smart_seed") || 0),
  familyRoom: null,
  familyCode: localStorage.getItem("chingadazo_family_code") || "",
  familyMode: false,
  familyBusy: false,
  familyCheckoutCode: "",
  payerGame: null,
  payerGameCode: localStorage.getItem("chingadazo_payer_game_code") || "",
  payerGameBusy: false,
  payerGameSpinning: false,
  chupisticaGame: null,
  chupisticaCode: localStorage.getItem("chingadazo_chupistica_code") || "",
  chupisticaBusy: false,
  cartNotice: "",
  cartPulseUntil: 0,
  fold: { prog: true, neu: true, proc: true, done: false, cashConfig: false, cashPending: false, cashProcess: false },
  tourStep: (() => {
    if (STAFF_DEVICE_MODE) return -1;
    try { return localStorage.getItem("chingadazo_customer_tour_v1") === "done" ? -1 : 0; }
    catch { return 0; }
  })(),
  renderedView: ""
};

function trackFunnel(event) {
  if (globalThis.CHINGADAZO_CONFIG?.configured === false) return;
  if (STAFF_DEVICE_MODE || isStaff()) return;
  const allowed=["visit","menu_view","product_view","cart_add","cart_view","auth_view","register_start","register_complete","email_pending","login_success","checkout_start","location_confirmed","order_complete","ai_view","ai_accept","ai_surprise","profile_view","family_create","family_join","family_checkout","payer_game_create","payer_game_join","payer_game_draw","chupistica_create","chupistica_join","chupistica_start","chupistica_answer","live_order_view"];
  if(!allowed.includes(event)) return;
  try {
    const key="chingadazo_funnel_v1_"+event;
    if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,"1");
    fetch("/api/analytics/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event,device:matchMedia("(max-width:760px)").matches?"mobile":"desktop",mode:IS_STANDALONE?"installed":"browser"}),keepalive:true}).catch(()=>{});
  } catch {}
}

function saveCart() {
  try { localStorage.setItem("chingadazo_cart", JSON.stringify(STATE.cart)); }
  catch { /* El pedido sigue disponible en memoria aunque falle el almacenamiento. */ }
  updateBadges();
}

function cartCount() { return STATE.cart.reduce((a, i) => a + i.qty, 0); }
function cartSubtotal() { return STATE.cart.reduce((a, i) => a + i.unit * i.qty, 0); }

function cartAttentionHtml() {
  if (!STATE.cartNotice || Date.now() >= STATE.cartPulseUntil) return "";
  return `<div class="cart-added-toast" role="status"><span>✓</span><div><b>${escapeHtml(STATE.cartNotice)}</b><small>Tu pedido está en el carrito iluminado</small></div></div>`;
}

function signalCartAdded(name) {
  trackFunnel("cart_add");
  STATE.cartNotice = `${name || "Producto"} agregado`;
  STATE.cartPulseUntil = Date.now() + 2600;
  render();
  window.setTimeout(() => {
    if (Date.now() < STATE.cartPulseUntil) return;
    STATE.cartNotice = "";
    render();
  }, 2700);
}
function deliveryEstimate(settings = Store.get().settings, location = STATE.checkoutLocation) {
  if (!location) return null;
  if (STATE.checkoutDeliveryZone === "altos-chingadazo") return {km:null,fee:Number(settings.deliveryFixedZoneFee ?? 35),source:"fixed_zone"};
  return STATE.checkoutDeliveryQuote;
}

function nationwideDeliveryTestEnabled(settings = Store.get().settings) {
  return settings?.deliveryNationwideTestEnabled !== false;
}

async function requestDeliveryQuote(form = document.getElementById("checkoutForm")) {
  if (!form || !STATE.checkoutLocation || form.type?.value !== "delivery") return null;
  const token = await AuthBridge.idToken();
  if (!token) throw new Error("Vuelve a iniciar sesión para calcular el envío.");
  const res = await fetch("/api/delivery/quote", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}, body:JSON.stringify({
    address:String(form.address?.value || "").trim(), deliveryLat:STATE.checkoutLocation.lat, deliveryLng:STATE.checkoutLocation.lng,
    deliveryAccuracy:STATE.checkoutLocation.accuracy, deliveryCapturedAt:STATE.checkoutLocation.capturedAt, deliveryZoneId:STATE.checkoutDeliveryZone
  }) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "No se pudo calcular la ruta de entrega.");
  STATE.checkoutDeliveryQuote = data;
  return data;
}

function bestLocation(options) { return window.ChingadazoGPS.locate(options); }

function currentUser() {
  const db = Store.get();
  if (!db.session || window.__verifiedProfile?.id !== db.session) return null;
  return db.users.find((u) => u.id === db.session) || null;
}
function isStaff(u = currentUser()) {
  return !!(u && ["admin", "cashier", "kitchen"].includes(u.role));
}
function canAdmin(u = currentUser()) { return u?.role === "admin"; }
function canCash(u = currentUser()) { return u && ["admin", "cashier"].includes(u.role); }
function canKitchen(u = currentUser()) { return u && ["admin", "cashier", "kitchen"].includes(u.role); }
function landingFor(u) {
  if (!u) return "home";
  if (u.role === "admin") return "admin";
  if (u.role === "cashier") return "caja";
  if (u.role === "kitchen") return "cocina";
  return STATE.afterLogin || "home";
}
function goStaffOrLogin(view) {
  if (!canKitchen()) { STATE.afterLogin = view; go("login"); return; }
  go(view);
}

function requireAuth(next = "checkout") {
  if (currentUser()) {
    STATE.afterLogin=next;
    if(currentUser().role==='customer' && !customerProfileComplete(currentUser())){AuthBridge.current().then(u=>{STATE.googleAuth=u;go(u?"register":"login");}).catch(error=>alert(AuthBridge.message(error)));return;}
    go(next); return;
  }
  STATE.afterLogin = next;
  go("login");
}

function go(view) {
  document.activeElement?.blur();
  const adminViews = ["admin", "admin-products", "admin-settings", "admin-crm", "admin-cover", "admin-users", "admin-promos", "admin-clientes", "admin-delivery", "admin-insights", "admin-manager", "admin-costs", "admin-system"];
  if (adminViews.includes(view) && !canAdmin()) view = isStaff() ? landingFor(currentUser()) : "login";
  if ((view === "caja" || view === "turno" || view === "recibidas" || view === "mesas") && !canCash()) view = "login";
  if (view !== 'mesas') window.DiningUI?.stop();
  if (view !== 'cocina') window.DiningKitchen?.stop();
  if ((view === "cocina" || view === "admin-orders") && !canKitchen()) view = "login";
  STATE.view = view;
  const funnelByView={home:"visit",menu:"menu_view",cart:"cart_view",login:"auth_view",register:"register_start",checkout:"checkout_start"};
  if(funnelByView[view]) trackFunnel(funnelByView[view]);
  STATE.editLock = (view === "admin-products" || view === "admin-cover");
  window.__chingadazoEditLock = STATE.editLock;
  render();
  if (view === "admin-delivery") loadDeliveryAdmin();
  if (view === "admin-insights") loadFunnelReport();
  if (["admin-manager", "admin-costs", "admin-system"].includes(view)) loadManagerData(false);
  if (view === "family" && STATE.familyCode) loadFamilyRoom(STATE.familyCode);
  if (view === "payer-game" && STATE.payerGameCode) loadPayerGame(STATE.payerGameCode);
  if (view === "chupistica" && STATE.chupisticaCode) loadChupistica(STATE.chupisticaCode);
  if (view === "orders" && STATE.deliveryTrackOrder) loadDeliveryTrack(STATE.deliveryTrackOrder);
  window.scrollTo({ top: 0, behavior: "instant" });
}

const Alarm = (() => {
  let ctx, timer, scheduledTimer, scheduledAt = 0, ringing = false;
  function beep() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [880, 1320, 880, 660].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.22, now + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.11);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.13);
      });
    } catch {}
    try { navigator.vibrate && navigator.vibrate([200, 80, 200, 80, 400]); } catch {}
  }
  function pending() {
    const now = Date.now();
    return (Store.get().orders || []).filter((o) => o && o.status === "nuevo"
      && (!o.scheduledFor || new Date(o.scheduledFor).getTime() <= now));
  }
  function scheduleWake() {
    const next = (Store.get().orders || [])
      .filter((o) => o && o.status === "programado" && o.scheduledFor && new Date(o.scheduledFor).getTime() > Date.now())
      .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))[0];
    const nextAt = next ? new Date(next.scheduledFor).getTime() : 0;
    if (nextAt === scheduledAt) return;
    if (scheduledTimer) clearTimeout(scheduledTimer);
    scheduledTimer = null;
    scheduledAt = nextAt;
    if (!nextAt || !isStaff()) return;
    scheduledTimer = setTimeout(() => {
      scheduledAt = 0;
      checkNewOrders().catch(() => {});
      setTimeout(() => sync(), 350);
    }, Math.max(0, nextAt - Date.now() + 75));
  }
  function start() {
    if (ringing) return;
    ringing = true;
    beep();
    const a = document.getElementById("kitchenAlarm");
    if (a) {
      a.loop = true;
      a.currentTime = 0;
      a.play().catch(() => {});
    }
    timer = setInterval(beep, 1800);
  }
  function stop() {
    ringing = false;
    if (timer) clearInterval(timer);
    timer = null;
    const a = document.getElementById("kitchenAlarm");
    if (a) { a.pause(); a.currentTime = 0; }
  }
  function sync() {
    scheduleWake();
    const list = pending();
    if (canKitchen() && list.length) start();
    else stop();
    const banner = $("#liveNotice");
    if (banner && list.length) {
      const o = list[0];
      banner.innerHTML = `<b>¡${list.length} pedido(s) sin recibir!</b><div>${o.code} · ${o.customerName || ""} · ${money(o.total)}</div><button class="btn gold" data-accept="${o.id}" style="margin-top:8px">Recibir ${o.code}</button>`;
      banner.classList.add("show");
    } else if (banner) banner.classList.remove("show");
    return list;
  }
  function unlock() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    } catch {}
    const a = document.getElementById("kitchenAlarm");
    if (a) a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }
  return { start, stop, sync, unlock, pending, scheduleWake };
})();

function playBell() { Alarm.start(); }

function blastSeenKey() { return "chingadazo_last_blast"; }
function pingSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = pingSound._ctx || (pingSound._ctx = new Ctx());
    if (ctx.state === "suspended") ctx.resume();
    [880, 1174, 988].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = f;
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.14);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.16);
    });
  } catch {}
  const a = document.getElementById("kitchenAlarm");
  if (a) { a.loop = false; a.currentTime = 0; a.play().catch(() => {}); }
}

function showBlastNotice(blast) {
  if (!blast || !blast.id) return;
  const bar = document.getElementById("liveNotice");
  if (bar) {
    bar.classList.add("show");
    bar.textContent = "📣 " + (blast.title || "Promo") + (blast.body ? " — " + blast.body : "");
    setTimeout(() => bar.classList.remove("show"), 14000);
  }
  pingSound();
  try { navigator.vibrate && navigator.vibrate([180, 60, 180]); } catch {}
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(blast.title || "El Chingadazo", {
        body: blast.body || "",
        icon: "assets/logo.jpg",
        tag: blast.id
      });
    } catch {}
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) reg.active.postMessage({ type: "notify", title: blast.title || "El Chingadazo", body: blast.body || "", tag: blast.id });
      }).catch(() => {});
    }
  }
}
function watchBlasts(remote) {
  const list = (remote && remote.blasts) || (Store.get().settings && Store.get().settings.blasts) || [];
  if (!list.length) return;
  const last = list[list.length - 1];
  if (!last || !last.id) return;
  let seen = "";
  try { seen = localStorage.getItem(blastSeenKey()) || localStorage.getItem("chingadazo_blast") || ""; } catch {}
  if (seen === last.id) return;
  try {
    localStorage.setItem(blastSeenKey(), last.id);
    localStorage.setItem("chingadazo_blast", last.id);
  } catch {}
  showBlastNotice(last);
}

function welcomeEmailBody(user, bonus) {
  const first = (user.name || "amigo").split(" ")[0];
  return [
    "Hola " + first + ",",
    "",
    "¡Gracias por registrarte en El Chingadazo!",
    "Te damos la bienvenida a Club El Chingadazo.",
    "",
    "Solo por crear tu cuenta ganaste " + bonus + " puntos.",
    "Cada L. 100 = 10 pts. 10 pts = L. 1. Canjeas solo por torta mexicana (1,100 pts).",
    "",
    "Beneficios de pedir por la app:",
    "• Tu pedido llega directo a cocina y caja",
    "• Acumulas puntos en cada orden entregada",
    "• Ves el estado de tu pedido",
    "• Promociones flash solo para quienes usan la app",
    "",
    "Cuando activemos una promo flash te avisamos en la app.",
    "Si tienes la web abierta o instalada y aceptaste notificaciones, el aviso te llega al momento.",
    "",
    "Pide en " + location.origin,
    "",
    "Con sabor catracho-mexicano,",
    "El Chingadazo"
  ].join("\n");
}

function sendWelcomeEmail(user, bonus) {
  // Los correos nunca se envían desde el navegador ni a servicios de formularios.
  // La verificación de Firebase ya entrega el mensaje esencial de activación.
  return Promise.resolve(!!user && Number(bonus || 0) >= 0);
}

function notifyOwner(order) {
  if (!isStaff()) return;
  Alarm.unlock();
  Alarm.sync();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Comanda nueva · El Chingadazo", {
      body: `${order.code} · ${order.customerName || ""} · ${money(order.total)} — Toca Recibir en cocina`,
      icon: "assets/logo.jpg",
      tag: order.id,
      requireInteraction: true
    });
  }
}

const SETTINGS_URL = "https://chingadazo-api.invalid/app/settings.json";

let settingsPublishChain = Promise.resolve();
function publishSettings() {
  const s = Store.get().settings || {};
  const snapshot = JSON.parse(JSON.stringify(s));
  if (!window.Cloud) return Promise.resolve(false);
  settingsPublishChain = settingsPublishChain.catch(() => false).then(() => Cloud.pushSettings(snapshot));
  return settingsPublishChain;
}
async function setDeliveryAvailability(enabled){
  const token=await AuthBridge.idToken();
  if(!token)throw new Error("La sesión del personal venció.");
  const res=await fetch("/api/operations/settings",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action:"delivery",enabled})});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(payload.error||"No se pudo cambiar el delivery.");
  Store.patch(d=>{d.settings.deliveryEnabled=payload.deliveryEnabled;});
  return payload.deliveryEnabled;
}

async function invoiceOrder(id) {
  const o = Store.get().orders.find((x) => x.id === id);
  if (!o) return false;
  if (o.invoiced || o.paidAt) return true;
  if (isUnpaid(o)) {
    alert("Este pedido está pendiente de pago. Cóbralo en Caja antes de facturar.");
    if (canCash()) go("caja");
    return false;
  }
  const sh = myOpenShift && myOpenShift();
  try {
    if (!sh) throw new Error("Abre tu turno antes de facturar.");
    const next = await Cloud.invoiceOrder(id, {
      payment: o.payment || "Efectivo",
      payWith: Number(o.payWith || 0),
      shiftId: sh.id
    });
    return !!(next && (next.invoiced || next.paidAt));
  } catch (error) {
    alert(error.message || "No se pudo confirmar la factura en el servidor.");
    return false;
  }
}

function adminPinOk() {
  if (canAdmin()) return true;
  alert("Esta operación requiere que un administrador inicie su propia sesión.");
  return false;
}

async function applyOrderStatus(id, status) {
  const cur0 = Store.get().orders.find((x) => x.id === id);
  if (cur0 && ["entregado", "facturada"].includes(cur0.status) && ["preparacion", "listo", "camino", "nuevo", "entregado", "facturada"].includes(status)) {
    grantPointsIfDone(cur0);
    return;
  }
  if (status === "cancelado" && !canAdmin()) {
    if (!adminPinOk()) { alert("Sin autorización del dueño no se cancela."); return; }
  }
  if (status === "facturada") {
    if (!await invoiceOrder(id)) return;
    status = "entregado";
  }
  let next = null;
  try {
    const token = await AuthBridge.idToken();
    if (!token) throw new Error("La sesión del empleado venció. Cambia de usuario e ingresa nuevamente con tu PIN.");
    const res = await fetch("/api/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id, status })
    });
    const payload = await res.json().catch(() => ({}));
    if (payload.order) {
      next = payload.order;
      Store.patch((d) => {
        const i = d.orders.findIndex((o) => o.id === id);
        if (i >= 0) d.orders[i] = payload.order;
        else d.orders.unshift(payload.order);
      });
    }
    if (!res.ok) throw new Error(payload.error || "El servidor rechazó el cambio de estado.");
  } catch (error) {
    alert(error.message || "No se pudo actualizar la orden en el servidor.");
    if (window.Cloud) await Cloud.syncOrders().catch(() => {});
    render();
    return;
  }
  if (status === "entregado" || status === "facturada") grantPointsIfDone(next);
  Alarm.sync();
  render();
}

async function pullLiveSettings() {
  if (globalThis.CHINGADAZO_CONFIG?.configured === false) return;
  try {
    const res = await fetch(SETTINGS_URL, { cache: "no-store" });
    if (!res.ok) return;
    const remote = await res.json();
    if (!remote) return;
    const cur = Store.get().settings || {};
    const open = remote.open === true;
    const waitMin = Number(remote.waitMin || cur.waitMin || 25);
    const opensAt = remote.opensAt || cur.opensAt || "11:00";
    const closeWeek = remote.closeWeek || cur.closeWeek || "21:00";
    const closeSun = remote.closeSun || cur.closeSun || "20:00";
    const weeklyHours = remote.weeklyHours || cur.weeklyHours;
    const doublePoints = remote.doublePoints === true;
    const deliveryEnabled = remote.deliveryEnabled !== false;
    STATE.liveReady = true;
    const lastBlastId = ((remote.blasts || [])[(remote.blasts || []).length - 1] || {}).id || "";
    const curBlastId = ((cur.blasts || [])[(cur.blasts || []).length - 1] || {}).id || "";
    const changed = Boolean(cur.open) !== Boolean(open)
      || JSON.stringify(cur.weeklyHours) !== JSON.stringify(weeklyHours)
      || Number(cur.waitMin || 25) !== waitMin
      || (cur.opensAt || "11:00") !== opensAt
      || (cur.closeWeek || "21:00") !== closeWeek
      || (cur.closeSun || "20:00") !== closeSun
      || Boolean(cur.doublePoints) !== doublePoints
      || (cur.deliveryEnabled !== false) !== deliveryEnabled
      || lastBlastId !== curBlastId
      || STATE.needLivePaint;
    if (changed) {
      STATE.needLivePaint = false;
      Store.patch((d) => {
        d.settings.open = open;
        if (weeklyHours) d.settings.weeklyHours = weeklyHours;
        d.settings.waitMin = waitMin;
        d.settings.opensAt = opensAt;
        d.settings.closeWeek = closeWeek;
        d.settings.closeSun = closeSun;
        d.settings.doublePoints = doublePoints;
        d.settings.deliveryEnabled = deliveryEnabled;
        if(remote.shiftReportEmail)d.settings.shiftReportEmail=remote.shiftReportEmail;
        if (remote.promos) d.settings.promos = remote.promos;
        if (remote.blasts) d.settings.blasts = remote.blasts;
        if (remote.welcomeBonus != null) d.settings.welcomeBonus = Number(remote.welcomeBonus);
      });
      if (!STATE.editLock && STATE.view !== "admin-products") render();
    }
    promoteScheduled();
    watchBlasts(remote);
  } catch {}
}

function startSettingsStream() { /* Authenticated polling below replaces the public stream. */ }

function pointsMultiplier() {
  return Store.get().settings && Store.get().settings.doublePoints ? 2 : 1;
}
function pointsEarned(amount) {
  return Math.floor(Number(amount || 0) / 100) * 10 * pointsMultiplier();
}
function pointsToLempiras(pts) {
  return +(Number(pts || 0) * 0.10).toFixed(2);
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function normalizeDni(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function sameAccountIdentifier(user, value) {
  const raw = String(value || "").trim();
  const plain = raw.toLowerCase().replace(/\s+/g, "");
  const phone = normalizePhone(raw);
  const dni = normalizeDni(raw);
  return normalizeEmail(user.email) === normalizeEmail(raw)
    || (phone && normalizePhone(user.phone) === phone)
    || (dni && normalizeDni(user.dni) === dni)
    || [user.username].filter(Boolean).some((x) => String(x).toLowerCase().replace(/\s+/g, "") === plain);
}
const TORTA_IDS = ["torta-mexicana"];
const TORTA_REDEEM_L = 110;
function ptsForTorta() {
  return Math.ceil(TORTA_REDEEM_L / 0.10);
}
function cartHasTorta() {
  return STATE.cart.some((i) => TORTA_IDS.includes(i.productId));
}
function canRedeemTorta(user) {
  return livePoints(user) >= ptsForTorta();
}

function samePerson(u, o) {
  if (!u || !o) return false;
  if (o.userId && o.userId === u.id) return true;
  const up = String(u.phone || "").replace(/\D/g, "");
  const op = String(o.phone || "").replace(/\D/g, "");
  if (up && op && up === op) return true;
  const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const un = strip(u.name);
  const on = strip(o.customerName);
  return !!(un && on && un === on && u.role === "customer");
}

function livePoints(user) { return Math.max(0, Number(user?.points || 0)); }

function ensureCustomer({ name, phone, email }) {
  const n = String(name || "").trim();
  const p = String(phone || "").replace(/\D/g, "");
  const e = String(email || "").trim().toLowerCase();
  if (!n && !p && !e) return null;
  const db = Store.get();
  let u = (db.users || []).find((x) => x.role === "customer" && (
    (p && String(x.phone || "").replace(/\D/g, "") === p) ||
    (e && String(x.email || "").toLowerCase() === e) ||
    (n && String(x.name || "").toLowerCase() === n.toLowerCase())
  ));
  if (!u) {
    u = {
      id: Store.uid("user"),
      role: "customer",
      name: n || "Cliente",
      phone: phone || "",
      email: e || "",
      dni: "",
      password: "",
      points: 0,
      addresses: []
    };
    Store.patch((d) => { d.users.push(u); });
  }
  if (window.Cloud) Cloud.pushUser(u);
  return u;
}

function findOrderUser(order, db) {
  if (!order) return null;
  const users = (db || Store.get()).users || [];
  return users.find((x) => x.id === order.userId)
    || users.find((x) => order.phone && String(x.phone || "").replace(/\D/g, "") === String(order.phone).replace(/\D/g, ""))
    || users.find((x) => order.customerName && String(x.name || "").toLowerCase() === String(order.customerName).toLowerCase())
    || null;
}

function grantPointsIfDone(order) { /* Points are granted idempotently by the server. */ }
function backfillPoints() { /* Never rewrite customer ownership from a name match. */ }

function paymentLine(order) {
  const method = order.payment || "Efectivo";
  if (method === "Efectivo") {
    if (order.needsChange) {
      const pay = Number(order.payWith || 0);
      const change = Math.max(0, pay - Number(order.total || 0));
      return pay
        ? `💵 *Método de pago:* Efectivo\n💵 *¿Necesita cambio?* Sí — paga con ${money(pay)} (cambio ${money(change)})`
        : `💵 *Método de pago:* Efectivo\n💵 *¿Necesita cambio?* Sí`;
    }
    return `💵 *Método de pago:* Efectivo\n💵 *¿Necesita cambio?* No`;
  }
  if (method === "Tarjeta") return `💳 *Método de pago:* Tarjeta`;
  if (method === "Transferencia") return `🏦 *Método de pago:* Transferencia`;
  return `💳 *Método de pago:* ${method}`;
}

function whatsappText(order) {
  const lines = [
    `🍽️ *EL CHINGADAZO*`,
    `📋 Pedido *${order.code}*`,
    `🕒 ${fmtTime(order.createdAt)}`,
    ``,
    `👤 *Cliente*`,
    `${order.customerName}`,
    `🪪 DNI: ${order.dni}`,
    `📱 Tel: ${order.phone}`,
    `✉️ Correo: ${order.email}`,
    ``,
    `🛵 *Tipo:* ${order.type === "delivery" ? "Domicilio" : "Para llevar"}`,
    `📍 *Dirección:* ${order.address || "—"}`,
    order.addressNotes ? `🏠 Referencia: ${order.addressNotes}` : "",
    ``,
    `────────────────`,
    `🧾 *DETALLES DEL PEDIDO*`,
    `────────────────`,
    ...order.items.map((i) => {
      const mods = i.modsText ? ` (${i.modsText})` : "";
      const note = i.note ? ` — ${i.note}` : "";
      return `🍔 ${i.qty}x ${i.name}${mods}${note} — ${money(i.unit * i.qty)}`;
    }),
    ``,
    `Subtotal: ${money(order.subtotal)}`,
    order.tax ? `ISV: ${money(order.tax)}` : "",
    order.deliveryFee ? `Envío: ${money(order.deliveryFee)}` : "",
    order.tip ? `Propina para el repartidor: ${money(order.tip)}` : "",
    order.redeemValue ? `⭐ Puntos canjeados: -${money(order.redeemValue)}` : "",
    `*TOTAL: ${money(order.total)}*`,
    ``,
    paymentLine(order),
    order.pointsEarned ? `⭐ Puntos de esta orden: +${order.pointsEarned}` : "",
    order.notes ? `📝 Notas: ${order.notes}` : ""
  ].filter((x) => x !== "");
  return lines.join("\n");
}

function ticketHtml(order, kind) {
  const s = Store.get().settings || {};
  const items = (order.items || []).map((i) =>
    `<div class="tl"><span>${i.qty}× ${i.name}${i.modsText ? "<br><small>" + i.modsText + "</small>" : ""}${i.note ? "<br><b>NOTA: " + i.note + "</b>" : ""}</span><span>${money(i.unit * i.qty)}</span></div>`
  ).join("");
  const change = Math.max(0, Number(order.payWith || 0) - Number(order.total || 0));
  const kick = kind === "client" && order.payment === "Efectivo" && change > 0;
  if (kind === "kitchen") {
    return `<h1>COCINA</h1><h2>${order.code}</h2><p>${order.channel || order.type || ""} · ${order.customerName || ""}</p><p>${fmtTime(order.createdAt)}</p><hr>${items}<hr>${order.notes ? "<p><b>NOTA GENERAL: " + order.notes + "</b></p>" : ""}`;
  }
  return `<h1>${s.name || "El Chingadazo"}</h1>
    <p>${s.address || ""}<br>${s.phone || ""}</p>
    <h2>${order.code}</h2>
    <p>${fmtTime(order.createdAt)}<br>${order.customerName || ""} · ${order.channel || order.type || ""}</p>
    <hr>${items}<hr>
    ${order.deliveryFee ? `<div class="tl"><span>Envío</span><span>${money(order.deliveryFee)}</span></div>` : ""}
    ${order.tip ? `<div class="tl"><span>Propina repartidor</span><span>${money(order.tip)}</span></div>` : ""}
    <div class="tl"><b>TOTAL</b><b>${money(order.total)}</b></div>
    <p>${order.payment || ""}${order.payWith ? "<br>Paga con " + money(order.payWith) + " · Cambio " + money(change) : ""}</p>
    ${kick ? "<p><b>ABRIR GAVETA</b></p>" : ""}
    <p>Gracias · elchingadazo</p>`;
}

function legacyPrintTicket(order, kind) {
  if (!order) return;
  const w = window.open("", "ticket", "width=420,height=640");
  if (!w) { alert("Permite ventanas emergentes para imprimir el ticket."); return; }
  w.document.write(`<!doctype html><html><head><title>${kind} ${order.code || ""}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: ui-monospace, Menlo, Consolas, monospace; width: 72mm; color: #000; }
      h1,h2 { margin: 4px 0; text-align: center; }
      h1 { font-size: 16px; } h2 { font-size: 18px; }
      p, small { margin: 4px 0; }
      .tl { display:flex; justify-content:space-between; gap:8px; margin: 4px 0; }
      hr { border: 0; border-top: 1px dashed #000; }
    </style></head><body>${ticketHtml(order, kind)}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 250);
}
async function printTicket(order, kind) {
  if(!order)return false;
  try{
    const status=await window.ChingadazoPrinter?.status();
    if(status?.connected || status?.configured){await window.ChingadazoPrinter.print(order,kind,Store.get().settings);return true;}
  }catch(error){reportClientIncident("printer",error.message||"Fallo de impresión directa",{area:"Impresora"});
    if(window.ChingadazoNative?.isApp){alert("La venta no se vuelve a cobrar. No se confirmó el envío USB: "+error.message+"\nComprueba papel y gaveta. No vuelvas a cobrar; reimprime desde la orden solo si falta el ticket.");return false;}
    alert("No se pudo imprimir directamente: "+error.message+"\n\nAbriremos la impresión tradicional.");}
  if(window.ChingadazoNative?.isApp){alert("Impresora nativa no disponible. No vuelvas a cobrar; revisa la conexión USB.");return false;}
  legacyPrintTicket(order,kind);return false;
}

function sendWhatsApp(order, force = false) {
  const db = Store.get();
  if (!force && !db.settings.autoWhatsApp) return;
  const phone = (db.settings.whatsapp || "").replace(/\D/g, "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText(order))}`;
  window.open(url, "_blank");
  Store.patch((d) => {
    const o = d.orders.find((x) => x.id === order.id);
    if (o) o.whatsappSent = true;
  });
}

function productById(id) { return Store.get().products.find((p) => p.id === id); }

function itemUnit(product, mods) {
  let n = product.price;
  (product.modifiers || []).forEach((g) => {
    const sel = mods[g.id];
    if (!sel) return;
    const ids = Array.isArray(sel) ? sel : [sel];
    ids.forEach((oid) => {
      const opt = g.options.find((o) => o.id === oid);
      if (opt) n += Number(opt.price || 0);
    });
  });
  return n;
}

function modsLabel(product, mods) {
  const parts = [];
  (product.modifiers || []).forEach((g) => {
    const sel = mods[g.id];
    if (!sel) return;
    const ids = Array.isArray(sel) ? sel : [sel];
    const names = ids.map((oid) => g.options.find((o) => o.id === oid)?.name).filter(Boolean);
    if (names.length) parts.push(`${g.name}: ${names.join(", ")}`);
  });
  return parts.join(" · ");
}

function openProduct(id) {
  const p = productById(id);
  if (!p || !p.available) return;
  trackFunnel("product_view");
  STATE.product = p;
  STATE.qty = 1;
  STATE.note = "";
  STATE.mods = {};
  (p.modifiers || []).forEach((g) => {
    if (!g.multi && g.options[0]) STATE.mods[g.id] = g.options[0].id;
    if (g.multi) STATE.mods[g.id] = [];
  });
  renderModal();
}

async function addCurrentToCart() {
  const p = STATE.product;
  if (!p) return;
  if (STATE.posMode) {
      if (STATE.posSending || STATE.pendingPosOrder || (globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady)) { alert('Espera a recuperar o confirmar la cuenta antes de agregar consumos.'); return; }
    for (const g of p.modifiers || []) {
      if (g.required) {
        const sel = STATE.mods[g.id];
        if (!sel || (Array.isArray(sel) && !sel.length)) { alert("Completa: " + g.name); return; }
      }
    }
    STATE.posTicket.push({
      key: Store.uid("ci"),
      productId: p.id,
      name: p.name,
      qty: STATE.qty,
      unit: itemUnit(p, STATE.mods),
      mods: structuredClone(STATE.mods),
      modsText: modsLabel(p, STATE.mods),
      note: (STATE.note || "").trim()
    });
    STATE.posMode = false;
    closeModal();
    render();
    return;
  }
  for (const g of p.modifiers || []) {
    if (g.required) {
      const sel = STATE.mods[g.id];
      if (!sel || (Array.isArray(sel) && !sel.length)) {
        alert("Completa: " + g.name);
        return;
      }
    }
  }
  if (STATE.familyMode && STATE.familyCode) {
    try {
      await familyAction("add", { productId:p.id, qty:STATE.qty, mods:structuredClone(STATE.mods), note:STATE.note.trim() });
      closeModal();
      alert(`${p.name} se agregó a tu pedido familiar.`);
    } catch (error) { alert(error.message); }
    return;
  }
  STATE.cart.push({
    key: Store.uid("ci"),
    productId: p.id,
    name: p.name,
    image: productImageUrl(p),
    qty: STATE.qty,
    unit: itemUnit(p, STATE.mods),
    mods: structuredClone(STATE.mods),
    modsText: modsLabel(p, STATE.mods),
    note: STATE.note.trim()
  });
  saveCart();
  closeModal();
  signalCartAdded(p.name);
}

function promoteScheduled() {
  const now = Date.now();
  const due = (Store.get().orders || []).some((o) => o && o.status === "programado"
    && o.scheduledFor && new Date(o.scheduledFor).getTime() <= now);
  if (due && isStaff() && window.Cloud) {
    Cloud.syncOrders().then(() => Alarm.sync()).catch(() => {});
  } else if (isStaff()) Alarm.scheduleWake();
}

async function placeOrder(form) {
  if (STATE.orderSending) return;
  const user = currentUser();
  if (!user) return requireAuth("checkout");
  const db = Store.get();
  const settings = db.settings;
  const closed = !isStoreOpen(settings);
  const schedule = closed && form.schedule && form.schedule.value === "next";
  if (closed && !schedule) {
    alert("Estamos cerrados. Abre a las " + openLabel(settings) + ". Puedes dejar el pedido para esa hora.");
    return;
  }
  if (!STATE.cart.length) { go("menu"); return; }
  const type = form.type.value;
  if(type==="delivery"&&settings.deliveryEnabled===false){alert("En este momento el delivery está pausado. Elige Para llevar.");return;}
  const address = (form.address.value || "").trim();
  if (!address) { alert("La dirección es obligatoria."); return; }
  if(type === "delivery" && STATE.checkoutLocation && Date.now()-STATE.checkoutLocation.capturedAt>300000){STATE.checkoutLocation=null;STATE.checkoutDeliveryQuote=null;}
  if (type === "delivery" && !STATE.checkoutLocation) { alert("Para enviar a domicilio, toca ‘Confirmar mi ubicación GPS’. Esto permite calcular la ruta del repartidor."); return; }
  let estimate = null;
  if (type === "delivery") {
    try { estimate = await requestDeliveryQuote(form); }
    catch (error) { alert(error.message); return; }
  }
  const subtotal = cartSubtotal();
  if (subtotal < settings.minOrder) {
    alert("El pedido mínimo es " + money(settings.minOrder));
    return;
  }
  const deliveryFee = type === "delivery" ? Number(estimate?.fee || 0) : 0;
  const tip = type === "delivery" ? Math.max(0, Number(form.tip?.value || STATE.checkoutTip || 0)) : 0;
  const tax = +(subtotal * settings.taxRate).toFixed(2);
  let total = +(subtotal + tax + deliveryFee + tip).toFixed(2);
  const wantTorta = form.redeem && form.redeem.checked;
  if (wantTorta && !canRedeemTorta(user)) {
    alert("Los puntos solo se canjean por una torta y necesitas " + ptsForTorta() + " pts (≈ " + money(TORTA_REDEEM_L) + ").");
    return;
  }
  if (wantTorta && !cartHasTorta()) {
    alert("El canje de puntos es solo por torta mexicana o mega torta. Agrégala al pedido.");
    return;
  }
  const redeemPts = wantTorta ? ptsForTorta() : 0;
  const redeemValue = wantTorta ? TORTA_REDEEM_L : 0;
  total = Math.max(0, +(total - redeemValue).toFixed(2));
  const earned = pointsEarned(total);
  const payment = form.payment.value;
  const needsChange = payment === "Efectivo" && form.needsChange?.value === "si";
  const payWith = needsChange ? Number(form.payWith?.value || 0) : 0;
  if (needsChange && payWith && payWith < total) {
    alert("El monto con el que pagas debe ser mayor al total.");
    return;
  }
  const order = {
    id: STATE.pendingOrderId || (STATE.pendingOrderId = Store.uid("ord")),
    code: "CH-" + String(db.orders.length + 101).padStart(3, "0"),
    createdAt: new Date().toISOString(),
    scheduledFor: schedule ? nextOpenIso(settings) : "",
    status: schedule ? "programado" : "nuevo",
    updatedAt: new Date().toISOString(),
    userId: user.id,
    customerName: user.name,
    dni: user.dni,
    email: user.email,
    phone: user.phone,
    type,
    address: address,
    addressNotes: form.addressNotes.value.trim(),
    deliveryLat: type === "delivery" ? STATE.checkoutLocation?.lat : null,
    deliveryLng: type === "delivery" ? STATE.checkoutLocation?.lng : null,
    deliveryCapturedAt: type === "delivery" ? STATE.checkoutLocation?.capturedAt : null,
    deliveryAccuracy: type === "delivery" ? STATE.checkoutLocation?.accuracy : null,
    deliveryZoneId: type === "delivery" ? STATE.checkoutDeliveryZone : "",
    payment,
    needsChange,
    payWith,
    source: "app",
    channel: "app",
    paidAt: "",
    invoiced: false,
    notes: form.notes.value.trim(),
    items: STATE.cart.map((i) => ({
      productId: i.productId, name: i.name, qty: i.qty, unit: i.unit,
      mods: i.mods || {}, modsText: i.modsText || "", note: i.note || ""
    })),
    subtotal, tax, deliveryFee, tip, redeemValue,
    total,
    pointsEarned: earned,
    pointsGranted: false,
    redeemPts,
    familyCode: STATE.familyCheckoutCode || "",
    whatsappSent: false
  };
  STATE.orderSending = true;
  try {
    const ok = await Cloud.pushOrder(order);
    if (!ok) throw new Error('No se confirmó el pedido. Conservamos tu carrito para reintentar.');
    await Cloud.sync();
    const saved = Store.get().orders.find(o => o.id === order.id) || order;
    trackFunnel("order_complete");
    STATE.cart=[]; STATE.pendingOrderId=null; STATE.checkoutLocation=null; STATE.checkoutDeliveryQuote=null; STATE.checkoutDeliveryZone="altos-chingadazo"; STATE.checkoutTip=0;
    if (STATE.familyCheckoutCode) { STATE.familyCheckoutCode=""; STATE.familyCode=""; STATE.familyRoom=null; localStorage.removeItem("chingadazo_family_code"); }
    saveCart(); STATE.lastOrder=saved; go('success');
  } catch(error) { alert(error.message); }
  finally { STATE.orderSending=false; }
}

function renderTop() {
  if (STATE.view === "staff-access") return "";
  const user = currentUser();
  if (!isStaff() && ["chingadazo-ai","food-profile","family","payer-game","chupistica","live-order"].includes(STATE.view)) return "";
  return `
    <header class="topbar">
      <a class="brand" href="#" data-go="${isStaff()?landingFor(user):"home"}">
        <img src="${(Store.get().settings.logoImage || "assets/logo.jpg")}" alt="El Chingadazo" style="width:${Number(Store.get().settings.logoSize || 48)}px;height:${Number(Store.get().settings.logoSize || 48)}px;object-fit:cover;border-radius:12px">
        <div>
          <div class="ttl">El Chingadazo</div>
          <small>Comida mexicana</small>
        </div>
      </a>
      <div class="top-actions">
        ${isStaff() ? `<button class="btn ghost staff-switch" id="switchStaff" title="Cerrar este PIN y entrar con otro usuario">Cambiar usuario</button>` : ""}
        ${canAdmin() ? `<button class="icon-btn" data-go="admin" title="Panel">⚙</button>` : ""}
        ${canCash() ? `<button class="icon-btn" data-go="caja" title="Caja">💵</button>` : ""}
        ${user?.role === "kitchen" ? `<button class="icon-btn" data-go="cocina" title="Cocina">🍳</button>` : ""}
        ${isStaff() ? "" : `<button class="icon-btn top-cart ${Date.now() < STATE.cartPulseUntil ? "cart-attention" : ""}" data-go="cart" title="Carrito" aria-label="Abrir mi pedido, ${cartCount()} productos">🛒<span class="badge" id="cartBadge">${cartCount()}</span></button>`}
      </div>
    </header>`;
}

function renderTabs() {
  if (STATE.view === "staff-access") return "";
  const v = STATE.view;
  const role = currentUser()?.role;
  const items = role === "admin" ? [
    ["admin", "Recepción"],
    ...(window.DiningUI ? [["mesas", "Mesas"]] : []),
    ["caja", "Caja"],
    ["admin-orders", "Órdenes"],
    ["admin-delivery", "Delivery"],
    ["admin-clientes", "Clientes"],
    ["account", "Cuenta"]
  ] : role === "cashier" ? [
    ["caja", "Caja"],
    ...(window.DiningUI ? [["mesas", "Mesas"]] : []),
    ["recibidas", "Órdenes"],
    ["turno", "Turno"],
    ["account", "Cuenta"]
  ] : role === "kitchen" ? [
    ["cocina", "Cocina"],
    ["account", "Cuenta"]
  ] : [
    ["home", "Inicio"],
    ["menu", "Menú"],
    ["cart", "Pedido"],
    ["orders", "Órdenes"],
    ["account", "Cuenta"]
  ];
  const ICO = {
    admin: "🛎️", mesas: "🪑", caja: "💵", "admin-crm": "📊", "admin-products": "🍽️",
    account: "👤", "admin-orders": "🧾", cocina: "👨‍🍳", home: "🏠",
    menu: "🍽️", cart: "🛒", orders: "🧾", rewards: "⭐", turno: "🧮", recibidas: "📋",
    "admin-users": "👥", "admin-clientes": "⭐", "admin-delivery": "🏍️"
  };
  return `<nav class="bottom">${items.map(([id, label]) => `
    <button class="tab ${v === id || (id === "orders" && v === "live-order") || (id === "account" && ["chingadazo-ai","food-profile","family","payer-game","chupistica"].includes(v)) || (id === "admin" && (v === "admin" || v === "admin-orders")) ? "on" : ""}" data-go="${id}">
      <span>${ICO[id] || "•"}</span>
      ${label}
    </button>`).join("")}</nav>`;
}

function productImageUrl(p) {
  const img = String((p && p.image) || "");
  if (img.startsWith("idb:")) return "/api/media/" + encodeURIComponent(img.slice(4)) + "?v=85";
  if (img.startsWith("media:")) return "/api/media/" + encodeURIComponent(img.slice(6)) + "?v=85";
  if (img.startsWith("data:") || img.startsWith("http://") || img.startsWith("https://") || img.startsWith("assets/")) return img;
  const fallback={"alitas-6":"assets/logo.jpg","alitas-12":"assets/logo.jpg","alitas-6-papas":"assets/logo.jpg","combo-12":"assets/logo.jpg","combo-familiar":"assets/logo.jpg","alitas-18":"assets/logo.jpg","alitas-buffalo-promo":"assets/logo.jpg","chuleta-tipica":"assets/logo.jpg","pincho-tipico":"assets/logo.jpg","filete-pollo":"assets/logo.jpg","chuleta-tajada":"assets/logo.jpg","chuleta-costena":"assets/logo.jpg","choripan":"assets/logo.jpg","torta-mexicana":"assets/logo.jpg","mega-torta":"assets/logo.jpg","tacos-mex":"assets/logo.jpg","gringas":"assets/logo.jpg","philly":"assets/logo.jpg","tacos-birria":"assets/logo.jpg","quesadilla-birria":"assets/logo.jpg","combo-birria":"assets/logo.jpg","megaburga":"assets/logo.jpg","megaburga-papas":"assets/logo.jpg","papas-cheddar":"assets/logo.jpg","nachos":"assets/logo.jpg","choripapas":"assets/logo.jpg"};
  return fallback[p?.id]||"";
}

function categoryLabel(c) {
  return c?.id === "destacados" ? "Populares" : (c?.name || "Productos");
}

function bestSellers(db) {
  return (db.products || []).filter((p) => p.available !== false && p.featured).slice(0, 6);
}

function productCard(p, visible = true, badge = "") {
  const admin = canAdmin();
  const img = productImageUrl(p);
  const searchable = escapeHtml(`${p.name || ""} ${p.description || ""}`.toLowerCase());
  return `<article class="card menu-card ${visible ? "" : "menu-filtered"}" data-menu-item="${searchable}" data-menu-category="${escapeHtml(p.category || "")}">
    <button class="photo product-photo-button" ${admin ? `data-edit-menu="${p.id}"` : `data-product="${p.id}"`} aria-label="Ver ${escapeHtml(p.name || "producto")}">${img ? `<img class="food" alt="${escapeHtml(p.name || "Producto")}" src="${img}" loading="lazy" decoding="async">` : `<span class="ph">${(p.name||"•").slice(0,1)}</span>`}${badge || p.featured ? `<span class="tag">${escapeHtml(badge || "Popular")}</span>` : ""}</button>
    <div class="body">
      <h3>${p.name || "Producto"}</h3>
      <p class="desc">${p.description || ""}</p>
      <div class="row">
        <span class="price">${money(p.price)}</span>
        ${admin ? `<button class="btn ghost" data-edit-menu="${p.id}">Editar</button>` : `<button class="product-add" ${p.available ? "" : "disabled"} data-product="${p.id}" aria-label="Agregar ${escapeHtml(p.name || "producto")}">${p.available ? "+" : "×"}</button>`}
      </div>
    </div>
  </article>`;
}

function customerOrderHistory(user = currentUser()) {
  if (!user || user.role !== "customer") return [];
  return (Store.get().orders || []).filter(o => o.userId === user.id && o.status !== "cancelado");
}

function completedCustomerOrders(user = currentUser()) {
  return customerOrderHistory(user).filter(o => ["entregado", "facturada"].includes(o.status));
}

function defaultProductMods(product) {
  const mods = {};
  (product.modifiers || []).forEach(group => {
    mods[group.id] = group.multi ? [] : (group.options?.[0]?.id || "");
  });
  return mods;
}

function smartCartItem(product, qty = 1) {
  const mods = defaultProductMods(product);
  return { key: Store.uid("ai"), productId: product.id, name: product.name, image: productImageUrl(product), qty,
    unit: itemUnit(product, mods), mods, modsText: modsLabel(product, mods), note: "" };
}

function tasteWeights() {
  const weights = { tipicos: 1, mexicana: 1, alitas: 1, burgas: 1, refrescos: .25 };
  for (const order of customerOrderHistory()) for (const item of order.items || []) {
    const product = productById(item.productId); if (product) weights[product.category] = Number(weights[product.category] || 0) + Number(item.qty || 1) * 2;
  }
  return weights;
}

function hondurasMealMoment(now = new Date()) {
  let hour = 12;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    hour = Number(parts.find(part => part.type === "hour")?.value || 12);
  } catch { hour = now.getUTCHours() - 6; if (hour < 0) hour += 24; }
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  if (hour >= 5 && hour < 10) return { hour, greeting, noun: "desayuno", title: "Desayuno sugerido", cta: "Pedir este desayuno" };
  if (hour >= 10 && hour < 15) return { hour, greeting, noun: "almuerzo", title: "Almuerzo sugerido", cta: "Pedir este almuerzo" };
  if (hour >= 15 && hour < 18) return { hour, greeting, noun: "antojo", title: "Antojo de la tarde", cta: "Pedir este antojo" };
  if (hour >= 18 && hour < 23) return { hour, greeting, noun: "cena", title: "Cena sugerida", cta: "Pedir esta cena" };
  return { hour, greeting, noun: "antojo nocturno", title: "Antojo nocturno", cta: "Pedir este antojo" };
}

function smartRecommendation() {
  const db = Store.get(), budget = Math.max(100, Math.min(5000, Number(STATE.smartBudget || 300)));
  const mealMoment = hondurasMealMoment();
  const people = Math.max(1, Math.min(12, Number(STATE.smartPeople || 2))), weights = tasteWeights();
  const historyIds = customerOrderHistory().flatMap(o => (o.items || []).map(i => i.productId));
  const all=(db.products||[]).filter(p=>p.available!==false&&Number(itemUnit(p,defaultProductMods(p)))>0);
  const beverageProducts=all.filter(p=>p.category==="refrescos"&&!/agua/i.test(p.name))||[];
  const drinks=(beverageProducts.length?beverageProducts:all.filter(p=>p.category==="refrescos")).map(p=>({p,unit:itemUnit(p,defaultProductMods(p)),serves:/2\s*l/i.test(p.name)?4:/1[.,]5\s*l/i.test(p.name)?3:1}));
  const cheapestMeal=Math.min(...all.filter(p=>p.category!=="refrescos").map(p=>itemUnit(p,defaultProductMods(p))));
  const drinkChoice=drinks.filter(x=>x.unit+cheapestMeal<=budget).sort((a,b)=>{
    const aq=Math.ceil(people/a.serves),bq=Math.ceil(people/b.serves),awaste=aq*a.serves-people,bwaste=bq*b.serves-people;
    const ascore=awaste*10+a.unit*aq+(people>=2&&a.serves===1?15:0),bscore=bwaste*10+b.unit*bq+(people>=2&&b.serves===1?15:0);
    return ascore-bscore||Number(weights[b.p.category]||0)-Number(weights[a.p.category]||0);
  })[0]||null;
  const drinkQty=drinkChoice?Math.ceil(people/drinkChoice.serves):0, reservedDrink=drinkChoice?drinkChoice.unit*drinkQty:0, foodBudget=budget-reservedDrink;
  const products = all.filter(p => p.category !== "refrescos" && Number(itemUnit(p,defaultProductMods(p))) <= foodBudget)
    .map((p, index) => ({ p, score: Number(weights[p.category] || 0) * 10 + historyIds.filter(id => id === p.id).length * 12 + (p.featured ? 7 : 0) + ((index + STATE.smartSeed * 7) % 11) }))
    .sort((a, b) => b.score - a.score || Number(a.p.price) - Number(b.p.price));
  if (!products.length) return null;
  if (STATE.smartSeed) products.sort((a, b) => ((a.p.id.charCodeAt(0) + STATE.smartSeed * 13) % 17) - ((b.p.id.charCodeAt(0) + STATE.smartSeed * 13) % 17));
  const items = []; let total = 0, servings = 0;
  for (const row of products) {
    const p = row.p, unit = itemUnit(p, defaultProductMods(p));
    const familyServings = /familiar/i.test(p.name) ? 4 : /pareja|12 alitas/i.test(p.name) ? 2 : 1;
    const maxQty = Math.min(people - servings, Math.floor((foodBudget - total) / unit));
    if (maxQty < 1) continue;
    const qty = 1;
    items.push(smartCartItem(p, qty)); total += unit * qty; servings += familyServings * qty;
    if (servings >= people) break;
  }
  if (!items.length) { const p = products[0].p; items.push(smartCartItem(p, 1)); total = items[0].unit; }
  if(drinkChoice){items.push(smartCartItem(drinkChoice.p,drinkQty));total+=reservedDrink;}
  const remaining=Math.max(0,budget-total), maxExtras=Math.min(8,people+4);
  if(remaining>0){
    const candidates=all.filter(p=>itemUnit(p,defaultProductMods(p))<=remaining);
    const initialCounts=items.reduce((out,item)=>(out[item.productId]=(out[item.productId]||0)+Number(item.qty||1),out),{});
    let states=new Map([[0,{items:[],score:0}]]);
    for(let step=0;step<maxExtras;step+=1){
      const next=new Map(states);
      for(const [spent,state] of states)for(const p of candidates){const unit=itemUnit(p,defaultProductMods(p)),sum=spent+unit;if(sum>remaining)continue;const repeats=Number(initialCounts[p.id]||0)+state.items.filter(id=>id===p.id).length,maxAllowed=p.category==="refrescos"?Math.max(2,Math.ceil(people/2)):1;if(repeats>=maxAllowed)continue;const fresh=repeats===0;const score=state.score+Number(weights[p.category]||0)+(p.featured?2:0)+(fresh?8:-4);const old=next.get(sum);if(!old||score>old.score)next.set(sum,{items:[...state.items,p.id],score});}
      states=next;
    }
    const best=[...states.entries()].sort((a,b)=>b[0]-a[0]||b[1].score-a[1].score)[0];
    for(const id of best?.[1]?.items||[]){const p=productById(id),unit=itemUnit(p,defaultProductMods(p)),existing=items.find(i=>i.productId===id&&JSON.stringify(i.mods)===JSON.stringify(defaultProductMods(p)));if(existing)existing.qty+=1;else items.push(smartCartItem(p,1));total+=unit;}
  }
  const lead = productById(items[0].productId);
  return { items, total, people, budget, image: productImageUrl(lead), prep: Math.max(db.settings.waitMin || 25, ...items.map(i => productById(i.productId)?.prepMin || 0)),
    title: people === 1 ? `${mealMoment.title} para ti` : `${mealMoment.title} para ${people}`, cta: mealMoment.cta,
    description: items.map(i => `${i.qty}× ${i.name}`).join(" · ") };
}

function smartHomeHtml() {
  const settings = Store.get().settings;
  if (settings.chingadazoAiEnabled === false || isStaff()) return "";
  const suggestion = smartRecommendation(); if (!suggestion) return "";
  const user = currentUser(), first = user?.name?.split(/\s+/)[0] || "";
  return `<section class="chingadazo-ai-home" aria-label="Recomendación inteligente">
    <div class="ai-head"><div><small>✨ CHINGADAZO IA</small><h2>${first ? `Buenas, ${escapeHtml(first)}. ` : ""}Creo que ya sé qué se te antoja</h2></div><span class="ai-chip">Sugerencia inteligente</span></div>
    <div class="ai-meal"><div class="ai-meal-photo">${suggestion.image ? `<img src="${suggestion.image}" alt="${escapeHtml(suggestion.title)}">` : "<span>🍽️</span>"}</div>
      <div class="ai-meal-copy"><h3>${escapeHtml(suggestion.title)}</h3><p>${escapeHtml(suggestion.description)}</p><div><span>⏱️ ${suggestion.prep}–${suggestion.prep + 10} min</span><b>${money(suggestion.total)}</b></div></div></div>
    <button class="btn gold full ai-primary" data-ai-accept>🛒 Pedir esta combinación</button>
    <button class="btn ghost full" data-ai-change>Cambiar sugerencia</button>
    <div class="ai-quick-actions">
      <button data-ai-budget>🪙 <b>Tengo ${money(STATE.smartBudget)}</b></button>
      <button data-ai-people>👥 <b>${STATE.smartPeople === 1 ? "Solo yo" : `Somos ${STATE.smartPeople}`}</b></button>
      <button data-ai-surprise>🎲 <b>Sorpréndeme</b></button>
    </div>
    <div class="ai-links">${settings.foodProfileEnabled !== false ? `<button data-go="food-profile">Ver mi Perfil Comelón</button>` : ""}${settings.familyOrderEnabled !== false ? `<button data-go="family">Pedir en familia</button>` : ""}</div>
  </section>`;
}

function viewChingadazoAI() {
  const user=currentUser(); if(!user) return viewLogin();
  const settings=Store.get().settings;
  if(user.role!=="customer" || settings.chingadazoAiEnabled===false) return `<div class="auth-wrap"><h1>Chingadazo IA</h1><p>Esta experiencia no está disponible en esta cuenta.</p><button class="btn" data-go="account">Volver</button></div>`;
  const suggestion=smartRecommendation(); if(!suggestion) return `<div class="auth-wrap"><h1>Chingadazo IA</h1><p>No hay productos disponibles para crear una sugerencia.</p><button class="btn" data-go="account">Volver</button></div>`;
  const first=user.name?.split(/\s+/)[0]||"";
  const greeting=hondurasMealMoment().greeting;
  const leadId=suggestion.items[0]?.productId;
  const related=(Store.get().products||[]).filter(p=>p.available!==false&&p.id!==leadId&&p.category!=="refrescos").sort((a,b)=>Number(b.featured)-Number(a.featured)).slice(0,2);
  trackFunnel("ai_view");
  return `<div class="customer-shell chingadazo-ai-page">
    <div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>MI CUENTA</small><h1>Chingadazo IA</h1></div></div>
    <div class="ai-welcome"><small>${greeting},</small><h2>${escapeHtml(first)} <span>👋</span></h2><p>Qué rico que estés aquí</p></div>
    <section class="ai-showcase">
      <div class="ai-showcase-title"><div><small>✨ SABOR CATRACHO CON INTELIGENCIA</small><h2>Creo que ya sé qué se te antoja</h2></div><span>Hecho para ti</span></div>
      <div class="ai-cover"><img src="${suggestion.image||"assets/logo.jpg"}" alt="${escapeHtml(suggestion.title)}"></div>
      <div class="ai-offer"><div><h3>${escapeHtml(suggestion.title)}</h3><p>◷ Lista en ${suggestion.prep}–${suggestion.prep+10} min</p></div><b>${money(suggestion.total)}</b></div>
      <button class="btn gold full ai-order" data-ai-accept>🛒 ${escapeHtml(suggestion.cta)}</button>
      <button class="btn ghost full ai-change" data-ai-change>↻ Cambiar sugerencia</button>
    </section>
    <div class="ai-quick-actions">
      <button data-ai-budget><img class="lempira-button-icon" src="assets/lempira-3d.webp" alt="Lempira hondureño"><b>Tengo ${money(STATE.smartBudget)}</b></button>
      <button data-ai-people><span>👥</span><b>${STATE.smartPeople===1?"Solo yo":`Somos ${STATE.smartPeople}`}</b></button>
      <button data-ai-surprise><span>⚄</span><b>Sorpréndeme</b></button>
    </div>
    <div class="section-h ai-related-title"><div><small>Elegidos según tu historial</small><h2>Basado en tu Perfil Comelón</h2></div><button class="text-action" data-go="menu">Ver todo ›</button></div>
    <div class="ai-related">${related.map(p=>`<button data-product="${p.id}"><img src="${productImageUrl(p)||"assets/logo.jpg"}" alt="${escapeHtml(p.name)}"><span><b>${escapeHtml(p.name)}</b><strong>${money(p.price)}</strong><small>◷ Listo en ${Number(p.prepMin||settings.waitMin||25)} min</small></span></button>`).join("")}</div>
    <p class="brand-motto ai-motto">Comida mexicana, sabor con carácter</p>
  </div>`;
}

function foodProfileData() {
  const orders = completedCustomerOrders(), totalOrders = orders.length, counts = { tipicos: 0, mexicana: 0, alitas: 0, burgas: 0, refrescos: 0 };
  const destinations={Honduras:0,México:0,"Estados Unidos":0,Argentina:0}, productCounts={};
  let units = 0, night = 0, spicyUnits=0; const unique = new Set();
  for (const order of orders) {
    const hour = new Date(order.createdAt || 0).getHours(); if (hour >= 20 || hour < 5) night += 1;
    for (const item of order.items || []) {
      const product = productById(item.productId); if (!product) continue;
      const qty=Number(item.qty||1), id=String(product.id||""); counts[product.category]=Number(counts[product.category]||0)+qty; units+=qty; unique.add(id); productCounts[id]=(productCounts[id]||0)+qty;
      if (/buffalo|chipotle|picante/i.test(`${item.modsText||""} ${item.note||""}`)) spicyUnits+=qty;
      if (id.includes("choripan")) destinations.Argentina+=qty;
      else if (["alitas","burgas"].includes(product.category)||/philly|papa|wing|hamburg|burga/.test(id)) destinations["Estados Unidos"]+=qty;
      else if (product.category==="mexicana"||/taco|birria|mexicana|gringa|quesadilla/.test(id)) destinations.México+=qty;
      else if (product.category==="tipicos") destinations.Honduras+=qty;
    }
  }
  const denom = Math.max(1, units), traditional = Math.round(35 + counts.tipicos / denom * 60), spicy = Math.min(99, Math.round(15 + spicyUnits/denom*55 + counts.alitas/denom*20 + counts.mexicana/denom*10));
  const adventurous = Math.min(99, Math.round(25 + unique.size / Math.max(1, units) * 70)), sharing = Math.min(99, Math.round(30 + orders.filter(o => (o.items || []).reduce((s, i) => s + i.qty, 0) >= 3).length / Math.max(1, totalOrders) * 65));
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "tipicos";
  const profiles = {
    tipicos:["Catracho de pura cepa","Si el plato trae frijolitos, tajadas y buen sazón, ahí sí decís: ahora estamos hablando."],
    mexicana:["Catracho con alma taquera","Pedís salsa suave para comenzar… y a la tercera mordida ya estás buscando otra servilleta."],
    alitas:["Comandante de las alitas","Vos no contás alitas: contás cuántas quedaron y quién se está acercando a la última."],
    burgas:["Jefe de la parrilla","Lo tuyo viene caliente, con carne y bastante queso; la dieta puede llamar mañana."],
    refrescos:["El que nunca come en seco","Antes de probar el plato ya revisaste que la bebida esté bien fría. Prioridades claras."]
  };
  if (!Object.values(destinations).some(Boolean)) Object.keys(destinations).forEach(k=>destinations[k]=1);
  const sum = Object.values(destinations).reduce((a,b)=>a+b,0); let used = 0;
  const passport = Object.entries(destinations).map(([name,value],index,all) => { const pct = index === all.length - 1 ? Math.max(0,100-used) : Math.round(value/sum*100); used += pct; return { name, pct }; });
  const favoriteId=Object.entries(productCounts).sort((a,b)=>b[1]-a[1])[0]?.[0], favorite=productById(favoriteId)?.name||"tu próximo favorito";
  const nextTrip=[...passport].sort((a,b)=>b.pct-a.pct)[0]?.name||"Honduras";
  return { orders: totalOrders, units, traditional: Math.min(99, traditional), spicy, adventurous, sharing, guardian:Math.max(20,Math.min(95,115-sharing)), night: Math.round(night / Math.max(1,totalOrders) * 100), profile: profiles[top], passport, nextTrip, favorite };
}

function lockedCard(need, current, title, explanation) {
  const remain = Math.max(0, need - current);
  return `<article class="profile-unlock locked"><span>🔒 ${current}/${need} pedidos completados</span><h3>${escapeHtml(title)}</h3><p>Te ${remain === 1 ? "falta" : "faltan"} ${remain} ${remain === 1 ? "pedido" : "pedidos"} para ver tu resultado.</p><small class="unlock-explain">${escapeHtml(explanation)}</small></article>`;
}

function viewFoodProfile() {
  const user = currentUser(); if (!user) return viewLogin();
  if (Store.get().settings.foodProfileEnabled === false) return `<div class="auth-wrap"><h1>Perfil Comelón</h1><p>Esta experiencia está desactivada temporalmente.</p><button class="btn" data-go="account">Volver</button></div>`;
  const p = foodProfileData(), funny = Store.get().settings.spicyCopyEnabled !== false, first = user.name.split(/\s+/)[0], flags = {Honduras:"🇭🇳",México:"🇲🇽","Estados Unidos":"🇺🇸",Argentina:"🇦🇷"};
  const wingProduct=productById("alitas-buffalo-promo")||productById("alitas-6"), wingImage=productImageUrl(wingProduct)||"assets/logo.jpg";
  trackFunnel("profile_view");
  return `<div class="customer-shell food-profile-page premium-experience">
    <div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>MI CUENTA</small><h1>Mi Perfil Comelón</h1></div></div>
    <section class="profile-hero premium-red-panel"><div class="profile-hero-copy"><small>${escapeHtml(first)}, eres…</small><h2>${escapeHtml(p.profile[0])}</h2><i></i><p>${escapeHtml(funny ? p.profile[1] : "Tu perfil se calcula únicamente con los productos de tus pedidos completados.")}</p></div>
      <div class="profile-emblem" style="--score:${p.traditional*3.6}deg"><div><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><small>SABOR CATRACHO</small><b>${p.traditional}%</b></div><span>${escapeHtml(p.profile[0])}</span></div>
      <p class="brand-motto profile-motto">Comida mexicana, sabor con carácter</p>
    </section>
    <section class="profile-basis"><div><b>¿En qué se basa este perfil?</b><span>En tus ${p.orders} pedidos completados: qué productos elegís, cuánto picante pedís, si acostumbrás compartir y cuántos platos diferentes probás.</span></div><small>Se actualiza después de cada pedido. No es una encuesta ni adivina datos personales.</small></section>
    <div class="profile-section-title"><small>Estos números cambian con lo que ordenás</small><h2>Así comés vos</h2></div>
    <div class="profile-stats premium-stats"><div><span class="stat-icon yellow">🫓</span><p>Tradicional<b>${p.traditional}%</b></p></div><div><span class="stat-icon red">👥</span><p>Compartidor<b>${p.sharing}%</b></p></div><div><span class="stat-icon red">🌶️</span><p>Picante<b>${p.spicy}%</b></p></div><div><span class="stat-icon brown">⛰️</span><p>Aventurero<b>${p.adventurous}%</b></p></div></div>
    ${p.orders>=3?`<article class="profile-unlock spicy wing-unlock"><div class="wing-art"><img src="${wingImage}" alt="${escapeHtml(wingProduct?.name||"Alitas del menú")}"><span>😎</span></div><div><span>🔓 Desbloqueado con 3 pedidos</span><h3>¿Compartís la última alita?</h3><b>${p.guardian}% <small>${p.guardian>=70?"La cuidás con la mirada":p.guardian>=45?"La negociás": "La compartís si te la piden bonito"}</small></b><p>${funny?"Comparamos el tamaño de tus pedidos: mientras más pedís para compartir, menos protegés esa última alita.":"El resultado compara pedidos personales con pedidos grandes para compartir."}</p></div></article>`:lockedCard(3,p.orders,"¿Compartís la última alita?","Compara tus pedidos personales con los pedidos grandes que parecen hechos para compartir.")}
    ${p.orders>=5?`<article class="taste-passport premium-passport"><div class="passport-book"><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><b>PASAPORTE</b><span>DEL SABOR</span><i>⌁ ✈</i></div><div class="passport-data"><div class="passport-title"><span>✈</span><div><small>🔓 Desbloqueado con 5 pedidos</small><h2>Tu Pasaporte del Sabor</h2></div></div>${p.passport.map(x=>`<div class="country-row"><span>${flags[x.name]} ${x.name}</span><i><em style="width:${x.pct}%"></em></i><b>${x.pct}%</b></div>`).join("")}<div class="passport-prediction"><span>🧳</span><div><small>EL PASAPORTE ADIVINA</small><b>Tu próximo viaje podría ser a ${escapeHtml(p.nextTrip)}</b><p>Porque ese es el sabor que más aparece en tus pedidos.</p></div></div><details class="passport-help" open><summary>¿Cómo funciona?</summary><p>Cada producto de tus pedidos completados pone un sello: todo el menú típico suma Honduras; tacos, birria y comida mexicana suman México; hamburguesas, Philly steak, papas fritas y alitas suman Estados Unidos; y el choripán suma Argentina.</p></details><small>La predicción es un juego basado en lo que pedís; no compra viajes ni determina tu nacionalidad.</small><p class="brand-motto passport-motto">Cuatro destinos, un sabor que nos une</p></div></article>`:lockedCard(5,p.orders,"Tu Pasaporte del Sabor","Clasifica lo que pedís entre Honduras, México, Estados Unidos y Argentina, y juega a predecir tu próximo viaje.")}
    <details class="next-unlocks"><summary>🏆 Próximos juegos de tu perfil <span>›</span></summary><div>${p.orders>=7?`<article class="profile-unlock"><span>🔓 Desbloqueado con 7 pedidos</span><h3>¿Pedís lo seguro o te gusta probar?</h3><b>${p.adventurous>=60?"Explorador del menú":"Fiel a lo que te gusta"} · ${p.adventurous}%</b><p>${funny?`Tu plato seguro es ${escapeHtml(p.favorite)}, pero medimos cuántos productos diferentes te animás a probar.`:"Compara la variedad de productos de tus pedidos completados."}</p></article>`:lockedCard(7,p.orders,"¿Pedís lo seguro o te gusta probar?","Compara cuántas veces repetís tus favoritos con cuántos productos diferentes probás.")}${p.orders>=10?`<article class="profile-unlock spicy"><span>🔓 Desbloqueado con 10 pedidos</span><h3>¿A qué hora te agarra el antojo?</h3><b>${p.night>=50?"Team antojo nocturno 🌙":"Team antojo de día ☀️"} · ${p.night}% nocturno</b><p>${funny?"Descubrimos si tu estómago respeta el reloj… o si después de las ocho empieza a mandar mensajes.":"Compara tus pedidos hechos de día con los realizados después de las 8 p. m."}</p></article>`:lockedCard(10,p.orders,"¿A qué hora te agarra el antojo?","Compara cuántos pedidos hacés de día y cuántos después de las 8 p. m.")}${p.orders>=15?`<article class="profile-unlock"><span>🔓 Desbloqueado con 15 pedidos</span><h3>Tu plato salvavidas</h3><b>${escapeHtml(p.favorite)}</b><p>Ese que pedís cuando no querés experimentar y necesitás que el antojo quede resuelto.</p></article>`:lockedCard(15,p.orders,"Tu plato salvavidas","Encuentra el producto que más repetís cuando querés ir a lo seguro.")}</div></details>
    <button class="btn gold full premium-cta" data-go="menu">Pedir y seguir desbloqueando</button>
  </div>`;
}

async function familyApi(input = null, code = "") {
  const token = await AuthBridge.idToken(); if (!token) throw new Error("Vuelve a iniciar sesión.");
  const options = input ? { method:"POST", body:JSON.stringify(input) } : { method:"GET" };
  const url = "/api/family" + (!input ? "?code=" + encodeURIComponent(code) : "");
  const res = await fetch(url, { ...options, headers:{ "Content-Type":"application/json", Authorization:"Bearer " + token } });
  const data = await res.json().catch(()=>({})); if (!res.ok) throw new Error(data.error || "No se pudo actualizar el pedido familiar.");
  return data;
}

async function loadFamilyRoom(code = STATE.familyCode) {
  if (!code || STATE.familyBusy) return;
  STATE.familyBusy = true;
  try { STATE.familyRoom = await familyApi(null, code); STATE.familyCode = STATE.familyRoom.code; localStorage.setItem("chingadazo_family_code", STATE.familyCode); }
  catch (error) { STATE.familyRoom = null; if (error.message.includes("venció") || error.message.includes("cerrado") || error.message.includes("existe")) { STATE.familyCode=""; localStorage.removeItem("chingadazo_family_code"); } }
  finally { STATE.familyBusy = false; if (STATE.view === "family") render(); }
}

async function familyAction(action, extra = {}) {
  if (STATE.familyBusy) return null; STATE.familyBusy = true;
  try {
    const room = await familyApi({ action, code:STATE.familyCode, ...extra });
    STATE.familyRoom = room; STATE.familyCode = room.code || STATE.familyCode;
    if (STATE.familyCode) localStorage.setItem("chingadazo_family_code", STATE.familyCode);
    return room;
  } finally { STATE.familyBusy = false; if (STATE.view === "family") render(); }
}

function familyItemCard(item, room) {
  const own = item.ownerId === room.meId || room.isOrganizer;
  const initial=(item.ownerName||"?").trim().slice(0,1).toUpperCase();
  const photo=item.image||productImageUrl(productById(item.productId));
  return `<article class="family-item premium-family-item"><div class="family-item-photo">${photo ? `<img src="${photo}" alt="${escapeHtml(item.name)}">` : "🍽️"}<span>${escapeHtml(initial)}</span></div><div class="family-item-copy"><small>${escapeHtml(item.ownerName)}</small><b>${escapeHtml(item.qty>1?`${item.qty} ${item.name}`:item.name)}</b>${item.modsText?`<span>${escapeHtml(item.modsText)}</span>`:""}<strong>${money(item.unit*item.qty)}</strong></div>${own?`<div class="family-qty"><button data-family-qty="${item.id}" data-d="-1" aria-label="Restar">−</button><b>${item.qty}</b><button data-family-qty="${item.id}" data-d="1" aria-label="Sumar">+</button><button class="family-remove" data-family-remove="${item.id}" aria-label="Quitar">×</button></div>`:""}</article>`;
}

function viewFamily() {
  const user = currentUser(); if (!user) return viewLogin();
  if (Store.get().settings.familyOrderEnabled === false) return `<div class="auth-wrap"><h1>Pedido familiar</h1><p>Esta función está desactivada temporalmente.</p><button class="btn" data-go="home">Volver</button></div>`;
  if (user.role !== "customer") return `<div class="auth-wrap"><h1>Pedido familiar</h1><p>Esta función es para clientes.</p></div>`;
  const room = STATE.familyRoom;
  if (!room) return `<div class="customer-shell family-page premium-experience"><div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>MI CUENTA</small><h1>Círculo familiar</h1></div></div>
    <section class="family-welcome premium-red-panel"><img class="family-hero-icon" src="assets/logo.jpg" alt="Pedido en grupo"><h2>Un pedido, varios antojos</h2><p>Cada persona agrega lo suyo sin salir de El Chingadazo. El organizador revisa, confirma el GPS y realiza un solo pago.</p><button class="btn gold full premium-cta" data-family-create>Crear pedido en grupo</button><small>🔒 Solo usuarios registrados y con correo verificado</small><p class="brand-motto">Cada quien elige; el sabor nos une</p></section>
    <form class="form family-join premium-join" id="familyJoinForm"><h3>¿Ya te invitaron?</h3><p>Escribe el código temporal que aparece en la cuenta del organizador.</p><label>Código de 6 números</label><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="482 917" required><button class="btn full" type="submit">Entrar al círculo</button></form></div>`;
  const subtotal = (room.items || []).reduce((sum,i)=>sum+Number(i.unit)*Number(i.qty),0), ready = room.members.filter(m=>m.ready).length;
  const me = room.members.find(m=>m.id===room.meId);
  return `<div class="customer-shell family-page premium-experience"><div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>PEDIDO COMPARTIDO SEGURO</small><h1>Círculo familiar</h1></div><button class="experience-refresh" data-family-refresh aria-label="Actualizar">↻</button></div>
    <section class="family-room-head premium-red-panel"><h2>${escapeHtml(room.name || "Pedido en grupo")}</h2><p class="family-chosen"><span>👥</span><b>${ready} de ${room.members.length}</b> ya eligieron</p><div class="family-progress"><i style="width:${Math.round(ready/Math.max(1,room.members.length)*100)}%"></i></div>
      <div class="family-members">${room.members.map(m=>{const count=(room.items||[]).filter(i=>i.ownerId===m.id).reduce((n,i)=>n+Number(i.qty||0),0);return `<div class="${m.ready?"ready":""}"><span class="member-avatar">${escapeHtml(m.name.slice(0,1).toUpperCase())}${m.id===room.organizerId?"<i>♛</i>":""}</span><div><b>${escapeHtml(m.name)}</b><small>${m.id===room.organizerId?"Organizador":count?`${count} ${count===1?"producto":"productos"}`:"Eligiendo"}</small></div><em>${m.ready?"✓ Listo":"••• Falta elegir"}</em></div>`}).join("")}</div>
      <div class="family-code"><div><small>🔒 Código temporal</small><b>${room.code.slice(0,3)} ${room.code.slice(3)}</b><span>Vence automáticamente en 4 horas</span></div><button data-family-copy>Invitar dentro de la app</button></div>
      <p class="family-security">🔒 Solo usuarios registrados y verificados pueden participar.</p><p class="brand-motto">Distintos antojos, un sabor que nos une</p></section>
    <div class="section-h family-order-title"><div><small>Así va el pedido de tu grupo</small><h2>Pedido compartido</h2></div><button class="btn gold" data-family-add>＋ Agregar lo mío</button></div>
    <div class="family-items">${room.items.length?room.items.map(i=>familyItemCard(i,room)).join(""):`<div class="family-empty">🍽️<b>Todavía no agregan productos</b><span>Toca “Agregar lo mío” para comenzar.</span></div>`}</div>
    <button class="btn ${me?.ready?"ghost":"gold"} full" data-family-ready>${me?.ready?"Seguir eligiendo":"✓ Ya terminé de elegir"}</button>
    <section class="family-summary premium-summary"><h3>Resumen del pedido</h3><div><span>Subtotal de comida</span><b>${money(subtotal)}</b></div><div><span>Delivery</span><b>Se calcula con GPS</b></div><div class="family-total"><span>Total temporal</span><b>${money(subtotal)}</b></div><div class="family-payer"><span class="member-avatar">${escapeHtml(room.members.find(m=>m.id===room.organizerId)?.name?.slice(0,1)||"O")}<i>♛</i></span><p><b>Paga ${escapeHtml(room.members.find(m=>m.id===room.organizerId)?.name||"el organizador")}</b><small>Confirmará ubicación y método de pago</small></p></div>${room.isOrganizer?`<button class="btn gold full premium-cta" data-family-checkout ${room.items.length?"":"disabled"}>Revisar entrega y confirmar</button><button class="btn ghost full" data-family-cancel>Cancelar círculo</button>`:`<div class="okbox">El organizador confirmará la entrega y el pago cuando todos estén listos.</div>`}</section>
  </div>`;
}

async function payerGameApi(input=null, code="") {
  const token=await AuthBridge.idToken(); if(!token) throw new Error("Vuelve a iniciar sesión.");
  const options=input?{method:"POST",body:JSON.stringify(input)}:{method:"GET"};
  const url="/api/payer-game"+(!input?"?code="+encodeURIComponent(code):"");
  const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}});
  const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||"No se pudo actualizar la ruleta."); return data;
}

async function loadPayerGame(code=STATE.payerGameCode) {
  if(!code||STATE.payerGameBusy)return;
  STATE.payerGameBusy=true;let changed=false;
  try{const previous=STATE.payerGame,next=await payerGameApi(null,code);changed=!previous||previous.revision!==next.revision||previous.status!==next.status;STATE.payerGame=next;STATE.payerGameCode=next.code;localStorage.setItem("chingadazo_payer_game_code",STATE.payerGameCode);}
  catch(error){if(/venció|cerrado|existe/i.test(error.message)){changed=true;STATE.payerGame=null;STATE.payerGameCode="";localStorage.removeItem("chingadazo_payer_game_code");}}
  finally{STATE.payerGameBusy=false;if(STATE.view==="payer-game"&&changed)render();}
}

async function payerGameAction(action) {
  if(STATE.payerGameBusy)return null;STATE.payerGameBusy=true;
  try{const game=await payerGameApi({action,code:STATE.payerGameCode});STATE.payerGame=game;STATE.payerGameCode=game.code||STATE.payerGameCode;if(STATE.payerGameCode)localStorage.setItem("chingadazo_payer_game_code",STATE.payerGameCode);return game;}
  finally{STATE.payerGameBusy=false;}
}

function payerWheel(game) {
  const members=game.members||[], count=Math.max(1,members.length);
  const spinning=game.status==="spinning"&&game.spin;
  const elapsed=spinning?Math.max(-1000,Date.parse(game.serverNow)-Date.parse(game.spin.startedAt)):0;
  const style=`--people:${count};--spin-duration:${Number(game.spin?.durationMs||6500)}ms;--spin-delay:${-elapsed}ms;--spin-target:${Number(game.spin?.rotationDeg||0)}deg`;
  return `<div class="payer-wheel ${spinning?"synced-spinning":game.status==="drawn"&&game.spin?"spin-landed":""}" style="${style}"><div class="payer-wheel-ring">${members.map((m,i)=>{const angle=i*360/count;return `<span style="--angle:${angle}deg" title="${escapeHtml(m.name)}"><b>${escapeHtml(m.name.slice(0,1).toUpperCase())}</b><small>${escapeHtml(m.name.split(/\s+/)[0])}</small></span>`}).join("")}</div><div class="payer-wheel-center"><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><b>${spinning?"¡Agarrate!":game.status==="drawn"?"¡Salió!":"¿Quién paga?"}</b></div><i class="payer-pointer">▼</i></div>`;
}

function viewPayerGame() {
  const user=currentUser();if(!user)return viewLogin();if(user.role!=="customer")return `<div class="auth-wrap"><h1>¿Quién paga hoy?</h1><p>Este juego es para cuentas de clientes.</p></div>`;
  const game=STATE.payerGame;
  if(!game)return `<div class="customer-shell payer-game-page premium-experience"><div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>JUEGO ENTRE AMIGOS</small><h1>¿Quién paga hoy?</h1></div></div>
    <section class="payer-intro"><div class="payer-confetti" aria-hidden="true">● ✦ ▲ ● ✦</div><span class="payer-big-icon">🎯</span><h2>Que decida la suerte</h2><p>Creá un código, invitá a todos dentro de la app y giren la Ruleta Catracha. Cada participante tiene exactamente la misma oportunidad.</p><button class="btn gold full premium-cta" data-payer-create>Crear una ruleta</button><small>🔒 Solo entran clientes registrados y verificados</small><p class="brand-motto">La suerte elige; el sabor nos une</p></section>
    <form class="form payer-join premium-join" id="payerGameJoinForm"><h3>¿Ya tienen una ruleta?</h3><p>Ingresá el código de seis números que aparece en la cuenta del organizador.</p><label>Código temporal</label><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="271 504" required><button class="btn full" type="submit">Entrar al juego</button></form></div>`;
  const winner=game.winner, mine=winner?.id===game.meId, spinning=game.status==="spinning";
  return `<div class="customer-shell payer-game-page premium-experience"><div class="experience-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>RONDA ${Number(game.round||1)}</small><h1>¿Quién paga hoy?</h1></div><button class="experience-refresh" data-payer-refresh aria-label="Actualizar">↻</button></div>
    <section class="payer-room"><div class="payer-room-top"><div><small>Código temporal</small><b>${game.code.slice(0,3)} ${game.code.slice(3)}</b></div><button data-payer-copy>Copiar código</button></div><p>${game.members.length} ${game.members.length===1?"participante":"participantes"} · una oportunidad igual para cada uno</p></section>
    ${payerWheel(game)}
    <div class="payer-people">${game.members.map((m,i)=>`<div class="payer-person c${i%6}"><span>${escapeHtml(m.name.slice(0,1).toUpperCase())}</span><b>${escapeHtml(m.name.split(/\s+/)[0])}</b>${m.id===game.organizerId?"<small>Organizador</small>":"<small>En la ruleta</small>"}</div>`).join("")}</div>
    ${game.status==="drawn"&&winner?`<section class="payer-result ${mine?"mine":""}"><div class="payer-result-rays">✦　✦　✦</div><small>¡SALIÓ EL PREMIADO!</small><h2>${mine?"¡Sos el elegido!":escapeHtml(winner.name.split(/\s+/)[0])+" es el elegido"}</h2><div class="payer-winner-avatar">${escapeHtml(winner.name.slice(0,1).toUpperCase())}</div><p>${mine?"Hoy te ganaste el privilegio de invitar. La billetera respira hondo… y todos los demás sonríen.":`La suerte habló: hoy ${escapeHtml(winner.name.split(/\s+/)[0])} invita. ¡Que no se haga el loco!`}</p><b class="payer-punchline">${mine?"🏆 Ganador de la cuenta… y dueño del recibo":"🎉 Aplausos para quien invita"}</b></section>`:spinning?`<section class="payer-wait live-spin"><h2>¡La Ruleta Catracha está girando!</h2><p>Todos están viendo estas mismas vueltas en tiempo real. Nadie puede cambiar el resultado.</p><div class="live-dot"><i></i> Sincronizada con el servidor</div></section>`:`<section class="payer-wait"><h2>${game.members.length<2?"Falta otro valiente":"Todos listos para tentar la suerte"}</h2><p>${game.members.length<2?"Compartí el código para agregar al menos a otra persona.":"Al girar, todos verán la misma animación y el mismo elegido al mismo tiempo."}</p>${game.isOrganizer?`<button class="btn gold full premium-cta" data-payer-draw ${game.members.length<2?"disabled":""}>Girar la Ruleta Catracha</button>`:`<div class="okbox">Esperando que el organizador gire la ruleta…</div>`}</section>`}
    <div class="payer-actions">${game.status==="drawn"&&game.isOrganizer?`<button class="btn gold" data-payer-new>Jugar otra ronda</button>`:""}${game.status==="drawn"?`<button class="btn" data-go="family">Armar un pedido en grupo</button>`:""}${game.isOrganizer?`<button class="btn ghost" data-payer-cancel>Cerrar juego</button>`:`<button class="btn ghost" data-payer-leave ${game.status==="drawn"?"disabled":""}>Salir</button>`}</div>
    <p class="payer-note">Este juego elige a una persona por diversión. No cobra automáticamente, no guarda tarjetas y no cambia quién confirma el pedido.</p><p class="brand-motto payer-motto">Hoy paga uno; el sabor nos une a todos</p>
  </div>`;
}

async function chupisticaApi(input=null,code=""){
  const token=await AuthBridge.idToken();if(!token)throw new Error("Vuelve a iniciar sesión.");
  const options=input?{method:"POST",body:JSON.stringify(input)}:{method:"GET"};
  const url="/api/chupistica"+(!input?"?code="+encodeURIComponent(code):"");
  const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"No se pudo actualizar Cultura Chupística.");return data;
}

async function loadChupistica(code=STATE.chupisticaCode){
  if(!code||STATE.chupisticaBusy)return;STATE.chupisticaBusy=true;let changed=false;
  try{const previous=STATE.chupisticaGame,next=await chupisticaApi(null,code);changed=!previous||previous.revision!==next.revision||previous.status!==next.status;STATE.chupisticaGame=next;STATE.chupisticaCode=next.code;localStorage.setItem("chingadazo_chupistica_code",STATE.chupisticaCode);}
  catch(error){if(/venció|cerrada|existe/i.test(error.message)){changed=true;STATE.chupisticaGame=null;STATE.chupisticaCode="";localStorage.removeItem("chingadazo_chupistica_code");}}
  finally{STATE.chupisticaBusy=false;if(STATE.view==="chupistica"&&changed)render();}
}

async function chupisticaAction(action,extra={}){
  if(STATE.chupisticaBusy)return null;STATE.chupisticaBusy=true;
  try{const game=await chupisticaApi({action,code:STATE.chupisticaCode,...extra});STATE.chupisticaGame=game;STATE.chupisticaCode=game.code||STATE.chupisticaCode;if(STATE.chupisticaCode)localStorage.setItem("chingadazo_chupistica_code",STATE.chupisticaCode);return game;}
  finally{STATE.chupisticaBusy=false;}
}

function chupisticaPlayers(game,limit=20){
  return `<div class="chupi-players">${(game.members||[]).slice(0,limit).map((m,i)=>`<div class="chupi-player p${i%6} ${m.id===game.meId?"me":""}"><span>${escapeHtml(m.name.slice(0,1).toUpperCase())}</span><div><b>${escapeHtml(m.name.split(/\s+/)[0])}</b><small>${m.id===game.hostId?"Anfitrión":`${m.score} puntos`}</small></div></div>`).join("")}</div>`;
}

function viewChupistica(){
  const user=currentUser();if(!user)return viewLogin();if(user.role!=="customer")return `<div class="auth-wrap"><h1>Cultura Chupística</h1><p>Este juego es para cuentas de clientes.</p></div>`;
  const game=STATE.chupisticaGame,logo=Store.get().settings.logoImage||"assets/logo.jpg";
  const head=`<div class="experience-head chupi-head"><button class="experience-back" data-go="account" aria-label="Volver">‹</button><img src="${logo}" alt=""><div><small>JUEGO EN VIVO</small><h1>Cultura Chupística</h1></div>${game?`<button class="experience-refresh" data-chupi-refresh aria-label="Actualizar">↻</button>`:""}</div>`;
  if(!game)return `<div class="customer-shell chupi-page premium-experience">${head}<section class="chupi-intro"><div class="chupi-logo"><b>?</b><i>!</i><span>★</span></div><small>TRIVIA CATRACHA PARA TODOS</small><h2>¿Quién sabe más… sin buscar en Google?</h2><p>Creá una sala, compartí el código dentro de la app y respondan juntos. Son 10 preguntas fáciles de Honduras, El Salvador, Centroamérica, comida y música.</p><button class="btn gold full premium-cta" data-chupi-create>Crear partida</button><em>🥤 Podés jugar con refresco, café o lo que tengás. No requiere alcohol.</em></section><form class="form premium-join chupi-join" id="chupisticaJoinForm"><h3>Entrar con código</h3><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="482 917" required><button class="btn full" type="submit">¡Quiero jugar!</button></form></div>`;
  const code=`<section class="chupi-room"><div><small>CÓDIGO DE LA SALA</small><b>${game.code.slice(0,3)} ${game.code.slice(3)}</b></div><button data-chupi-copy>Copiar</button></section>`;
  if(game.status==="lobby")return `<div class="customer-shell chupi-page premium-experience">${head}${code}<section class="chupi-lobby"><span class="chupi-kicker">${game.members.length}/20 JUGADORES</span><h2>Esperando a los aleros…</h2><p>Cuando todos aparezcan, el anfitrión comienza la partida.</p>${chupisticaPlayers(game)}${game.isHost?`<button class="btn gold full premium-cta" data-chupi-start ${game.members.length<2?"disabled":""}>Comenzar las 10 preguntas</button>`:`<div class="okbox live-dot"><i></i> Esperando al anfitrión</div>`}</section><div class="payer-actions">${game.isHost?`<button class="btn ghost" data-chupi-cancel>Cerrar sala</button>`:`<button class="btn ghost" data-chupi-leave>Salir</button>`}</div></div>`;
  if(game.status==="question"&&game.question){
    const seconds=Math.max(0,Math.ceil((Date.parse(game.question.endsAt)-Date.parse(game.serverNow))/1000)),answered=game.myAnswer>=0;
    return `<div class="customer-shell chupi-page premium-experience">${head}<section class="chupi-progress"><div><span>Pregunta ${game.question.number}/${game.question.total}</span><b>${escapeHtml(game.question.category)}</b></div><div class="chupi-timer" data-chupi-ends="${escapeHtml(game.question.endsAt)}" data-chupi-server="${escapeHtml(game.serverNow)}" data-chupi-received="${Date.now()}">${seconds}</div></section><section class="chupi-question"><small>${game.answeredCount}/${game.members.length} ya respondieron</small><h2>${escapeHtml(game.question.prompt)}</h2></section><div class="chupi-options">${game.question.options.map((option,i)=>`<button class="o${i} ${game.myAnswer===i?"chosen":""}" data-chupi-answer="${i}" ${answered||seconds<=0?"disabled":""}><span>${["▲","◆","●","■"][i]}</span><b>${escapeHtml(option)}</b></button>`).join("")}</div>${answered?`<div class="chupi-locked live-dot"><i></i> Respuesta guardada · esperando a los demás</div>`:""}${game.isHost?`<button class="btn full chupi-reveal" data-chupi-reveal>Mostrar respuesta y puntos</button>`:""}</div>`;
  }
  if(game.status==="reveal"&&game.question){
    return `<div class="customer-shell chupi-page premium-experience">${head}<section class="chupi-reveal-card ${game.myCorrect?"correct":"wrong"}"><span>${game.myCorrect?"✓":"×"}</span><small>${game.myCorrect?`¡Correcto! +${game.myPoints} puntos`:"Esta vez no cayó"}</small><h2>${escapeHtml(game.question.options[game.question.correctIndex])}</h2><p>${escapeHtml(game.question.explanation)}</p></section><h3 class="chupi-board-title">Marcador en vivo</h3>${chupisticaPlayers(game,5)}${game.isHost?`<button class="btn gold full premium-cta" data-chupi-next>${game.question.number>=game.question.total?"Ver podio final":"Siguiente pregunta"}</button>`:`<div class="okbox live-dot"><i></i> El anfitrión prepara la siguiente</div>`}</div>`;
  }
  const podium=game.members||[],first=podium[0];
  return `<div class="customer-shell chupi-page premium-experience">${head}<section class="chupi-finish"><div class="chupi-confetti">✦ ● ▲ ★ ◆ ✦</div><small>CAMPEÓN DE CULTURA CHUPÍSTICA</small><h2>${escapeHtml(first?.name?.split(/\s+/)[0]||"La ronda")}</h2><div class="chupi-crown">♛<span>${escapeHtml(first?.name?.slice(0,1).toUpperCase()||"?")}</span></div><b>${Number(first?.score||0)} puntos</b><p>Hoy ganó el conocimiento. Mañana revisamos si también invita el próximo pedido.</p></section>${chupisticaPlayers(game,10)}<div class="payer-actions"><button class="btn gold" data-go="payer-game">Ahora decidamos quién paga</button>${game.isHost?`<button class="btn ghost" data-chupi-cancel>Cerrar partida</button>`:""}</div></div>`;
}

function viewHome() {
  if (globalThis.CHINGADAZO_CONFIG?.configured === false || Store.get().settings.open === false) return `
    <div class="customer-shell">
      <section class="chingadazo-welcome">
        <img src="assets/logo.jpg" alt="El Chingadazo · Comida mexicana">
        <div><span class="chingadazo-eyebrow">Comida mexicana · Honduras</span>
        <h1>El Chingadazo</h1><p>Comida mexicana, sabor con carácter.</p>
        <p>Plaza Las Casitas · Anillo Periférico</p>
        <p><a href="https://maps.app.goo.gl/ucbPaXWA6j4iLGyg9" target="_blank" rel="noopener noreferrer">Cómo llegar ↗</a></p>
        <button class="btn gold" data-go="menu">Ver nuestro menú</button></div>
      </section>
      <section class="chingadazo-pending" role="status"><h2>Conoce nuestro menú</h2><p>Ya puedes explorar los platos y precios. Los pedidos en línea están desactivados por el momento.</p></section>
      <div class="home-categories">${Store.get().categories.filter(c=>c.id!=="destacados").map(c=>`<button data-cat="${c.id}"><span>${c.icon}</span><b>${escapeHtml(c.name)}</b></button>`).join("")}</div>
      <div class="section-h customer-section"><h2>Para empezar con sabor</h2><button class="text-action" data-go="menu">Ver todo</button></div>
      <div class="grid customer-products">${Store.get().products.filter(p=>p.featured).map(p=>productCard(p,true,"")).join("")}</div>
      <footer class="chingadazo-operator">Tecnología operada por KORE Systems</footer>
    </div>`;
  const db = Store.get();
  const featured = bestSellers(db);
  const cats = (db.categories || []).filter((c) => c.id !== "destacados");
  return `
    <div class="customer-shell">
    <section class="hero customer-hero">
      <div class="hero-copy">
        <span class="restaurant-status ${isStoreOpen(db.settings) ? "open" : "closed"}"><i></i>${!STATE.liveReady ? "Consultando horario" : isStoreOpen(db.settings) ? "Abierto ahora" : "Cerrado ahora"}</span>
        <div class="kicker">Sabor catracho × mexicano</div>
        <h1>${db.settings.heroTitle || "Tu antojo, preparado al momento"}</h1>
        <p>${db.settings.heroSubtitle || "Pide delivery o recoge en el restaurante."}</p>
        <div class="hero-actions"><button class="btn gold" data-go="menu">Ver menú</button><span>⏱️ ${isStoreOpen(db.settings) ? `Listo en ~${db.settings.waitMin || 25} min` : `Pedidos para las ${openLabel(db.settings)}`}</span></div>
      </div>
      <div class="hero-visual" aria-label="Pide, recibe y gana Puntos Chingadazo">
        <div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div>
        <div class="hero-order-card"><span class="hero-check">✓</span><div><small>PEDIDO LISTO</small><b>Sabor recién hecho</b></div></div>
        <div class="hero-route"><span class="route-dot"></span><i></i><span class="route-bike">🏍</span></div>
        <div class="hero-points"><span>★</span><div><b>Puntos Chingadazo</b><small>Compra · suma · disfruta</small></div></div>
      </div>
    </section>
    <div class="order-path"><div><b>1</b><span>Elige lo que te gusta</span></div><div><b>2</b><span>Confirma entrega y pago</span></div><div><b>3</b><span>Sigue tu pedido en vivo</span></div></div>
    <form class="menu-search home-search" id="customerSearchForm"><span>⌕</span><input name="search" type="search" autocomplete="off" placeholder="¿Qué quieres comer hoy?" aria-label="Buscar en el menú"><button type="submit">Buscar</button></form>
    ${db.settings.doublePoints ? `<div class="flash">⚡ Hoy puntos dobles: cada L. 100 = 20 pts</div>` : ""}
    ${(db.settings.promos || []).filter((p) => p.active).slice(-2).reverse().map((p) => `
      <div class="flash">${p.title}<div class="hint" style="color:#fff;font-weight:500;margin-top:4px">${p.body || ""}${p.hours ? " · " + p.hours : ""}</div></div>`).join("")}
    <div class="section-h customer-section"><div><small>Explora el menú</small><h2>¿Qué se te antoja?</h2></div><button class="text-action" data-go="menu">Ver todo</button></div>
    <div class="home-categories">${cats.map(c=>`<button data-cat="${c.id}"><span>${c.icon || "🍽️"}</span><b>${escapeHtml(c.name)}</b></button>`).join("")}</div>
    <div class="section-h customer-section"><div><small>Recomendados de la casa</small><h2>Populares del Chingadazo</h2></div><button class="text-action" data-go="menu">Ver todo</button></div>
    <div class="grid customer-products">${featured.map((p) => productCard(p, true, "Popular")).join("")}</div>
    ${cartCount() ? `<button class="floating-cart ${Date.now() < STATE.cartPulseUntil ? "cart-attention" : ""}" data-go="cart"><span>🛒 ${cartCount()} ${cartCount()===1?"producto":"productos"}</span><b>Ver mi pedido · ${money(cartSubtotal())}</b></button>` : ""}
    ${cartAttentionHtml()}
    </div>`;
}

function viewMenu() {
  if (!Store.get().products.length) return `<div class="customer-shell"><section class="chingadazo-pending" role="status"><h1>Nuestro menú</h1><p>Estamos preparando el menú de El Chingadazo con sus precios y fotografías. Vuelve pronto.</p><button class="btn gold" data-go="home">Volver al inicio</button></section></div>`;
  const db = Store.get();
  const cats = db.categories || [];
  const allProducts = db.products.filter((p) => p.available !== false);
  const baseList = STATE.cat === "destacados"
    ? allProducts.filter((p) => p.featured)
    : allProducts.filter((p) => p.category === STATE.cat);
  const query = String(STATE.menuSearch || "").trim().toLowerCase();
  const list = query ? db.products.filter(p => `${p.name || ""} ${p.description || ""}`.toLowerCase().includes(query)) : baseList;
  return `
    <div class="customer-shell menu-page">
    ${STATE.familyMode ? `<div class="family-mode-banner"><span>👨‍👩‍👧‍👦 Estás agregando al pedido familiar</span><button data-family-back>Volver al círculo</button></div>` : ""}
    <div class="section-h customer-section menu-heading"><div><small>Comida mexicana</small><h2>Nuestro menú</h2></div><a class="text-action" href="/assets/menu/menu-original.pdf" target="_blank" rel="noopener">Ver menú original ↗</a></div>
    <div class="menu-search"><span>⌕</span><input id="menuSearch" type="search" autocomplete="off" value="${escapeHtml(STATE.menuSearch || "")}" placeholder="Buscar tortas, alitas, refrescos…" aria-label="Buscar productos"><button type="button" data-clear-menu-search aria-label="Limpiar búsqueda">×</button></div>
    <div class="category-panel">
      <div class="category-title"><b>Categorías</b><span>Toca una para filtrar</span></div>
      <div class="category-buttons" id="categoryRail">${cats.map((c) => `
          <button class="cat ${STATE.cat === c.id ? "on" : ""}" data-cat="${c.id}">${c.icon || ""} ${escapeHtml(categoryLabel(c))}</button>
        `).join("")}</div>
    </div>
    <div class="menu-results"><b id="menuResultCount">${list.length} productos</b><span>${query ? `Resultados para “${escapeHtml(query)}”` : escapeHtml(categoryLabel(cats.find(c=>c.id===STATE.cat)) || "Todos")}</span></div>
    <div class="grid customer-products" id="menuProductGrid">${allProducts.map(p => productCard(p, list.includes(p))).join("")}<div class="menu-empty ${list.length ? "menu-filtered" : ""}" id="menuEmpty"><span>🍽️</span><b>No encontramos ese producto</b><p>Prueba otra palabra o elige una categoría.</p></div></div>
    ${cartCount() ? `<button class="floating-cart ${Date.now() < STATE.cartPulseUntil ? "cart-attention" : ""}" data-go="cart"><span>🛒 ${cartCount()} ${cartCount()===1?"producto":"productos"}</span><b>Ver mi pedido · ${money(cartSubtotal())}</b></button>` : ""}
    ${cartAttentionHtml()}
    </div>`;
}

function viewCart() {
  if (isStaff()) {
    return `<div class="auth-wrap"><h1>Modo local</h1><p class="hint">Esta cuenta no compra. Usa cliente@demo.com para pedir.</p><button class="btn" data-go="${landingFor(currentUser())}">Volver al panel</button></div>`;
  }
  if (!STATE.cart.length) {
    return `<div class="auth-wrap"><h1>Tu pedido está vacío</h1><p class="hint">Agrega tacos de birria, gringas o un burrito.</p><button class="btn full" data-go="menu">Ir al menú</button></div>`;
  }
  const db = Store.get();
  const sub = cartSubtotal();
  return `<div class="customer-shell cart-page">
    <div class="section-h customer-section"><div><small>Revisa antes de continuar</small><h2>Tu pedido</h2></div><button class="btn ghost" id="clearCart">Vaciar</button></div>
    ${STATE.cart.map((i) => `
      <div class="cart-item">
        <img src="${i.image}" alt="">
        <div>
          <b>${i.name}</b>
          <div class="hint">${i.modsText || "Sin modificadores"}</div>
          ${i.note ? `<div class="hint">Nota: ${i.note}</div>` : ""}
          <div class="qty" style="margin-top:8px">
            <button data-qty="${i.key}" data-d="-1">−</button>
            <b>${i.qty}</b>
            <button data-qty="${i.key}" data-d="1">+</button>
          </div>
        </div>
        <div>
          <div class="price">${money(i.unit * i.qty)}</div>
          <button class="btn ghost" style="margin-top:8px" data-rem="${i.key}">Quitar</button>
        </div>
      </div>`).join("")}
    <div class="totals">
      <div><span>Subtotal</span><b>${money(sub)}</b></div>
      ${db.settings.taxRate ? `<div><span>ISV</span><span>${money(sub * db.settings.taxRate)}</span></div>` : ""}
      <div><span>Envío</span><span>Se calcula con tu ubicación</span></div>
      <div class="grand"><span>Productos + ISV</span><span>${money(sub + sub * db.settings.taxRate)}</span></div>
      <div class="hint">⭐ Al entregar: +${pointsEarned(sub)} pts (L. 100 = 1 pt = L. 1)</div>
    </div>
    <button class="btn gold full checkout-continue" data-go="checkout">Continuar · elegir entrega y pago</button></div>`;
}

function viewCheckout() {
  const user = currentUser();
  if (!user) return viewLogin();
  if (user.role === "admin") {
    return `<div class="auth-wrap"><p>Estás en la cuenta del dueño. Entra con una cuenta de cliente para ordenar.</p><button class="btn" data-go="account">Ir a cuenta</button></div>`;
  }
  const addr = user.addresses?.[0]?.line || "";
  const pts = user.points || 0;
  const canRedeem = canRedeemTorta(user) && cartHasTorta();
  const settings = Store.get().settings;
  const quote = deliveryEstimate(settings);
  return `<div class="customer-shell checkout-page">
    <div class="section-h customer-section"><div><small>Último paso</small><h2>Confirmar orden</h2></div></div>

    <p class="hint">⭐ ${pts} pts = ${money(pointsToLempiras(pts))}. Cada L. 100 = 10 pts (L. 1). Canje solo por torta desde ${ptsForTorta()} pts.</p>
    <form class="form checkout-form" id="checkoutForm">
      <label>¿Cómo lo quieres?</label>
      ${settings.deliveryEnabled!==false?`<select name="type"><option value="delivery">🛵 Domicilio</option><option value="pickup">🏪 Para llevar</option></select>`:`<input type="hidden" name="type" value="pickup"><div class="pickup-only"><b>🥡 Disponible para llevar</b><span>En este momento no tenemos repartidores disponibles. Puedes ordenar y recoger en el restaurante.</span></div>`}
      ${settings.deliveryEnabled!==false?`
      <label>Zona de entrega</label>
      <select name="deliveryZone" id="deliveryZone">
        <option value="altos-chingadazo" ${STATE.checkoutDeliveryZone === "altos-chingadazo" ? "selected" : ""}>🏘️ Envío dentro de Zona por configurar — L. 35</option>
        <option value="route" ${STATE.checkoutDeliveryZone === "route" ? "selected" : ""}>🗺️ Otra zona — calcular ruta real con Google</option>
      </select>
      <label>Dirección</label>
      <input name="address" required value="${addr}" placeholder="Colonia, bloque, casa">
      <label>Referencia</label>
      <input name="addressNotes" placeholder="Portón negro, casa esquinera...">
      <button class="btn ghost" type="button" id="confirmDeliveryLocation">📍 ${STATE.checkoutLocation ? "Ubicación GPS confirmada" : "Confirmar mi ubicación GPS"}</button>
      <p class="hint">Usaremos varias lecturas del GPS y conservaremos la más precisa. Solo el repartidor asignado y Administración podrán verla.</p>
      <div class="delivery-quote" id="deliveryQuote"><b>${STATE.checkoutDeliveryZone === "altos-chingadazo" ? `Tarifa fija ${money(settings.deliveryFixedZoneFee ?? 35)}` : (quote?.fee != null ? `Envío por ruta ${money(quote.fee)}` : "Confirma la ubicación para calcular por carretera")}</b><span>${STATE.checkoutLocation ? `Precisión GPS: ±${Math.round(STATE.checkoutLocation.accuracy || 0)} m${quote?.distanceKm ? ` · ruta ${Number(quote.distanceKm).toFixed(1)} km` : ""}` : "Confirma el GPS desde el lugar donde recibirás el pedido"}</span></div>
      <label>Propina voluntaria para el repartidor</label>
      <select name="tip" id="deliveryTip">
        ${[0,10,20,30,50].map((n) => `<option value="${n}" ${Number(STATE.checkoutTip || 0) === n ? "selected" : ""}>${n ? money(n) : "Sin propina"}</option>`).join("")}
      </select>
      <p class="hint">La propina completa se registra para el repartidor y no cuenta como venta de comida.</p>
      `:`<input type="hidden" name="address" value="Recoger en el restaurante"><input type="hidden" name="addressNotes" value="">`}
      <label>Método de pago</label>
      <select name="payment" id="payMethod">
        <option value="Efectivo">💵 Efectivo</option>
        <option value="Tarjeta">💳 Tarjeta</option>
        <option value="Transferencia">🏦 Transferencia</option>
      </select>
      <div id="cashExtra">
        <label>¿Necesitas cambio?</label>
        <select name="needsChange" id="needsChange">
          <option value="no">No, pago exacto</option>
          <option value="si">Sí, necesito cambio</option>
        </select>
        <div id="payWithWrap" class="hidden">
          <label>¿Con cuánto pagas?</label>
          <input name="payWith" type="number" min="0" step="1" placeholder="Ej. 500">
        </div>
      </div>
      <div class="card-block" style="margin:12px 0">
        ${canRedeem
          ? `<label class="choice-row"><input type="checkbox" name="redeem"> <span>Canjear <b>${ptsForTorta()} pts</b> por una torta mexicana (−${money(TORTA_REDEEM_L)}). Se descuentan al colocar la orden.</span></label>`
          : `<p class="hint" style="margin:0">Tienes ${pts} pts. Canje solo por torta mexicana desde ${ptsForTorta()} pts.</p>`}
      </div>
      <label>Notas para la cocina</label>
      <textarea name="notes" rows="2" placeholder="Sin cebolla, extra salsa..."></textarea>
      ${isStoreOpen(Store.get().settings) ? "" : `
        <div class="okbox">Cerrado ahora. ${hoursBanner(Store.get().settings)}.
          <input type="hidden" name="schedule" value="next">
          El tiempo de preparación corre desde las ${openLabel(Store.get().settings)}.
        </div>`}
      <p class="hint">Al confirmar aceptas los <a href="/informacion.html#terminos" target="_blank" rel="noopener">términos y las políticas de entrega, cancelación y devolución</a>. Los importes se expresan en lempiras (HNL). La opción Tarjeta requiere coordinación con el restaurante; el pago con tarjeta en línea todavía no está habilitado.</p>
      <button class="btn gold full checkout-submit" type="submit">${isStoreOpen(Store.get().settings) ? "Confirmar y enviar mi orden" : "Pedir para las " + openLabel(Store.get().settings)}</button>
    </form></div>`;
}

function viewSuccess() {
  const o = STATE.lastOrder;
  if (!o) return viewOrders();
  const eta = Store.get().settings.waitMin || 25;
  return `<div class="auth-wrap">
    <div class="okbox">¡Gracias por tu orden!</div>
    <h1 style="margin-top:12px">${o.code}</h1>
    <p>${o.status === "programado" || o.scheduledFor
      ? `Recibido. Empezamos a las <b>${openLabel(Store.get().settings)}</b>. Desde esa hora, listo en ~${eta} min.`
      : `Vamos a comenzar con tu orden lo más pronto posible. Tiempo estimado: <b>${eta} min</b>.`}</p>
    <p class="hint">Los puntos (+${o.pointsEarned || 0}) se acreditan cuando el pedido se marque entregado.</p>
    <p><b>Total ${money(o.total)}</b> · ${o.type === "delivery" ? "Domicilio" : "Para recoger"}</p>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn" data-go="orders">Seguir mi orden</button>
      <button class="btn gold" id="waAgain">Reenviar por WhatsApp</button>
    </div>
  </div>`;
}

function viewOrders() {
  const user = currentUser();
  if (!user) return viewLogin();
  const db = Store.get();
  const list = user.role === "admin" ? db.orders : db.orders.filter((o) => o.userId === user.id);
  if (!list.length) return `<div class="auth-wrap"><h1>Aún no hay órdenes</h1><button class="btn" data-go="menu">Ordenar ahora</button></div>`;
  return `<div class="section-h"><h2>${user.role === "admin" ? "Órdenes" : "Mis órdenes"}</h2></div>
    ${list.map((o) => `
      <article class="order">
        <div class="row" style="display:flex;justify-content:space-between;gap:8px">
          <b>${o.code}</b>
          <span class="status s-${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
        </div>
        <div class="hint">${fmtTime(o.createdAt)} · ${o.customerName} · ${o.type}</div>
        <div style="margin:8px 0">${o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</div>
        <b>${money(o.total)}</b>${o.type === "delivery" ? `<div class="hint">Comida ${money(Number(o.subtotal || 0) + Number(o.tax || 0) - Number(o.redeemValue || 0))} · Envío ${money(o.deliveryFee || 0)}${o.tip ? ` · Propina ${money(o.tip)}` : ""}</div>` : ""}
        ${user.role === "customer" && o.type === "delivery" ? customerDeliveryHtml(o) : ""}
        ${user.role === "admin" ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            ${(o.type === "delivery" ? [["nuevo","Nuevo"],["preparacion","En cocina"],["listo","Listo"],["camino","Confirmar entrega al repartidor"],["cancelado","Cancelar"]] : [["nuevo","Nuevo"],["preparacion","En cocina"],["listo","Listo"],["camino","En camino"],["entregado","Entregado al cliente"],["cancelado","Cancelar"]]).map(([s,l]) =>
              `<button class="btn ghost" data-status="${o.id}:${s}">${l}</button>`).join("")}
            <button class="btn gold" data-wa="${o.id}">WhatsApp</button>
          </div>` : ""}
      </article>`).join("")}`;
}

function viewLiveOrder() {
  const user=currentUser(); if(!user) return viewLogin();
  const order=(Store.get().orders||[]).find(o=>o.id===STATE.deliveryTrackOrder&&o.userId===user.id&&o.type==="delivery");
  if(!order) return `<div class="auth-wrap"><h1>Pedido Vivo</h1><p>No encontramos esa entrega en tu cuenta.</p><button class="btn" data-go="orders">Volver a mis órdenes</button></div>`;
  return `<div class="customer-shell live-order-page premium-experience"><div class="experience-head"><button class="experience-back" data-go="orders" aria-label="Volver">‹</button><img src="${Store.get().settings.logoImage||"assets/logo.jpg"}" alt=""><div><small>SEGUIMIENTO SEGURO</small><h1>Pedido Vivo</h1></div></div>${customerDeliveryHtml(order)}</div>`;
}

async function deliveryApi(path, options = {}) {
  const token = await AuthBridge.idToken();
  if (!token) throw new Error("Vuelve a iniciar sesión.");
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar Delivery.");
  return data;
}

function decodeRoutePolyline(s) {
  const out=[]; let i=0,lat=0,lng=0;
  while(i<(s||"").length){for(const which of ["lat","lng"]){let b,shift=0,result=0;do{b=s.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5}while(b>=32);const d=(result&1)?~(result>>1):(result>>1);if(which==="lat")lat+=d;else lng+=d}out.push({lat:lat/1e5,lng:lng/1e5});}
  return out;
}

function deliveryTrailMap(track, orderId) {
  const live = track?.trail || [], planned = decodeRoutePolyline(track?.routePolyline || "");
  const points = planned.length > 1 ? planned : live.length > 1 ? live : [{lat:14.08,lng:-87.18},{lat:14.075,lng:-87.17},{lat:14.07,lng:-87.16}];
  let poly = "20,190 175,115 340,35", x = 50, y = 52, progress = 50, start=[20,190], end=[340,35];
  if (points.length > 1) {
    const lats = points.map(p => Number(p.lat)), lngs = points.map(p => Number(p.lng));
    const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLn = Math.min(...lngs), maxLn = Math.max(...lngs);
    const xy = p => [20 + (Number(p.lng) - minLn) / (maxLn - minLn || 1) * 320, 190 - (Number(p.lat) - minLa) / (maxLa - minLa || 1) * 155];
    poly = points.map(p => xy(p).join(",")).join(" ");
    start=xy(points[0]);end=xy(points[points.length-1]);
    const current=track?.location || live[live.length-1] || points[0];
    let nearest=0,best=Infinity;points.forEach((p,i)=>{const d=(Number(p.lat)-Number(current.lat))**2+(Number(p.lng)-Number(current.lng))**2;if(d<best){best=d;nearest=i;}});
    const here=xy(points[nearest]);x=here[0]/3.6;y=here[1]/2.1;progress=Math.max(3,Math.min(97,nearest/(points.length-1)*100));
  }
  const logo=Store.get().settings.logoImage||"assets/logo.jpg";
  return `<div class="delivery-live-map premium-map">${orderId?`<img class="customer-google-map" data-customer-map="/api/delivery/map/${encodeURIComponent(orderId)}?v=${encodeURIComponent(track?.location?.at||track?.deliveredAt||"")}" alt="Mapa de la ruta en Tegucigalpa">`:""}<div class="map-shade"></div><svg viewBox="0 0 360 210" preserveAspectRatio="none"><polyline class="route-base" pathLength="100" points="${poly}"/><polyline class="route-traveled" pathLength="100" style="stroke-dasharray:${progress} 100" points="${poly}"/><polyline class="route-remaining" pathLength="100" style="stroke-dasharray:${100-progress} 100;stroke-dashoffset:-${progress}" points="${poly}"/></svg><span class="restaurant-map-pin" style="left:${start[0]/3.6}%;top:${start[1]/2.1}%"><img src="${logo}" alt="Restaurante"></span><span class="home-map-pin" style="left:${end[0]/3.6}%;top:${end[1]/2.1}%">⌂</span><span class="delivery-pulse" style="left:${x}%;top:${y}%"></span><img class="delivery-moto" style="left:${x}%;top:${y}%" src="assets/delivery-moto-3d.webp" alt="Repartidor en ruta"></div>`;
}

function customerDeliveryHtml(order) {
  const selected = STATE.view === "live-order" && STATE.deliveryTrackOrder === order.id;
  const cached = STATE.deliveryTrackCache[order.id] || (order.deliveryRating ? { status: "delivered", rating: order.deliveryRating } : null);
  const t = selected ? STATE.deliveryTrack : cached;
  if (!selected && t?.rating) return `<div class="delivery-rated"><span>✓</span><div><b>Calificación enviada · ${Number(t.rating.score || 0)}/5 ${t.rating.emoji || "⭐"}</b><small>Gracias por ayudarnos a mejorar la entrega.</small></div></div>`;
  if (!selected) return `<button class="btn gold" style="margin-top:10px" data-track-delivery="${order.id}">${order.status === "entregado" ? "😊 Calificar entrega" : "🏍️ Abrir Pedido vivo"}</button>`;
  if (!t) return `<div class="okbox" style="margin-top:10px">Buscando al repartidor…</div>`;
  const label = { available:"Buscando repartidor", accepted:"Repartidor asignado", heading_pickup:"Va hacia el restaurante", picked_up:"Tu orden va en camino", delivered:"Entregada" }[t.status] || "Preparando entrega";
  const stages=["Confirmada","En cocina","Recogida","En camino","Entregada"], stage=t.status==="delivered"?4:t.status==="picked_up"?3:["accepted","heading_pickup"].includes(t.status)?2:order.status==="preparacion"?1:0;
  const eta=Math.max(1,Number(t.deliveryEtaMin||order.deliveryEtaMin||Store.get().settings.waitMin||25));
  const aiText=t.status==="picked_up"?"Tu pedido ya salió del restaurante. Comida mexicana, sabor con carácter ya va en camino.":t.status==="delivered"?"Entrega completada. Tu opinión ayudará a mejorar la próxima ruta.":t.driverName?"Tu repartidor ya está asignado y la ruta permanece bajo seguimiento.":"Estamos preparando todo para asignar el mejor recorrido disponible.";
  return `<div class="delivery-track-card order-live"><div class="live-title"><div><small>ORDEN ${escapeHtml(order.code)}</small><h2>${escapeHtml(label)}</h2></div><button class="btn ghost" data-track-delivery="${order.id}">Actualizar</button></div>
    ${t.location || t.status==="delivered" ? deliveryTrailMap(t,order.id) : `<div class="okbox">El mapa se encenderá cuando el repartidor recoja la orden.</div>`}
    <div class="live-eta"><span>Llega en</span><b>${t.status==="delivered"?"Entregada":`${eta}–${eta+4} min`}</b><small>Información actualizada en vivo</small></div>
    <div class="live-progress">${stages.map((name,i)=>`<div class="${i<=stage?"done":""} ${i===stage?"current":""}"><span>${i<stage?"✓":i+1}</span><small>${name}</small></div>`).join("")}</div>
    <div class="live-ai"><b>✨ Chingadazo IA te informa</b><p>${escapeHtml(aiText)}</p></div>
    ${t.driverName ? `<div class="live-driver"><span>${escapeHtml(t.driverName.slice(0,1))}</span><div><b>${escapeHtml(t.driverName)}</b><small>Repartidor verificado</small></div><a href="tel:${escapeHtml(Store.get().settings.phone||"")}">Necesito ayuda</a></div>` : ""}
    ${order.deliveryCode && t.status!=="delivered" ? `<div class="delivery-secure-code"><div>🔒</div><span><b>Entrega protegida</b><small>Ubicación GPS confirmada</small></span><strong>${escapeHtml(order.deliveryCode)}</strong><p>Comparte este código únicamente cuando recibas tu pedido.</p></div>` : ""}
    ${t.status === "delivered" && !t.rating ? `<div class="delivery-rating"><p><b>¿Cómo fue tu entrega?</b></p><p class="hint">Elige del 1 al 5. Cinco es excelente.</p><div class="rating-options">${[{score:1,face:"😞"},{score:2,face:"🙁"},{score:3,face:"😐"},{score:4,face:"😊"},{score:5,face:"😍"}].map(x=>`<button type="button" class="${STATE.deliveryRating[order.id]===x.score?"on":""}" data-rating-choice="${x.score}" data-order="${order.id}" aria-label="${x.score} de 5">${x.face}<small>${x.score}</small></button>`).join("")}</div><textarea id="deliveryRatingNote-${order.id}" maxlength="300" placeholder="Comentario opcional para el repartidor"></textarea><button type="button" class="btn gold full" data-rating-submit="${order.id}" ${STATE.deliveryRating[order.id]?"":"disabled"}>Enviar calificación</button></div>` : ""}
    ${t.rating ? `<p class="hint">Gracias por calificar la entrega: ${Number(t.rating.score || 0)}/5 ${t.rating.emoji || "⭐"}</p>` : ""}
    <div class="live-points"><span>Total ${money(order.total)}</span><b>+${order.pointsEarned||0} Puntos Chingadazo al completar</b></div>
  </div>`;
}

async function loadDeliveryTrack(orderId) {
  try {
    const data = await deliveryApi("/api/delivery/track/" + encodeURIComponent(orderId));
    const changed = JSON.stringify(STATE.deliveryTrack) !== JSON.stringify(data) || STATE.deliveryTrackOrder !== orderId;
    STATE.deliveryTrackOrder = orderId; STATE.deliveryTrack = data;
    STATE.deliveryTrackCache[orderId] = data;
    if (data.rating) Store.patch((d) => { const o=(d.orders || []).find((x)=>x.id===orderId); if (o) o.deliveryRating=data.rating; });
    if (["orders","live-order"].includes(STATE.view) && changed) render();
  } catch (error) {
    STATE.deliveryTrackOrder = orderId; STATE.deliveryTrack = { status: "available", error: error.message };
    if (["orders","live-order"].includes(STATE.view)) render();
  }
}

async function syncCompletedDeliveryRatings() {
  if (STATE.deliveryRatingsSyncing || STATE.view !== "orders" || currentUser()?.role !== "customer") return;
  const pending = (Store.get().orders || []).filter((o) => o.userId === currentUser()?.id && o.type === "delivery" && o.status === "entregado" && !o.deliveryRating && !STATE.deliveryTrackCache[o.id]).slice(0, 30);
  if (!pending.length) return;
  STATE.deliveryRatingsSyncing = true;
  let changed = false;
  await Promise.allSettled(pending.map(async (o) => {
    const data = await deliveryApi("/api/delivery/track/" + encodeURIComponent(o.id));
    STATE.deliveryTrackCache[o.id] = data;
    if (data.rating) {
      Store.patch((d) => { const saved=(d.orders || []).find((x)=>x.id===o.id); if (saved) saved.deliveryRating=data.rating; });
      changed = true;
    }
  }));
  STATE.deliveryRatingsSyncing = false;
  if (changed && STATE.view === "orders") render();
}

function viewLogin() {
  const bonus=Number((Store.get().settings || {}).welcomeBonus ?? 0);
  return `<div class="auth-wrap">
    <section class="signup-first-card">
      ${bonus>0?`<span class="signup-gift">🎁 ${bonus} PUNTOS CHINGADAZO GRATIS</span>`:""}
      <h1>¿Es tu primera orden?</h1>
      <p>Primero crea tu cuenta. Es rápido y te guiaremos paso a paso.</p>
      ${cartCount()?`<div class="okbox">Tu pedido de ${cartCount()} producto${cartCount()===1?"":"s"} está guardado. Regístrate y volverás directamente a confirmarlo.</div>`:""}
      <button class="btn gold full signup-main" data-go="register" type="button"><span class="pointing-hand">👇</span> Crear mi cuenta primero</button>
      <small>Necesitas un correo real que pueda recibir mensajes.</small>
    </section>
    <div class="existing-account"><span>YA TENGO UNA CUENTA</span></div>
    <h2>Entrar</h2>
    <form class="form" id="loginForm">
      <label>Correo electrónico</label>
      <input name="loginId" type="email" required autocomplete="email" placeholder="correo@ejemplo.com">
      <label>Contraseña</label>
      <div class="pass-wrap">
        <input name="password" type="password" required autocomplete="current-password">
        <button type="button" class="pass-eye" data-toggle-pass="password" aria-label="Ver contraseña">👁</button>
      </div>
      <button class="btn full" type="submit">Entrar</button>
    </form>
    ${globalThis.CHINGADAZO_CONFIG?.googleSignInEnabled===true?`<div class="auth-sep"><span>o</span></div>
    <button class="btn google full" type="button" id="googleLogin"><img class="google-mark" src="/icons/google.svg" alt="" width="20" height="20">Continuar con Google</button>`:""}
    <p class="auth-help">Si nunca te registraste, usa el botón amarillo de arriba. Escribir un correo aquí no crea una cuenta.</p>
    <p class="hint">¿Olvidaste la clave? <a href="#" data-go="recover">Recuperar contraseña</a></p>
    <p class="hint"><a href="/informacion.html">Información y políticas</a></p>
    <p class="hint"><a href="#" data-go="privacy">Privacidad</a> · <a href="#" data-go="terms">Términos del servicio</a></p>
  </div>`;
}

function viewStaffAccess() {
  const knownDevice = localStorage.getItem("chingadazo_staff_authorized") === "1";
  const staff=STATE.staffDirectory?.staff||[],selected=staff.find(x=>x.id===STATE.staffSelected)||null;
  if(knownDevice&&!STATE.staffDirectory&&!STATE.staffDirectoryLoading)setTimeout(loadStaffDirectory,0);
  return `<div class="staff-login-shell">
    <div id="staffPinArea" class="${knownDevice ? "" : "hidden"}">
      <header class="staff-login-head"><div><small>PERSONAL · EL CHINGADAZO</small><h1>Cambiar usuario</h1></div><div class="staff-clock">${new Date().toLocaleString("es-HN",{timeZone:"America/Tegucigalpa",dateStyle:"medium",timeStyle:"short"})}</div></header>
      ${STATE.staffDirectoryLoading?`<div class="okbox">Cargando personal…</div>`:`<div class="staff-login-layout"><section><div class="staff-cards">${staff.map(u=>`<button type="button" class="staff-card ${selected?.id===u.id?"on":""}" data-staff-select="${u.id}">${u.photoURL?`<img src="${u.photoURL}" alt="">`:`<span>${escapeHtml((u.name||"?").slice(0,1))}</span>`}<b>${escapeHtml(u.name)}</b><small>${({admin:"Administración",cashier:"Caja",kitchen:"Cocina"}[u.role]||u.role)}</small>${u.shiftOpen?`<i>${u.salesCount} venta${u.salesCount===1?"":"s"} · ${money(u.salesTotal)}</i>`:`<i class="staff-no-shift">Sin turno abierto</i>`}${u.pinReady?"":`<strong class="staff-pin-pending">PIN pendiente</strong>`}${u.shiftOpen?`<em>Turno abierto</em>`:""}</button>`).join("")||`<p class="hint">No encontramos usuarios activos.</p>`}</div></section><aside class="staff-pin-panel"><h2>${selected?escapeHtml(selected.name):"Elige tu usuario"}</h2><div class="staff-pin-dots">${[0,1,2,3,4,5].map(i=>`<i class="${i<STATE.staffPin.length?"on":""}"></i>`).join("")}</div><div class="staff-keypad">${[1,2,3,4,5,6,7,8,9,"b",0,"clear"].map(k=>`<button type="button" data-staff-key="${k}" ${!selected||STATE.staffLoginBusy?"disabled":""}>${k==="b"?"⌫":k==="clear"?"C":k}</button>`).join("")}</div><p>${STATE.staffLoginBusy?"Comprobando acceso…":"Al completar los 6 números entrarás automáticamente"}</p>${STATE.staffLoginMessage?`<div class="errorbox staff-login-error">${escapeHtml(STATE.staffLoginMessage)}</div>`:""}</aside></div>`}
      ${knownDevice?`<details class="fold staff-emergency-access"><summary>Entrar como administrador con correo</summary>
        <form class="form" id="staffAuthorizeForm">
          <p class="hint">Acceso de recuperación para Administración. No elimina usuarios ni ventas.</p>
          <label>Correo del administrador</label><input name="email" type="email" required autocomplete="username">
          <label>Contraseña</label><input name="password" type="password" required autocomplete="current-password">
          <button class="btn gold full" type="submit">Entrar a Administración</button>
        </form>
      </details>`:""}
    </div>
    ${knownDevice?"":`<div id="staffAuthorizeArea">
      <div class="auth-wrap">
      <h1>Autorizar equipo</h1>
      <p class="hint">La primera vez, un administrador debe autorizar este dispositivo con su cuenta.</p>
      <form class="form" id="staffAuthorizeForm">
        <label>Correo del administrador</label>
        <input name="email" type="email" required autocomplete="username">
        <label>Contraseña</label>
        <input name="password" type="password" required autocomplete="current-password">
        <button class="btn gold full" type="submit">Autorizar este dispositivo</button>
      </form>
      </div>
    </div>`}
  </div>`;
}

async function loadStaffDirectory(){
  if(STATE.staffDirectoryLoading)return;
  STATE.staffDirectoryLoading=true;render();
  try{
    const res=await fetch("/api/staff-directory",{cache:"no-store"}),payload=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(payload.error||"No se pudo cargar el personal.");
    STATE.staffDirectory=payload;
    if(!STATE.staffSelected&&payload.staff?.length===1)STATE.staffSelected=payload.staff[0].id;
  }catch(error){
    if(String(error.message).includes("autorizado"))localStorage.removeItem("chingadazo_staff_authorized");
    STATE.staffDirectory={staff:[],error:error.message};
  }finally{STATE.staffDirectoryLoading=false;render();}
}

function viewRecover() {
  if(STATE.recoverySentEmail) return `<div class="auth-wrap recovery-success"><div class="mail-orbit">✉️</div><h1>Revisa tu correo</h1><p>Enviamos el enlace para cambiar tu contraseña a <b>${escapeHtml(STATE.recoverySentEmail)}</b>.</p><div class="verify-checklist"><p>1. Revisa la bandeja de entrada.</p><p>2. Busca también en Spam, No deseados y Promociones.</p><p>3. Abre el enlace y elige una contraseña nueva.</p></div><p class="hint">Si tu buzón está lleno, libera espacio y vuelve a solicitarlo.</p><button class="btn gold full" data-recover-again="1">Enviar de nuevo</button><button class="btn full" data-go="login">Volver a entrar</button></div>`;
  return `<div class="auth-wrap">
    <h1>Recuperar clave</h1>
    <p class="hint">Escribe el correo con el que te registraste. Recibirás un enlace seguro para elegir una contraseña nueva y no perderás tus puntos.</p>
    <form class="form" id="recoverForm">
      <label>Correo</label>
      <input name="email" type="email" required placeholder="tucorreo@gmail.com">
      <button class="btn gold full" type="submit">Enviar enlace de recuperación</button>
    </form>
    <p class="hint"><a href="#" data-go="login">Volver a entrar</a></p>
  </div>`;
}

async function recoverPassword(email) {
  try { await AuthBridge.resetPassword(normalizeEmail(email)); STATE.recoverySentEmail=normalizeEmail(email); render(); }
  catch(error) { alert(AuthBridge.message(error)); }
}

function viewRegister() {
  const google = STATE.googleAuth || null;
  const bonus=Number((Store.get().settings || {}).welcomeBonus ?? 0);
  const existing=google?(Store.get().users||[]).find(u=>u.id==="auth-"+google.uid):null;
  return `<div class="auth-wrap">
    ${existing||bonus<=0?"":`<span class="signup-gift">🎁 ${bonus} PUNTOS CHINGADAZO AL CONFIRMAR</span>`}
    <h1>${google ? "Completa tu cuenta" : "Te guiamos para crear tu cuenta"}</h1>
    <p class="register-warning">${google ? "Completa tus datos para continuar con tu cuenta." : "Usa un correo real con espacio disponible. Te enviaremos un mensaje que debes abrir para activar la cuenta."}</p>
    ${google || globalThis.CHINGADAZO_CONFIG?.googleSignInEnabled!==true ? "" : `<button class="btn google full" type="button" id="googleRegister"><img class="google-mark" src="/icons/google.svg" alt="" width="20" height="20">Registrarme con Google</button><div class="auth-sep"><span>o con correo</span></div>`}
    ${STATE.cart.length?`<p class="okbox">Tu carrito está guardado. Al completar tu cuenta podrás continuar con el pedido.</p>`:""}
    <form class="form" id="registerForm">
      <div class="guided-field"><b>1</b><div><label>Nombre completo</label><input name="name" required autocomplete="name" value="${escapeHtml(existing?.name || google?.displayName || google?.name || "")}"></div></div>
      <div class="split split-2">
        <div class="guided-field"><b>2</b><div><label>DNI / cédula</label><input name="dni" required inputmode="numeric" maxlength="20" value="${escapeHtml(existing?.dni||'')}" placeholder="0801199012345"><small>13 dígitos; puedes usar guiones.</small></div></div>
        <div class="guided-field"><b>3</b><div><label>Teléfono WhatsApp</label><input name="phone" type="tel" required autocomplete="tel" maxlength="20" value="${escapeHtml(existing?.phone||'')}" placeholder="99990000"><small>Honduras +504 · 8 dígitos.</small></div></div>
      </div>
      <div class="guided-field"><b>4</b><div><label>Correo que puedas abrir</label><input name="email" type="email" autocomplete="email" required value="${google ? escapeHtml(google.email || "") : ""}" ${google ? "readonly" : ""}><small>Recibirás aquí el enlace de activación. Revisa también Spam.</small></div></div>
      ${google ? "" : `<div class="guided-field"><b>5</b><div><label>Crear contraseña</label><div class="pass-wrap">
          <input name="password" type="password" minlength="6" required>
          <button type="button" class="pass-eye" data-toggle-pass="password" aria-label="Ver contraseña">👁</button>
        </div></div></div>`}
      <div class="guided-field"><b>${google ? 5 : 6}</b><div><label>Dirección de entrega</label><input name="address" required value="${escapeHtml(existing?.addresses?.[0]?.line||'')}" placeholder="Colonia, bloque, casa / referencia"></div></div>
      <label class="choice-row"><input name="consent" type="checkbox" required> <span>Acepto la <a href="#" data-go="privacy">Política de privacidad</a> y los <a href="#" data-go="terms">Términos del servicio</a>.</span></label>
      <button class="btn full" type="submit">${google ? "Completar registro" : "Registrarme"}</button>
    </form>
    <p class="hint" style="margin-top:12px"><a href="#" data-go="login">Ya tengo cuenta</a></p>
  </div>`;
}

function viewAccount() {
  const user = currentUser();
  if (!user) return viewLogin();
  const db = Store.get();
  return `<div class="auth-wrap account-premium">
    <h1>${user.name}</h1>
    <p class="hint">${({admin:"Dueño",cashier:"Cajero",kitchen:"Cocina",customer:"Cliente"}[user.role] || user.role)} · ${user.username || user.email}</p>
    <p>${user.email || ""}<br>${user.phone || ""}</p>
    ${user.role === "customer" ? `<div class="okbox" style="margin-top:12px">⭐ ${user.points || 0} pts = ${money(pointsToLempiras(user.points || 0))}<br>L. 100 = 10 pts. Canje solo por tortas.</div>
      ${Number(user.pendingWelcomeBonus || 0) > 0 ? `<div class="flash" style="margin-top:12px">✉️ Tienes ${user.pendingWelcomeBonus} puntos pendientes. Actívalos desde el enlace enviado a ${user.email}.<br><button class="btn ghost" id="resendVerification" style="margin-top:8px">Reenviar verificación</button></div>` : ""}
      <button class="btn gold full" data-go="rewards" style="margin-top:12px">Ver mi club de puntos</button>` : `<div class="okbox" style="margin-top:12px">Esta sesión queda en este aparato.</div>`}
    ${user.role === "customer" ? `<section class="card-block"><h3>Tu historia vale 300 puntos</h3><p>Comparte tu comida en Instagram. Desde 500 seguidores, con revisión después de 24 horas.</p><button class="btn gold full" data-go="stories">Ver condiciones y participar</button></section><div class="account-experiences"><div class="section-h"><div><small>Hecho para ti</small><h2>Mis experiencias</h2></div></div>
      ${db.settings.chingadazoAiEnabled !== false ? `<button class="experience-card ai" data-go="chingadazo-ai"><span><img class="experience-icon" src="assets/logo.jpg" alt=""></span><div><b>Chingadazo IA</b><small>Una combinación según tu presupuesto y la hora</small></div><i>›</i></button>` : ""}
      ${db.settings.foodProfileEnabled !== false ? `<button class="experience-card profile" data-go="food-profile"><span><img class="experience-icon" src="assets/logo.jpg" alt=""></span><div><b>Mi Perfil Comelón</b><small>Descubre tu personalidad y desbloqueables</small></div><i>›</i></button>` : ""}
      <button class="experience-card payer" data-go="payer-game"><span><img class="experience-icon" src="assets/logo.jpg" alt=""></span><div><b>¿Quién paga hoy?</b><small>Invitá amigos y que la Ruleta Catracha elija</small></div><i>›</i></button>
      <button class="experience-card chupi" data-go="chupistica"><span><img class="experience-icon" src="assets/logo.jpg" alt=""></span><div><b>Cultura Chupística</b><small>Trivia en vivo para amigos y familia</small></div><i>›</i></button>
      ${db.settings.familyOrderEnabled !== false ? `<button class="experience-card family" data-go="family"><span><img class="experience-icon" src="assets/logo.jpg" alt=""></span><div><b>Pedido en grupo</b><small>Cada quien agrega lo suyo dentro de la app</small></div><i>›</i></button>` : ""}
    </div>` : ""}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${canAdmin() ? `<button class="btn" data-go="admin">Recepción</button><button class="btn" data-go="admin-promos">Promos y avisos</button>` : ""}
      ${canCash() ? `<button class="btn gold" data-go="caja">Abrir caja</button>` : ""}
      ${user.role === "kitchen" ? `<button class="btn" data-go="cocina">Ir a cocina</button>` : ""}
      ${user.role === "customer" ? `<button class="btn ghost" data-tour-start>❔ Ver guía para ordenar</button>` : ""}
      <button class="btn ghost" id="logout">Cerrar sesión</button>
      ${user.role === "customer" && user.authUid ? `<button class="btn ghost" id="deleteAccount">Eliminar mi cuenta</button>` : ""}
    </div>
    <a class="account-info" href="/informacion.html">Información y políticas · Contacto</a>
    <p class="hint" style="margin-top:14px"><a href="#" data-go="privacy">Privacidad</a> · <a href="#" data-go="terms">Términos</a></p>
  </div>`;
}

function viewPrivacy() {
  return `<div class="auth-wrap"><h1>Política de privacidad</h1><p><a href="/informacion.html#privacidad">Consultar la política completa y el contacto del comercio</a></p>
    <p><b>Responsable:</b> El Chingadazo · </p>
    <p>Usamos nombre, teléfono, correo, DNI, dirección, pedidos y puntos para identificar la cuenta, preparar y entregar pedidos, prevenir fraude y administrar el programa de fidelidad.</p>
    <p>Los datos se almacenan en Firebase. No vendemos información personal. Solo el personal autorizado debe usarla para operar el restaurante. Conservamos los datos mientras la cuenta esté activa y los registros de transacciones durante el plazo necesario para obligaciones comerciales o legales.</p>
    <p>Para mejorar la facilidad de uso contamos de forma agregada y anónima cuántas veces se abren etapas como menú, carrito, registro, confirmación y pedido completado. Esta medición no guarda nombres, correos, DNI, teléfonos, direcciones ni ubicaciones.</p>
    <p>Para entregas a domicilio usamos la ubicación exacta del cliente únicamente para calcular y realizar la ruta. Administración puede ver la ubicación del repartidor desde que acepta; el cliente la ve después de que la orden es recogida. El seguimiento termina al entregar o cancelar.</p>
    <p>Las solicitudes de repartidores incluyen identidad, teléfono, residencia, vehículo, licencia, fotografía del rostro y fotografía de la licencia. Estos documentos son privados, se usan para revisar y administrar el acceso de delivery y no se muestran a clientes ni a otros repartidores.</p>
    <p>Puedes solicitar acceso, corrección o eliminación desde tu cuenta o escribiendo a . Al eliminar una cuenta se borra su perfil y se desvinculan sus pedidos; ciertos registros contables pueden conservarse sin los datos de contacto.</p>
    <button class="btn" data-go="home">Volver</button></div>`;
}

function viewTerms() {
  return `<div class="auth-wrap"><h1>Términos del servicio</h1><p><a href="/informacion.html#terminos">Ver términos completos, entregas, cancelaciones y devoluciones</a></p>
    <p>Los pedidos están sujetos a horario, disponibilidad y confirmación del restaurante. El cliente debe proporcionar datos y dirección correctos. Los precios se muestran en lempiras.</p>
    <p>Los puntos se acreditan al entregar pedidos válidos, no tienen valor en efectivo y se canjean conforme a las reglas mostradas en la app. El Chingadazo puede cancelar pedidos fraudulentos o con información falsa.</p>
    <p>Para cambios, cancelaciones o problemas con un pedido, contacta al restaurante lo antes posible.</p>
    <button class="btn" data-go="home">Volver</button></div>`;
}

function myOpenShift() {
  const u = currentUser();
  if (!u) return null;
  const latest=(Store.get().shifts || []).filter((s)=>s?.userId===u.id && !s.closedAt && !s.testArchivedAt)
    .sort((a,b)=>String(b.openedAt||"").localeCompare(String(a.openedAt||"")))[0];
  return latest && !latest.closedAt ? latest : null;
}
function shiftOrders(s) {
  if (!s) return [];
  const from = new Date(s.openedAt).getTime();
  const to = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
  return (Store.get().orders || []).filter((o) => {
    if (!o || o.status === "cancelado") return false;
    const t = new Date(o.paidAt || o.createdAt || 0).getTime();
    if (t < from || t > to) return false;
    return o.paidBy === s.userId || (o.source === "caja" && o.userId === s.userId);
  });
}
function shiftTotals(s) {
  const list = shiftOrders(s);
  const cash = list.filter((o) => o.payment === "Efectivo" && o.paidAt);
  const card = list.filter((o) => o.payment === "Tarjeta" && (o.paidAt || o.source === "caja"));
  const tx = list.filter((o) => o.payment === "Transferencia" && (o.paidAt || o.source === "caja"));
  const sum = (arr) => arr.reduce((a, o) => a + Number(o.total || 0), 0);
  const change = cash.reduce((a, o) => a + Math.max(0, Number(o.payWith || 0) - Number(o.total || 0)), 0);
  const expected = Number(s.fondo || 0) + sum(cash);
  return { list, cash: sum(cash), card: sum(card), transfer: sum(tx), change, expected, n: list.length };
}
async function pushShift(s) {
  const token=await AuthBridge.idToken();
  if(!token)throw new Error("La sesión venció. Cambia de usuario e inténtalo nuevamente.");
  const response=await fetch("/api/data/shifts/" + encodeURIComponent(s.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization:"Bearer "+token },
    body: JSON.stringify(s),
    keepalive: true
  });
  const saved=await response.json();
  if(!response.ok)throw new Error(saved.error || 'No se confirmó el turno.');
  Store.patch(d=>{const i=d.shifts.findIndex(x=>x.id===saved.id);if(i<0)d.shifts.unshift(saved);else d.shifts[i]=saved;});
  return saved;
}
async function openMyShift(fondo) {
  const u = currentUser();
  if (!u || myOpenShift()) return;
  const s = {
    id: Store.uid("sh"),
    userId: u.id,
    userName: u.name,
    openedAt: new Date().toISOString(),
    closedAt: "",
    fondo: Number(fondo || 0),
    counted: 0,
    note: ""
  };
  await pushShift(s);
}
async function closeMyShift(counted, note, shiftId) {
  const s = shiftId ? (Store.get().shifts||[]).find(x=>x.id===shiftId) : myOpenShift();
  if (!s) return;
  const token=await AuthBridge.idToken();
  if(!token)throw new Error("La sesión venció. Cambia de usuario e inténtalo nuevamente.");
  const response=await fetch("/api/close-shift",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({shiftId:s.id,counted:Number(counted||0),note:note||""})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||"No se pudo cerrar el turno.");
  Store.patch(d=>{const i=(d.shifts||[]).findIndex(x=>x.id===payload.shift.id);if(i<0)d.shifts.unshift(payload.shift);else d.shifts[i]=payload.shift;});
  return payload;
}

function isUnpaid(o) {
  if (!o || ["cancelado", "entregado", "facturada"].includes(o.status)) return false;
  if (o.paidAt || o.invoiced) return false;
  if (o.source === "app" || o.channel === "app") return true;
  return o.payment === "Efectivo" && !!o.needsChange;
}

function needsCashier(o) {
  return !!(o
    && !["cancelado", "entregado", "facturada"].includes(o.status)
    && (o.source === "app" || o.channel === "app")
    && !o.invoiced
    && !o.paidAt);
}

function isDeliveredWithoutInvoice(o) {
  return !!(o
    && o.status === "entregado"
    && (o.source === "app" || o.channel === "app")
    && !o.invoiced
    && !o.paidAt);
}

async function queueForCashier(id) {
  const now = new Date().toISOString();
  try {
    const saved = await Cloud.mutateOrder(id, (o) => {
      if (o.invoiced || o.paidAt || o.cashierRequestedAt) return null;
      o.cashierRequestedAt = now;
      o.cashierRequestedBy = currentUser()?.id || "";
      o.updatedAt = now;
      return o;
    });
    if (saved && saved.__transactionApplied === false && (saved.invoiced || saved.paidAt)) {
      alert("Esta orden ya fue cobrada en otro dispositivo.");
    }
    render();
  } catch (error) { alert(error.message || "No se pudo pasar la orden a Caja."); }
}

function paymentMoney(n) { return "L. " + Number(n || 0).toFixed(2); }
function opensDrawer(o) {
  if (!o) return false;
  const role=currentUser()?.role;
  if(o.payment!=="Efectivo" || !['admin','cashier'].includes(role))return false;
  return role==='admin' || Number(o.payWith)>Number(o.total);
}
function autoPrintEnabled(){return window.ChingadazoPrinter?.automatic?.(true)!==false;}

async function openCashDrawer(order) {
  if (!opensDrawer(order)) return;
  const received=Number(order.payWith || order.total || 0),change=Math.max(0,received-Number(order.total||0));
  try{await window.ChingadazoPrinter.drawer();}
  catch(error){reportClientIncident("printer",error.message||"La gaveta no abrió",{area:"Gaveta"});alert(`Cobro guardado, pero la gaveta no abrió. Ábrela manualmente.\n\nRecibido ${paymentMoney(received)} · cambio ${paymentMoney(change)}\n${error.message}`);}
}

const collectingOrders = new Set();
async function collectPendingOrder(id, payOverride, printAfter = autoPrintEnabled()) {
  if (globalThis.navigator?.onLine === false) { alert('Sin internet no se registran cobros. Espera a recuperar la conexión.'); return; }
  if (collectingOrders.has(id)) return;
  collectingOrders.add(id);
  try { return await collectPendingOrderOnce(id, payOverride, printAfter); }
  finally { collectingOrders.delete(id); }
}
async function collectPendingOrderOnce(id, payOverride, printAfter) {
  if (!myOpenShift()) { alert("Abre tu turno antes de cobrar."); go("turno"); return; }
  const o = Store.get().orders.find((x) => x.id === id);
  if (!o) return;
  const payment = payOverride || o.payment || "Efectivo";
  const proofMessage = payment === "Tarjeta"
    ? "¿Confirmas que la terminal aprobó el pago con tarjeta? La app NO cobra la tarjeta automáticamente."
    : payment === "Transferencia"
      ? "¿Confirmas que la transferencia ya aparece recibida en la cuenta del restaurante?"
      : "¿Confirmas que recibiste el efectivo del cliente?";
  const cashMessage = o.type === "delivery" ? "¿Confirmas que recibiste el efectivo del repartidor?" : proofMessage;
  if (!confirm((payment === "Efectivo" ? cashMessage : proofMessage) + "\n\nOrden " + (o.code || id) + " · " + paymentMoney(o.total))) return;
  let payWith = 0;
  if (payment === "Efectivo") {
    const typed = prompt(o.type === "delivery" ? "Efectivo recibido del repartidor (no del cliente):" : "Efectivo recibido del cliente:", String(o.payWith || o.total || ""));
    if (typed == null) return;
    payWith = Number(typed.trim());
    if (!typed.trim() || !Number.isFinite(payWith) || payWith < Number(o.total || 0)) { alert("Ingresa un monto válido que cubra el total."); return; }
    if (!confirm(`Recibido: ${paymentMoney(payWith)}\nTotal: ${paymentMoney(o.total)}\nCambio a devolver: ${paymentMoney(payWith-Number(o.total))}\n\n¿Confirmar cobro?`)) return;
  }
  const sh = myOpenShift();
  let next;
  try {
    next = await Cloud.invoiceOrder(id, {
      payment,
      payWith: payment === "Efectivo" ? payWith : 0,
      shiftId: sh.id
    });
  } catch (error) {
    alert(error.message || "No se confirmó el cobro. No se imprimió factura.");
    return;
  }
  if (!next || !next.invoiced) return;
  if (next.__transactionApplied === false) {
    alert("Esta orden ya fue facturada en otro dispositivo. No se imprimirá otra factura.");
    if (window.Cloud) await Cloud.syncOrders();
    render();
    return;
  }
  if (opensDrawer(next)) await openCashDrawer(next);
  if(printAfter) await printTicket(next, "client");
  render();
  if (next.type === "delivery") {
    alert("Factura guardada. Cuando entregues físicamente la bolsa al repartidor, usa ‘Entregar al repartidor’. Solo el repartidor podrá marcar la entrega final al cliente.");
    return;
  }
  if (!["entregado", "facturada", "cancelado"].includes(next.status)
      && confirm("Factura guardada correctamente.\n\n¿El cliente ya recibió la orden " + (next.code || "") + "?")) {
    await applyOrderStatus(id, "entregado");
  }
}

function posSubtotal() {
  return STATE.posTicket.reduce((a, i) => a + i.unit * i.qty, 0);
}
function loadHolds() {
  const epoch=Store.get().settings?.operationEpoch;
  if(epoch && localStorage.getItem('chingadazo_pos_holds_epoch')!==epoch){
    localStorage.removeItem('chingadazo_pos_holds');localStorage.setItem('chingadazo_pos_holds_epoch',epoch);
  }
  try { return JSON.parse(localStorage.getItem("chingadazo_pos_holds") || "[]"); } catch { return []; }
}
function saveHolds(list) { localStorage.setItem("chingadazo_pos_holds", JSON.stringify(list)); }
function snapshotTicket() {
  return {
    id: Store.uid("hold"),
    savedAt: new Date().toISOString(),
    name: STATE.posName || "Sin nombre",
    channel: STATE.posChannel,
    pay: STATE.posPay,
    change: STATE.posChange,
    payWith: STATE.posPayWith,
    items: structuredClone(STATE.posTicket)
  };
}
function holdCurrentTicket() {
  if (!STATE.posTicket.length) { alert("No hay nada que guardar."); return; }
  const list = loadHolds();
  list.unshift(snapshotTicket());
  saveHolds(list);
  STATE.posTicket = [];
  STATE.posName = "";
  STATE.posPayWith = "";
  STATE.posChange = false;
  render();
}
function resumeHold(id) {
  const list = loadHolds();
  const h = list.find((x) => x.id === id);
  if (!h) return;
  if (STATE.posTicket.length) {
    list.unshift(snapshotTicket());
  }
  saveHolds(list.filter((x) => x.id !== id));
  STATE.posTicket = h.items || [];
  STATE.posName = h.name === "Sin nombre" ? "" : (h.name || "");
  STATE.posChannel = h.channel || "mostrador";
  STATE.posPay = h.pay || "Efectivo";
  STATE.posChange = !!h.change;
  STATE.posPayWith = h.payWith || "";
  render();
}
function dropHold(id) {
  saveHolds(loadHolds().filter((x) => x.id !== id));
  render();
}
function updatePosChangeLabel() {
  const el = document.getElementById("posChangeOut");
  if (!el) return;
  const sub = posSubtotal();
  const pay = Number(STATE.posPayWith || 0);
  if (!pay) { el.textContent = "Escribe con cuánto pagan"; el.className = "hint"; return; }
  if (pay < sub) { el.textContent = "Faltan " + paymentMoney(sub - pay); el.className = "hint"; return; }
  el.textContent = "Cambio a devolver: " + paymentMoney(pay - sub); el.className = "pos-change";
}

async function resetTestSales() {
  if(STATE.resetSending)return;
  STATE.resetSending=true;
  try {
    const token=await AuthBridge.idToken();
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const call=async(path,init={})=>{
      const res=await fetch(path,{...init,headers});const data=await res.json();
      if(!res.ok)throw new Error(data.error||'No se pudo completar el reinicio.');return data;
    };
    const preview=await call('/api/test-reset');
    if(preview.blockers.length)throw new Error(preview.blockers.join('\n'));
    const message=`Se archivarán ${preview.counts.orders} ventas, ${preview.counts.shifts} turnos y ${preview.counts.deliveries} entregas de prueba.\n\nEl respaldo privado se guarda en el servidor. Se conservan menú, precios, usuarios, PIN, puntos e inventario. Revisa por separado los puntos y existencias usados en pruebas.\n\nHazlo con los demás dispositivos cerrados. Escribe ARCHIVAR PRUEBAS para comenzar en cero.`;
    if(prompt(message)!=='ARCHIVAR PRUEBAS')return;
    const result=await call('/api/test-reset',{method:'POST',body:JSON.stringify({fingerprint:preview.fingerprint,confirmation:'ARCHIVAR PRUEBAS'})});
    STATE.posTicket=[];STATE.pendingPosId=null;STATE.pendingPosOrder=null;
    localStorage.removeItem('chingadazo_pos_holds');
    try{await Cloud.sync();render();}catch{alert('El reinicio se completó. Recarga para ver los datos actualizados.');}
    try {
      const backup=await call('/api/test-reset?archive='+encodeURIComponent(result.archiveId));
      const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=result.archiveId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){alert('El respaldo está guardado en el servidor: '+result.archiveId+'. No se pudo descargar: '+error.message);}
    alert('Ventas de prueba archivadas. Recarga los demás dispositivos, revisa inventario y puntos, abre un turno nuevo y reactiva los pedidos cuando estés listo.');
  }catch(error){alert(error.message);}finally{STATE.resetSending=false;}
}

function posResultMatches(saved, pending) {
  const shape = order => JSON.stringify([
    ...['id','userId','customerName','channel','type','address','payment','paidBy','shiftId'].map(key => String(order[key] || '').trim()),
    Number(order.total || 0), Number(order.payWith || 0), !!order.needsChange,
    (order.items || []).map(item => [item.productId, Number(item.qty), Number(item.unit), String(item.note || '').trim(),
      Object.entries(item.mods || {}).map(([key,value]) => [key, (Array.isArray(value) ? value : value ? [value] : []).slice().sort()]).filter(([,value]) => value.length).sort(([a],[b]) => a.localeCompare(b))])
  ]);
  return !!saved?.paidAt && shape(saved) === shape(pending);
}
async function recoverPendingPos() {
  const pending = STATE.pendingPosOrder;
  if (!pending || STATE.posSending) return;
  STATE.posSending = true; render();
  try {
    let saved = await managerApi('/api/data/orders/' + encodeURIComponent(pending.id));
    if (!saved) {
      if (myOpenShift()?.id !== pending.shiftId || currentUser()?.id !== pending.paidBy) throw new Error('El turno o el usuario cambió. Conservamos la cuenta; administración debe revisarla.');
      if (!await Cloud.pushOrder(pending)) throw new Error('La venta sigue sin confirmar. No vuelvas a cobrar.');
      saved = (Store.get().orders || []).find(order => order.id === pending.id);
    }
    if (!posResultMatches(saved, pending)) throw new Error('El resultado requiere revisión. Conservamos el intento original; no vuelvas a cobrar.');
    await localAccount.confirm(pending.id);
    Object.assign(STATE, { pendingPosOrder: null, pendingPosId: null, posTicket: [], posName: '', posPayWith: '' });
    localSignature = JSON.stringify(localDraft());
    localAccountMessage('Venta confirmada en el servidor. Cuenta local conciliada.');
    alert('Venta confirmada. No vuelvas a cobrar. Consulta Órdenes para imprimir si hace falta.');
  } catch (error) { alert(error.message); }
  finally { STATE.posSending = false; render(); }
}

async function sellPosTicket(printAfter = autoPrintEnabled()) {
  if(STATE.posDiningAccountId||globalThis.DiningCash?.pending()){alert('Esta es una cuenta de mesa. Guarda los productos nuevos en espera y usa Cobrar cuenta completa.');return;}
  if (STATE.posSending) return;
  if (globalThis.navigator?.onLine === false) { alert('Sin internet: conserva los consumos. Cobra y envía a cocina cuando vuelva la conexión.'); return; }
  if (globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) { alert('Primero debe estar disponible el guardado local de esta cuenta.'); return; }
  if (typeof localAccount !== 'undefined' && localAccount && STATE.pendingPosOrder) return recoverPendingPos();
  if (!myOpenShift()) { alert("Abre tu turno en la pestaña Turno (fondo inicial) antes de facturar."); go("turno"); return; }
  if (!STATE.posTicket.length) { alert("Toca productos de la familia para armar la cuenta."); return; }
  const user = currentUser();
  const subtotal = posSubtotal();
  const payment = STATE.posPay;
  const payWith = payment === "Efectivo" ? Number(STATE.posPayWith || 0) : 0;
  const needsChange = payment === "Efectivo" && payWith > subtotal;
  if (payment === "Efectivo" && (!Number.isFinite(payWith) || payWith < subtotal)) {
    alert("Con lo que pagan no alcanza el total.");
    return;
  }
  if (payment !== "Efectivo" && !confirm(payment === "Tarjeta"
    ? "¿El pago con tarjeta ya fue aprobado en la terminal?"
    : "¿La transferencia ya fue recibida y confirmada?")) return;
  const paidNow = true;
  const guestName = STATE.posName.trim();
  const customer = guestName ? ensureCustomer({ name: guestName }) : null;
  const order = {
    id: STATE.pendingPosId || (STATE.pendingPosId=Store.uid("ord")),
    code: "CH-" + String((Store.get().orders || []).length + 101).padStart(3, "0"),
    createdAt: new Date().toISOString(),
    status: "nuevo",
    updatedAt: new Date().toISOString(),
    userId: customer ? customer.id : user.id,
    customerName: guestName || (STATE.posChannel === "whatsapp" ? "WhatsApp" : "Para llevar"),
    phone: "",
    type: "pickup",
    channel: STATE.posChannel,
    address: STATE.posChannel === "mostrador" ? "Para llevar" : "WhatsApp",
    payment,
    needsChange,
    payWith,
    notes: "Caja " + STATE.posChannel,
    items: STATE.posTicket.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unit: i.unit, mods: i.mods || {}, modsText: i.modsText, note: i.note })),
    subtotal,
    tax: 0,
    deliveryFee: 0,
    redeemValue: 0,
    total: subtotal,
    pointsEarned: pointsEarned(subtotal),
    pointsGranted: false,
    paidAt: paidNow ? new Date().toISOString() : "",
    paidBy: paidNow ? user.id : "",
    source: "caja",
    receivedAt: new Date().toISOString(),
    receivedBy: user.id,
    shiftId: (myOpenShift() || {}).id || ""
  };
  STATE.posSending=true;
  render();
  let committed=false;
  try {
    // Keep the exact request for an idempotent retry after a lost response.
    const intent = STATE.pendingPosOrder || order;
    if (typeof localAccount !== 'undefined' && localAccount && localReady) {
      await localWork;
      // A failed draft write must not be bypassed by sending the sale anyway.
      if (!localSignature) throw new Error('No se confirmó el guardado local. Conserva los consumos y revisa el almacenamiento.');
      await localAccount.prepare(intent);
    }
    STATE.pendingPosOrder = intent;
    if (!await Cloud.pushOrder(STATE.pendingPosOrder)) throw new Error('No se confirmó la venta. Conservamos la cuenta para reintentar.');
    committed=true;
    const saved=(Store.get().orders || []).find(o=>o.id===STATE.pendingPosOrder.id);
    if (typeof localAccount !== 'undefined' && localAccount && localReady) {
      if (!posResultMatches(saved, STATE.pendingPosOrder)) throw new Error('El resultado requiere revisión; conservamos el intento original.');
      await localAccount.confirm(STATE.pendingPosOrder.id);
    }
    STATE.pendingPosId=null;
    STATE.pendingPosOrder=null;
    STATE.posTicket=[];
    STATE.posName="";
    STATE.posPayWith="";
    STATE.posChange=false;
    if(!saved) throw new Error('Venta registrada. Revisa Órdenes recibidas para imprimir su comprobante.');
    if(opensDrawer(saved)) await openCashDrawer(saved);
    if(printAfter){await printTicket(saved, "kitchen");await printTicket(saved, "client");}
  } catch(error) {
    if((typeof localAccount === 'undefined' || !localAccount) && !committed && [400,401,403].includes(error.status)){STATE.pendingPosOrder=null;STATE.pendingPosId=null;}
    alert((committed ? 'La venta ya está registrada. No vuelvas a cobrar. ' : '')+error.message);
  } finally {
    STATE.posSending=false;
    render();
  }
}

function myDeskOrders() {
  const u = currentUser();
  if (!u) return [];
  if (canCash(u)) return (Store.get().orders || []).filter((o) => o && o.id);
  return (Store.get().orders || []).filter((o) => {
    if (!o || !o.id) return false;
    return o.userId === u.id || o.paidBy === u.id || o.receivedBy === u.id || (o.source === "caja" && o.shiftId && myOpenShift() && o.shiftId === myOpenShift().id);
  });
}

function viewRecibidas() {
  if (!canCash()) return viewLogin();
  const mine = myDeskOrders().slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const live = mine.filter((o) => !["entregado", "facturada", "cancelado"].includes(o.status));
  const done = mine.filter((o) => ["entregado", "facturada", "cancelado"].includes(o.status)).slice(0, 20);
  return `
    <div class="section-h"><h2>Órdenes recibidas</h2><button class="btn ghost" data-go="caja">Caja</button></div>
    <p class="hint">Vista compartida del personal. Los cambios hechos desde cualquier dispositivo aparecen automáticamente.</p>
    <h3>En curso · ${live.length}</h3>
    ${live.length ? live.map(orderCard).join("") : "<p class='hint'>Aún no hay comandas tuyas en curso.</p>"}
    <details class="fold" data-fold="receivedDone" ${STATE.fold?.receivedDone ? "open" : ""}>
      <summary>Completadas · ${done.length}</summary>
      ${done.length ? done.map(orderCard).join("") : "<p class='hint'>Sin historial aún.</p>"}
    </details>`;
}

function viewCaja() {
  if (!canCash()) return viewLogin();
  const db = Store.get();
  const cats = (db.categories || []).filter((c) => c.id !== "destacados");
  const cat = cats.some((c) => c.id === STATE.posCat) ? STATE.posCat : (cats[0] && cats[0].id);
  STATE.posCat = cat;
  const products = (db.products || []).filter((p) => p.available && p.category === cat);
  const newestFirst = (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  const appPending = (db.orders || []).filter(needsCashier).sort(newestFirst);
  const unbilledDelivered = (db.orders || []).filter(isDeliveredWithoutInvoice).sort(newestFirst);
  const counterPending = (db.orders || []).filter((o) => o && o.source === "caja" && o.payment === "Efectivo" && o.needsChange && !o.paidAt && !o.invoiced).sort(newestFirst);
  const holds=loadHolds();
  const activeShift=myOpenShift();
  const inProcess=myDeskOrders().filter((o)=>o&&!['entregado','facturada','cancelado'].includes(o.status)&&!needsCashier(o)).sort(newestFirst);
  const pendingTotal=appPending.length+unbilledDelivered.length+counterPending.length+holds.length;
  const ticket = STATE.posTicket;
  const sub = posSubtotal();
  const guideStep = !ticket.length ? "1. Elige una categoría y toca el producto." : !STATE.posName.trim() ? "2. Escribe el nombre del cliente (puede quedar vacío)." : STATE.posPay === "Efectivo" && !Number(STATE.posPayWith || 0) ? "3. Escribe cuánto efectivo entrega el cliente." : "4. Revisa el total y toca Facturar / enviar a cocina.";
  return `
    <div class="cash-toolbar">
    <div class="section-h pos-heading"><h2>Caja</h2><span>${escapeHtml(currentUser()?.name||"")}</span></div>
    <details class="fold pos-config" data-fold="cashConfig" ${STATE.fold?.cashConfig?"open":""}>
      <summary>⚙️ Configuración</summary>
      ${window.ChingadazoNative?.isApp?'<p class="hint">APK · USB directo. Autoriza la impresora una vez al conectarla. No necesita RawBT.</p>':`<button class="btn gold" id="useRawbt">${window.ChingadazoPrinter?.transport?.()==='rawbt'?'✓ RawBT seleccionado':'Usar RawBT (Android)'}</button><p class="hint">RawBT: cada ticket o apertura aparece en una bandeja para enviarlo con un toque. El botón USB de abajo cambia a conexión directa.</p>`}
      <div class="pos-operations"><button class="btn ${db.settings.deliveryEnabled!==false?"delivery-on":"danger"}" id="toggleDelivery">${db.settings.deliveryEnabled!==false?"🛵 Delivery ACTIVO":"🥡 Delivery PAUSADO"}</button><button class="btn ghost" id="connectPrinter">🖨️ Conectar impresora integrada</button><button class="btn ghost" id="testPrinter">Imprimir prueba</button>${canAdmin()?`<button class="btn ghost" id="testDrawer">Probar gaveta</button>`:""}<button class="btn ghost" id="setPreparationTime">⏱ Tiempo general: ${Number(db.settings.waitMin||25)} min</button><button class="btn ${autoPrintEnabled()?"gold":"ghost"}" id="toggleAutoPrint">${autoPrintEnabled()?"🖨️ Impresión automática":"✓ Elegir imprimir cada venta"}</button><button class="btn ${STATE.cajaGuide ? "gold" : "ghost"}" id="toggleCajaGuide">${STATE.cajaGuide ? "✓ Guía activa" : "🧭 Modo guiado"}</button><button class="btn ghost" data-go="turno">Turno y corte de caja</button>${canAdmin()?`<button class="btn ghost" data-go="admin-products">Fotos / menú</button>`:""}</div>
    </details>
    <button class="btn ghost cash-shift" data-go="turno">${activeShift?'Turno abierto':'Abrir turno'}</button>
    </div>
    ${globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE ? `<div class="cash-save-status"><p id="localAccountStatus" role="status" aria-live="polite">${escapeHtml(localMessage)}</p><details class="cash-offline-help"><summary>Sin internet: límites</summary><p>Sin internet solo se conservan consumos: no cobres ni consideres enviado el pedido. Tras reiniciar, vuelve a conectarte para iniciar sesión y recuperar la cuenta.</p></details></div>` : ''}
    ${STATE.cajaGuide ? `<div class="okbox" style="font-size:16px;margin-bottom:10px"><b>${guideStep}</b></div>` : ""}
    ${activeShift ? '' : `<p class="hint shift-required">Abre tu turno en <a href="#" data-go="turno">Turno y corte de caja</a> antes de facturar.</p>`}
    <div class="pos-wrap">
      <div class="pos-menu">
        <nav class="pos-fams" aria-label="Categorías del menú">${cats.map((c) =>
          `<button class="pos-fam ${c.id === cat ? "on" : ""}" aria-pressed="${c.id === cat}" data-pos-cat="${c.id}">${c.icon || ""} ${escapeHtml(c.name)}</button>`).join("")}</nav>
        <div class="pos-grid">${products.map((p) => `
          <button class="pos-item" data-pos-prod="${p.id}">
            <span class="pos-pic">${productImageUrl(p) ? `<img alt="" src="${productImageUrl(p)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : ""}</span>
            <b>${escapeHtml(p.name)}</b>
            <span class="pos-price">${paymentMoney(p.price)}</span>
          </button>`).join("") || "<p class='hint'>No hay productos en esta familia.</p>"}</div>
      </div>
      <aside class="pos-ticket">
        <div class="pos-ticket-body">
        <section id="diningCashRoot" aria-label="Cuentas de mesas"></section>
        <details class="pos-customer" data-fold="cashCustomer" ${STATE.fold?.cashCustomer?'open':''}><summary>${escapeHtml(STATE.posName||'Cliente opcional')} · ${STATE.posChannel==='whatsapp'?'WhatsApp':'Para llevar'}</summary>
        <div class="pos-channels">
          ${[["mostrador","Para llevar"],["whatsapp","WhatsApp"]].map(([id,l]) =>
            `<button class="btn ${STATE.posChannel === id ? "gold" : "ghost"}" data-pos-ch="${id}">${l}</button>`).join("")}
        </div>
        <input class="pos-name" id="posName" aria-label="Nombre del cliente" placeholder="Nombre del cliente (opcional)" value="${escapeHtml(STATE.posName || "")}" ${STATE.posSending || STATE.pendingPosOrder || (globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) ? "disabled" : ""}>
        </details>
        <div class="pos-ticket-heading"><h3>Cuenta</h3><button class="btn ghost" id="posClear">Vaciar cuenta</button></div>${STATE.posSending ? `<p class="hint" role="status">Registrando venta…</p>` : STATE.pendingPosOrder ? `<p class="hint" role="alert">Venta sin confirmar. Reintenta facturar esta misma cuenta antes de cambiarla.</p>` : ""}
        <div class="pos-lines">${ticket.length ? ticket.map((i) => `
          <div class="pos-line">
            <div><b>${i.qty}× ${escapeHtml(i.name)}</b><div class="hint">${escapeHtml(i.modsText || "")}</div>${i.note ? `<div class="order-note">${escapeHtml(i.note)}</div>` : ""}</div>
            <div>${paymentMoney(i.unit * i.qty)}</div>
            <button class="btn ghost" data-pos-rem="${i.key}">✕</button>
          </div>`).join("") : "<p class='hint'>Toca un plato a la izquierda.</p>"}</div>
        </div>
        <div class="pos-ticket-actions">
        <div class="pos-total">${STATE.posDiningAccountId?'Productos nuevos':'Total'} ${paymentMoney(sub)}</div>
        <details class="pos-payment" data-fold="cashPayment" ${STATE.fold?.cashPayment?'open':''} ${STATE.posDiningAccountId?'hidden':''}>
        <summary>Pago · ${escapeHtml(STATE.posPay)} · configurar</summary><div class="pos-payment-fields">
        <label>Pago</label>
        <div class="pos-channels">
          ${["Efectivo","Tarjeta","Transferencia"].map((p) =>
            `<button class="btn ${STATE.posPay === p ? "gold" : "ghost"}" data-pos-pay="${p}">${p}</button>`).join("")}
        </div>
        ${STATE.posPay === "Efectivo" ? `
          <label for="posPayWith">¿Con cuánto pagan?</label>
          <input id="posPayWith" type="number" min="0" placeholder="Ej. 500" value="${STATE.posPayWith}" ${STATE.posSending || STATE.pendingPosOrder || (globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) ? "disabled" : ""}>
          <button class="btn ghost" type="button" id="posExact">Pago exacto</button>
          <div id="posChangeOut" class="hint">${(() => {
            const pay = Number(STATE.posPayWith || 0);
            if (!pay) return "Escribe con cuánto pagan";
            if (pay < sub) return "Faltan " + paymentMoney(sub - pay);
            if (pay === sub) return currentUser()?.role==="admin" ? "Pago exacto · abre gaveta" : "Pago exacto · sin cambio";
            return "Cambio a devolver: " + paymentMoney(pay - sub);
          })()}</div>
        ` : ""}
        </div></details>
        <div class="pos-sale-buttons" ${STATE.posDiningAccountId?'hidden':''}>
        <button class="btn ${autoPrintEnabled()?"green":"gold"} full" id="posSell" ${ticket.length && !STATE.posSending && globalThis.navigator?.onLine !== false && !(globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) ? "" : "disabled"}>${STATE.pendingPosOrder ? "Consultar venta pendiente" : autoPrintEnabled()?"Facturar e imprimir":"Facturar sin imprimir"}</button>
        ${STATE.pendingPosOrder ? '' : `<button class="btn ${autoPrintEnabled()?"ghost":"green"} full" id="posSellAlternate" ${ticket.length && !STATE.posSending && globalThis.navigator?.onLine !== false && !(globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) ? "" : "disabled"}>${autoPrintEnabled()?"Facturar sin imprimir":"Facturar e imprimir"}</button>`}
        </div>
        <button class="btn full gold" id="posHold" ${ticket.length && !STATE.posSending ? "" : "disabled"}>${STATE.posDiningAccountId?'Guardar nuevos productos en la mesa':'Guardar en espera · asignar mesa'}</button>
        </div>
      </aside>
    </div>
    <div class="pos-work-queues">
      <details class="fold queue-fold ${pendingTotal?"queue-alert":""}" data-fold="cashPending" ${STATE.fold?.cashPending?"open":""}>
        <summary><span>Órdenes pendientes</span><b>${pendingTotal}</b></summary>
        <div class="queue-content">
          ${appPending.length?`<h3>Órdenes de la app por facturar · ${appPending.length}</h3>${appPending.map((o)=>`
            <article class="order"><div class="order-title"><div><b>${o.code}</b> · ${escapeHtml(o.customerName||"Cliente")}</div><span class="status s-${o.status||"nuevo"}">${escapeHtml(o.payment||"")}</span></div>
            <div class="hint">${escapeHtml(o.phone||"")} · ${o.type==="delivery"?escapeHtml(o.address||"Domicilio"):"Para llevar"} · ${fmtHn(o.createdAt)}</div>
            <ul class="order-items">${(o.items||[]).map((i)=>`<li>${i.qty||1}× ${escapeHtml(i.name)}${i.modsText?" — "+escapeHtml(i.modsText):""}${i.note?`<div class="order-note">📝 ${escapeHtml(i.note)}</div>`:""}</li>`).join("")}</ul>
            ${o.notes?`<div class="order-note">📝 Nota general: ${escapeHtml(o.notes)}</div>`:""}<b>Total ${paymentMoney(o.total)}</b>
            <div class="hint">Pago elegido: <b>${escapeHtml(o.payment||"Efectivo")}</b>${o.needsChange?" · requiere cambio"+(o.payWith?" de "+paymentMoney(o.payWith):""):""}</div>
            ${o.payment==="Tarjeta"?`<div class="order-note">Confirma primero la aprobación en la terminal.</div>`:""}
            <button class="btn gold full" data-collect="${o.id}" data-print-choice="${autoPrintEnabled()?"yes":"no"}">${o.type==="delivery"&&o.payment==="Efectivo"?"Confirmar efectivo del repartidor y facturar":`Confirmar pago y facturar ${escapeHtml(o.payment||"")}`}${autoPrintEnabled()?" · imprimir":" · sin imprimir"}</button></article>`).join("")}`:""}
          ${unbilledDelivered.length?`<h3 class="danger-text">🚨 Entregadas sin facturar · ${unbilledDelivered.length}</h3><p class="order-note">Regularízalas para que Caja quede cuadrada.</p>${unbilledDelivered.map((o)=>`<article class="order"><div><b>${o.code}</b> · ${escapeHtml(o.customerName||"Cliente")}</div><div class="hint">${fmtHn(o.createdAt)} · ${escapeHtml(o.payment||"Sin método")}</div><b>Total ${paymentMoney(o.total)}</b><button class="btn gold full" data-collect="${o.id}">Regularizar pago y factura</button></article>`).join("")}`:""}
          ${holds.length?`<h3>Cuentas en espera · ${holds.length}</h3>${holds.map((h)=>`<article class="order"><b>${escapeHtml(h.name)}</b> · ${escapeHtml(h.channel)} · ${h.items.length} ítems · ${paymentMoney((h.items||[]).reduce((a,i)=>a+i.unit*i.qty,0))}<div class="hint">${h.savedAt?fmtTime(h.savedAt):""}</div><div class="queue-actions"><button class="btn gold" data-hold-open="${h.id}">Seguir esta cuenta</button><button class="btn ghost" data-hold-del="${h.id}">Borrar</button></div></article>`).join("")}`:""}
          ${counterPending.length?`<h3>Cuentas locales pendientes de efectivo · ${counterPending.length}</h3>${counterPending.map((o)=>`${orderCard(o)}<button class="btn gold full" data-collect="${o.id}">Cobrar y facturar</button>`).join("")}`:""}
          ${pendingTotal?"":`<p class="empty-queue">✓ No hay cobros ni cuentas pendientes.</p>`}
        </div>
      </details>
      <details class="fold queue-fold" data-fold="cashProcess" ${STATE.fold?.cashProcess?"open":""}>
        <summary><span>Órdenes en proceso</span><b>${inProcess.length}</b></summary>
        <div class="queue-content">${inProcess.length?inProcess.slice(0,20).map(orderCard).join(""):`<p class="empty-queue">No hay órdenes en proceso.</p>`}<button class="btn ghost full" data-go="recibidas">Abrir tablero de órdenes</button></div>
      </details>
    </div>`;
}

function viewTurno() {
  if (!canCash()) return viewLogin();
  const u = currentUser();
  const mine = myOpenShift();
  const hist = (Store.get().shifts || []).filter((s) => canAdmin() || s.userId === u.id).slice(0, 12);
  const tot = mine ? shiftTotals(mine) : null;
  return `
    <div class="section-h"><h2>Turno y arqueo</h2><span>${u.name}</span></div>
    <p class="hint">Jornada habitual: 10:00 a. m.–11:00 p. m. · Cierre automático diario a las 11:00 p. m., hora de Honduras. La apertura requiere registrar el fondo inicial.</p>
    ${canAdmin() ? `<details class="fold" open><summary>Turnos pendientes de cierre</summary>${(Store.get().shifts||[]).filter(s=>s&&!s.closedAt&&!s.testArchivedAt).map(s=>`<article class="order"><b>${escapeHtml(s.userName||s.userId||"Sin usuario")}</b><div class="hint">${s.openedAt?fmtTime(s.openedAt):"Sin fecha de apertura"} · ${escapeHtml(s.id)}</div><button class="btn danger" data-admin-close-shift="${escapeHtml(s.id)}">Revisar y cerrar turno</button></article>`).join("")||`<p class="hint">No quedan turnos abiertos.</p>`}</details>` : ""}
    ${mine ? `
      <div class="okbox">Turno abierto ${fmtTime(mine.openedAt)} · Fondo ${money(mine.fondo)}</div>
      <div class="admin-grid" style="margin-top:12px">
        <div class="kpi"><b>${tot.n}</b><span>Cuentas</span></div>
        <div class="kpi"><b>${money(tot.cash)}</b><span>Efectivo ventas</span></div>
        <div class="kpi"><b>${money(tot.card)}</b><span>Tarjeta</span></div>
        <div class="kpi"><b>${money(tot.transfer)}</b><span>Transfer</span></div>
      </div>
      <p>Caja esperada (fondo + efectivo): <b>${money(tot.expected)}</b></p>
      <form class="form" id="closeShiftForm">
        <label>Arqueo — ¿cuánto hay en gaveta?</label>
        <input name="counted" type="number" min="0" required placeholder="${tot.expected}">
        <label>Nota (faltante / sobrante)</label>
        <input name="note" placeholder="Opcional">
        <button class="btn danger full" type="submit">Cerrar turno y cortar caja</button>
      </form>
    ` : `
      <p class="hint">Cada cajero y el dueño abren su propio turno. Así el arqueo cuadra por persona.</p>
      <form class="form" id="openShiftForm">
        <label>Fondo inicial en gaveta (L.)</label>
        <input name="fondo" type="number" min="0" value="0" required>
        <button class="btn gold full" type="submit">Abrir mi turno</button>
      </form>
    `}
    ${(() => {
      const closed = hist.filter((s) => s.closedAt);
      const byDay = {};
      closed.forEach((s) => {
        const k = (s.closedAt || s.openedAt || "").slice(0, 10) || "otros";
        (byDay[k] = byDay[k] || []).push(s);
      });
      const days = Object.keys(byDay).sort().reverse();
      return `<details class="fold" data-fold="cortes">
        <summary>Cortes por día · ${closed.length}</summary>
        ${days.map((day) => `<details class="fold"><summary>${day} · ${byDay[day].length}</summary>
          ${byDay[day].map((s) => `
            <article class="order">
              <b>${escapeHtml(s.userName||"Empleado")}</b> · ${fmtTime(s.openedAt)} → ${fmtTime(s.closedAt)}${s.autoClosed?`<div class="okbox">Turno cerrado automáticamente · 11:00 p. m.</div>`:""}
              <div class="hint">${Number(s.n||0)} transacciones · Venta ${money(s.sales||Number(s.cash||0)+Number(s.card||0)+Number(s.transfer||0))}<br>Fondo ${money(s.fondo)} · Efectivo ${money(s.cash)} · Tarjeta ${money(s.card)} · Transferencia ${money(s.transfer)} · Esperado ${money(s.expected)} · ${s.arqueoPending?"Arqueo pendiente · efectivo contado y diferencia sin determinar":`Contado ${money(s.counted)} · Dif. ${money(s.diff)}`}</div>
              <div class="shift-email ${s.emailStatus||""}">${s.emailStatus==="sent"?`✓ Cierre enviado a ${escapeHtml(s.emailTo||"")}`:s.emailStatus==="pending_configuration"?"⚠ Cierre guardado · falta activar el correo automático":s.emailStatus==="failed"?"⚠ Cierre guardado · correo pendiente de reintento":""}</div>
              ${s.emailStatus&&!["sent","not_requested"].includes(s.emailStatus)?`<button class="btn ghost" data-resend-shift="${s.id}">Reintentar correo</button>`:""}
              ${s.arqueoPending?`<button class="btn gold" data-admin-close-shift="${escapeHtml(s.id)}">Registrar arqueo pendiente</button>`:""}
              ${s.note ? `<div class="hint">${escapeHtml(s.note)}</div>` : ""}
            </article>`).join("")}
        </details>`).join("") || "<p class='hint'>Aún no hay cortes.</p>"}
      </details>`;
    })()}`;
}

function viewCocina() {
  if (!canKitchen()) return viewLogin();
  setTimeout(() => Alarm.unlock(), 200);
  setTimeout(() => Alarm.sync(), 400);
  if (currentUser().role === "kitchen") return viewKitchenBoard();
  return `
    <div class="section-h"><h2>Cocina</h2><span>${currentUser().name}</span></div>
    <p class="hint">Toca una vez <b>Activar sonido</b> (el celular lo pide). La pestaña Nuevos parpadea en verde hasta Recibir.</p>
    <button class="btn gold" id="unlockSound" type="button">Activar sonido de cocina</button>
    ${viewAdminOrders(true)}`;
}

function kitchenAgeClass(o) {
  const from = new Date(o.receivedAt || o.createdAt || Date.now()).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - from) / 60000));
  return minutes >= 20 ? "late" : minutes >= 10 ? "warn" : "fresh";
}

function kitchenTicket(o) {
  const customer = escapeHtml(o.customerName || "Cliente");
  const action = o.status === "nuevo"
    ? `<button class="kds-action receive" data-accept="${o.id}">RECIBIR Y PREPARAR</button>`
    : o.status === "preparacion"
    ? `<button class="kds-action ready" data-status="${o.id}:listo">MARCAR LISTA</button>`
    : `<div class="kds-ready-label">✓ LISTA · ESPERANDO ENTREGA</div>`;
  return `<article class="kds-ticket ${kitchenAgeClass(o)}">
    <header class="kds-ticket-head">
      <div><span class="kds-code">${escapeHtml(o.code || o.id)}</span><strong class="kds-customer">${customer}</strong></div>
      <span class="kds-timer timer-chip" data-oid="${o.id}">${orderElapsed(o)}</span>
    </header>
    <div class="kds-meta">${o.type === "delivery" ? "🛵 DOMICILIO" : "🥡 PARA LLEVAR"}${o.scheduledFor ? ` · ⏰ ${fmtHn(o.scheduledFor)}` : ""}</div>
    <div class="kds-items">${(o.items || []).map((i) => `<section class="kds-item">
      <b><span>${Number(i.qty || 1)}×</span> ${escapeHtml(i.name || "Producto")}</b>
      ${i.modsText ? `<p>${escapeHtml(i.modsText)}</p>` : ""}
      ${i.note ? `<div class="kds-note">★ ${escapeHtml(i.note)}</div>` : ""}
    </section>`).join("") || `<p>Sin detalle</p>`}</div>
    ${o.notes ? `<div class="kds-note general">★ NOTA: ${escapeHtml(o.notes)}</div>` : ""}
    ${action}
  </article>`;
}

function viewKitchenBoard() {
  const today = hnYmd();
  const list = (Store.get().orders || []).filter((o) => o && o.id && orderServiceDay(o) === today);
  const scheduled = list.filter((o) => o.status === "programado").sort((a,b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));
  const active = list.filter((o) => ["nuevo","preparacion","listo"].includes(o.status))
    .sort((a,b) => String(a.receivedAt || a.createdAt).localeCompare(String(b.receivedAt || b.createdAt)));
  return `<div class="kds-shell">
    <div class="kds-toolbar"><button class="btn ghost" type="button" data-kds-mode>Modo TV / normal</button>
      <div><h1>Cocina</h1><p>${escapeHtml(currentUser().name)} · Órdenes de hoy</p></div>
      <button class="btn gold" id="unlockSound" type="button">🔊 Activar sonido</button>
    </div>
    ${scheduled.length ? `<details class="kds-scheduled"><summary>⏰ Programadas para más tarde · ${scheduled.length}</summary>${scheduled.map((o) => `<div><b>${escapeHtml(o.code)}</b> · ${escapeHtml(o.customerName || "Cliente")} · ${fmtHn(o.scheduledFor)}</div>`).join("")}</details>` : ""}
    <div class="kds-pages"><span data-kds-count></span><button class="btn ghost" type="button" data-kds-page="-1">‹</button><button class="btn ghost" type="button" data-kds-page="1">›</button><button class="btn ghost" data-go="account">Cuenta</button></div>
    <div class="kds-board">${active.length ? active.map(kitchenTicket).join("") : `<div class="kds-empty"><span>✓</span><h2>Cocina al día</h2><p>No hay órdenes pendientes de hoy.</p></div>`}</div>
  </div>`;
}

function viewTeam() {
  if (!canAdmin()) return viewLogin();
  const staff = Store.get().users.filter((u) => u.active !== false && u.directoryHidden !== true && ["admin", "cashier", "kitchen"].includes(u.role));
  const roleName = { admin: "Dueño / administrador", cashier: "Caja", kitchen: "Cocina" };
  return `<div class="section-h"><h2>Usuarios y roles</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <p class="hint">Crea un usuario con su nombre, rol y PIN de 6 números. También los administradores pueden entrar con PIN en los equipos autorizados. Conserva la cuenta principal con correo para autorizar equipos nuevos.</p>
    <details class="fold" data-fold="addStaff" ${STATE.fold?.addStaff ? "open" : ""}>
      <summary>Agregar usuario</summary>
      <form class="form" id="staffForm">
        <label for="staffName">Nombre</label><input id="staffName" name="name" required maxlength="100" placeholder="Ej. Ana López">
        <label for="staffRole">Rol</label>
        <select id="staffRole" name="role" required>
          <option value="cashier">Caja</option>
          <option value="kitchen">Cocina</option>
          <option value="admin">Dueño / administrador</option>
        </select>
        <label>Foto del empleado (opcional)</label><input name="photo" type="file" accept="image/jpeg,image/png,image/webp">
        <small class="hint">Se recorta automáticamente en formato cuadrado. Si no agregas foto, mostraremos su inicial.</small>
        <label for="staffPin">PIN de acceso</label><input id="staffPin" name="pin" type="password" required inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" placeholder="Exactamente 6 números">
        <button class="btn gold full" type="submit">Guardar usuario</button>
      </form>
    </details>
    <h3>Usuarios actuales · ${staff.length}</h3>
    ${staff.map((u) => `<article class="order staff-admin-row">${u.photoURL?`<img src="${u.photoURL}" alt="">`:`<span>${escapeHtml((u.name||"?").slice(0,1))}</span>`}<div><b>${escapeHtml(u.name)}</b> · ${roleName[u.role] || u.role}<div class="hint">${u.email ? `Correo: ${escapeHtml(u.email)} · ` : ""}Código: ${escapeHtml(u.authUid || u.id)} · acceso según rol</div><div class="staff-admin-actions"><details><summary class="btn ghost">Editar nombre</summary><form class="form" data-staff-name-form="${escapeHtml(u.id)}"><label>Nombre<input name="name" required maxlength="100" value="${escapeHtml(u.name)}"></label><button class="btn gold" type="submit">Guardar nombre</button></form></details>${u.id!==currentUser()?.id?`<button class="btn danger" type="button" data-staff-remove="${escapeHtml(u.id)}">Eliminar usuario</button>`:""}<label class="btn ghost staff-photo-button">${u.photoURL?"Cambiar foto":"Agregar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" data-staff-photo="${u.id}"></label><details class="staff-pin-reset"><summary class="btn ghost">Asignar o cambiar PIN</summary><form class="form" data-staff-pin-form="${u.id}"><label>Nuevo PIN de 6 números</label><input name="pin" required inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password"><button class="btn gold" type="submit">Guardar PIN</button></form></details></div></div></article>`).join("")}`;
}

function staffAvatarFile(file){
  if(!file)return Promise.resolve("");
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{try{const size=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-size)/2,sy=(img.naturalHeight-size)/2,canvas=document.createElement("canvas");canvas.width=320;canvas.height=320;canvas.getContext("2d").drawImage(img,sx,sy,size,size,0,0,320,320);URL.revokeObjectURL(url);resolve(canvas.toDataURL("image/jpeg",.72));}catch(error){reject(error);}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("No se pudo leer la foto."));};img.src=url;
  });
}

function viewAdmin() {
  const user = currentUser();
  if (!canAdmin()) return viewLogin();
  const db = Store.get();
  const orders = (db.orders || []).filter(Boolean);
  const today = orders.filter((o) => o.createdAt && new Date(o.createdAt).toDateString() === new Date().toDateString());
  const sales = today.reduce((a, o) => a + (isRevenueOrder(o) ? Number(o.total || 0) : 0), 0);
  const news = orders.filter((o) => o.status === "nuevo").length;
  return `
    <div class="section-h"><h2>Recepción</h2><span>${window.Cloud ? Cloud.getStatus() : "local"}</span></div>
    <div class="admin-grid">
      <div class="kpi"><b>${news}</b><span>Nuevos</span></div>
      <div class="kpi"><b>${today.length}</b><span>Hoy</span></div>
      <div class="kpi"><b>${money(sales)}</b><span>Ventas hoy</span></div>
      <div class="kpi"><b>${db.settings.waitMin || 25} min</b><span>Tiempo actual</span></div>
    </div>
    <div class="ops-row">
      <button class="btn ${db.settings.open ? "gold" : "danger"}" id="toggleOpen">${db.settings.open ? "Local ABIERTO" : "Local CERRADO"}</button>
      <button class="btn ${db.settings.deliveryEnabled!==false?"delivery-on":"danger"}" id="toggleDelivery">${db.settings.deliveryEnabled!==false?"🛵 Delivery ACTIVO":"🥡 Delivery PAUSADO"}</button>
      <button class="btn ${db.settings.doublePoints ? "gold" : "ghost"}" id="toggleDouble">${db.settings.doublePoints ? "Doble puntos ON" : "Activar doble de puntos"}</button>
      <label class="wait-lab">Tiempo de espera</label>
      <div class="wait-row">${WAIT_OPTS.map((m) =>
        `<button class="btn ${Number(db.settings.waitMin) === m ? "gold" : "ghost"}" data-wait="${m}">${m} min</button>`
      ).join("")}</div>
    </div>
    <div class="toolbar">
      <button class="btn gold" data-go="caja">💵 Caja</button>
      <button class="btn gold" data-go="admin-crm">📅 Ventas</button>
      <button class="btn" data-go="turno">🧮 Turno</button>
      <button class="btn" data-go="admin-products">🍽️ Menú</button>
      <button class="btn" data-go="admin-users">👥 Usuarios</button>
      <button class="btn ghost" data-go="admin-cover">🖼️ Portada</button>
      <button class="btn ghost" data-go="admin-settings">⚙️ Ajustes</button>
      <button class="btn ghost" data-go="admin-promos">⚡ Promos</button>
      <button class="btn gold" data-go="admin-delivery">🏍️ Delivery</button>
      <button class="btn gold" data-go="admin-insights">📈 Conversión de la app</button>
      <button class="btn manager-main" data-go="admin-manager">🧠 Gerente IA</button>
      <button class="btn manager-cost" data-go="admin-costs">📦 Costos e inventario</button>
      <button class="btn manager-system" data-go="admin-system">🛡️ Estado del sistema</button>
    </div>
    <p class="hint">En el celular toca <b>Activar sonido</b> y acepta notificaciones. La alerta no para hasta Recibir. Deja esta pestaña abierta.</p>
    <button class="btn gold" id="unlockSound" type="button">Activar sonido de cocina</button>
    ${viewAdminOrders(true)}`;
}

async function loadFunnelReport() {
  try {
    const token=await AuthBridge.idToken();
    const res=await fetch("/api/analytics/report",{headers:{Authorization:"Bearer "+token}});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||"No se pudo cargar la medición.");
    STATE.funnelReport=data;
  } catch(error) { STATE.funnelReport={error:error.message}; }
  if(STATE.view==="admin-insights") render();
}

function viewAdminInsights() {
  if(!canAdmin()) return viewLogin();
  const report=STATE.funnelReport;
  if(!report) return `<div class="section-h"><h2>Conversión de la app</h2><button class="btn ghost" data-go="admin">Volver</button></div><div class="okbox">Cargando medición…</div>`;
  if(report.error) return `<div class="section-h"><h2>Conversión de la app</h2><button class="btn ghost" data-go="admin">Volver</button></div><div class="errorbox">${escapeHtml(report.error)}</div>`;
  const totals={};
  (report.days||[]).forEach(d=>Object.entries(d.events||{}).forEach(([k,v])=>totals[k]=Number(totals[k]||0)+Number(v||0)));
  const stages=[["visit","Abrieron"],["menu_view","Vieron menú"],["cart_add","Agregaron"],["cart_view","Vieron carrito"],["checkout_start","Iniciaron confirmación"],["order_complete","Enviaron pedido"]];
  const pct=(a,b)=>b?Math.round((Number(a||0)/Number(b))*100):0;
  return `<div class="customer-shell insights-page">
    <div class="section-h"><div><small>Últimos 14 días</small><h2>Conversión de la app</h2></div><button class="btn ghost" data-go="admin">Volver</button></div>
    <div class="card-block"><p>${report.resetAt?`Medición desde ${escapeHtml(fmtTime(report.resetAt))}.`:"Incluye conteos anteriores y de prueba."}</p><button class="btn ghost" type="button" id="resetFunnelMetrics">Reiniciar métricas de navegación</button><p class="hint">Archiva los conteos actuales. Conserva ventas, pedidos, clientes y puntos. Son eventos agregados por sesión, no un seguimiento individual de abandonos.</p></div>
    <div class="insights-funnel">${stages.map(([key,label],i)=>`<div><span>${i+1}</span><b>${Number(totals[key]||0)}</b><small>${label}</small>${i?`<em>${pct(totals[key],totals[stages[i-1][0]])}% avanzó</em>`:""}</div>`).join("")}</div>
    <div class="admin-grid"><div class="kpi"><b>${pct(totals.order_complete,totals.visit)}%</b><span>Visita → pedido</span></div><div class="kpi"><b>${pct(totals.checkout_start,totals.cart_view)}%</b><span>Carrito → confirmar</span></div><div class="kpi"><b>${pct(totals.ai_accept,totals.ai_view)}%</b><span>Aceptó sugerencia</span></div><div class="kpi"><b>${Number(totals.family_checkout||0)}</b><span>Pedidos familiares</span></div><div class="kpi"><b>${Number(totals.profile_view||0)}</b><span>Perfiles vistos</span></div><div class="kpi"><b>${Number(totals.live_order_view||0)}</b><span>Pedido Vivo abierto</span></div></div>
    <div class="card-block"><h3>Programa de mejora semanal</h3><ol class="improvement-loop"><li>Identifica el paso con la caída más grande.</li><li>Cambia una sola cosa visible para el cliente.</li><li>Espera 7 días o al menos 100 aperturas.</li><li>Compara la tasa y conserva únicamente lo que aumente pedidos.</li></ol><p class="hint">${escapeHtml(report.privacy||"")}</p></div>
    <details class="fold"><summary>Detalle diario</summary><div class="insights-days">${(report.days||[]).slice().reverse().map(d=>`<div><b>${escapeHtml(d.day)}</b><span>${Number(d.events?.visit||0)} aperturas · ${Number(d.events?.cart_add||0)} carritos · ${Number(d.events?.order_complete||0)} pedidos</span></div>`).join("")}</div></details>
  </div>`;
}

async function managerApi(path, options = {}) {
  const token = await AuthBridge.idToken();
  if (!token) throw new Error("La sesión administrativa venció. Vuelve a ingresar.");
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(options.headers || {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `No se pudo completar la operación (${response.status}).`),{status:response.status});
  return payload;
}

async function loadManagerData(force = false) {
  if (STATE.managerLoading) return;
  if (STATE.managerData && !force) return;
  STATE.managerLoading = true;
  STATE.managerError = "";
  if (["admin-manager", "admin-costs", "admin-system"].includes(STATE.view)) render();
  try {
    const day = STATE.managerDay ? `?day=${encodeURIComponent(STATE.managerDay)}` : "";
    STATE.managerData = await managerApi("/api/manager/overview" + day);
    STATE.managerDay = STATE.managerData.day || STATE.managerDay;
  } catch (error) { STATE.managerError = error.message; }
  finally {
    STATE.managerLoading = false;
    if (["admin-manager", "admin-costs", "admin-system"].includes(STATE.view)) render();
  }
}

const managerMoney = (value) => value == null ? "Pendiente" : "L. " + Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const managerQuality = (value) => ({ confirmed: "Confirmado con inventarios", calculated: "Calculado", estimated: "Estimado", pending: "Datos pendientes" }[value] || "Datos pendientes");
const managerSeverity = (value) => ({ critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo", ok: "Correcto" }[value] || value);

function managerHeader(title, active) {
  return `<div class="manager-head"><div><small>Administración protegida</small><h2>${title}</h2></div><button class="btn ghost" data-go="admin">Volver</button></div>
    <nav class="manager-nav" aria-label="Módulos del gerente">
      <button class="${active === "ai" ? "on" : ""}" data-go="admin-manager">🧠 Gerente IA</button>
      <button class="${active === "costs" ? "on" : ""}" data-go="admin-costs">📦 Costos</button>
      <button class="${active === "system" ? "on" : ""}" data-go="admin-system">🛡️ Sistema</button>
    </nav>`;
}

function managerLoadingHtml() {
  if (STATE.managerError) return `<div class="errorbox">${escapeHtml(STATE.managerError)}</div><button class="btn" data-manager-reload>Reintentar</button>`;
  return `<div class="okbox">Analizando ventas, costos y estado operativo…</div>`;
}

function viewAdminManager() {
  if (!canAdmin()) return viewLogin();
  const data = STATE.managerData;
  if (!data) return managerHeader("Gerente IA", "ai") + managerLoadingHtml();
  const cost = data.cost || {}, health = data.health || {}, recommendations = data.recommendations || [];
  const trends = data.trends || {};
  return `<section class="manager-page">
    ${managerHeader("Gerente IA", "ai")}
    <div class="manager-status-row"><span class="system-dot ${health.status || "yellow"}"></span><b>Sistema ${health.status === "green" ? "estable" : health.status === "red" ? "requiere atención" : "con observaciones"}</b><span>${data.configured ? `IA activa · ${escapeHtml(data.model)} · ${Number(data.usage?.requests || 0)}/${Number(data.usage?.requestLimit || 300)} consultas` : "IA pendiente de activación"}</span><button class="btn ghost" data-manager-reload>Actualizar</button></div>
    <div class="manager-kpis">
      <article><small>Ventas netas</small><b>${managerMoney(cost.salesNet)}</b><span>${Number(cost.orderCount || 0)} transacciones</span></article>
      <article><small>Costo usado</small><b>${managerMoney(cost.selectedCost)}</b><span>${managerQuality(cost.dataQuality)}</span></article>
      <article><small>Utilidad bruta</small><b>${managerMoney(cost.grossProfit)}</b><span>Margen ${Number(cost.grossMarginPct || 0).toFixed(1)}%</span></article>
      <article><small>Desperdicios registrados</small><b>${managerMoney(cost.wasteCost)}</b><span>Día ${escapeHtml(cost.day || "")}</span></article>
    </div>
    <div class="manager-periods"><span><b>Ayer</b>${managerMoney(trends.previousDay?.salesNet)}</span><span><b>Últimos 7 días</b>${managerMoney(trends.week?.salesNet)} · utilidad ${managerMoney(trends.week?.grossProfit)}</span><span><b>Últimos 30 días</b>${managerMoney(trends.month?.salesNet)} · utilidad ${managerMoney(trends.month?.grossProfit)}</span></div>
    ${!data.configured ? `<div class="manager-activation"><b>Gerente IA preparado, pendiente de clave</b><p>Las métricas y alertas ya funcionan sin consumo de API. Para conversar con el Gerente IA configura <code>OPENAI_API_KEY</code> y, opcionalmente, <code>OPENAI_MODEL</code> como secretos del Worker.</p></div>` : ""}
    <div class="manager-columns">
      <section class="manager-card"><div class="section-h"><h3>Atención recomendada</h3><span>${recommendations.length}</span></div>
        ${recommendations.length ? recommendations.map((row) => `<article class="manager-alert severity-${row.severity}"><div><small>${managerSeverity(row.severity)} · ${escapeHtml(row.area)}</small><b>${escapeHtml(row.title)}</b><p>${escapeHtml(row.detail)}</p><em>Propuesta: ${escapeHtml(row.suggestedAction)}</em></div><div>${row.status === "approved" ? `<span class="decision approved">Aprobada</span>` : row.status === "dismissed" ? `<span class="decision dismissed">Descartada</span>` : `<button class="btn gold" data-manager-decision="${escapeHtml(row.id)}:approved">Aprobar</button><button class="btn ghost" data-manager-decision="${escapeHtml(row.id)}:dismissed">Descartar</button>`}</div></article>`).join("") : `<div class="okbox">No hay recomendaciones pendientes.</div>`}
      </section>
      <section class="manager-card manager-chat"><h3>Preguntar al Gerente IA</h3><p class="hint">La IA recibe métricas resumidas, nunca PIN, contraseñas ni datos de tarjetas.</p>
        <form id="managerAskForm"><textarea name="question" maxlength="800" required placeholder="Ej. ¿Qué producto deja más utilidad y qué información falta?"></textarea><button class="btn manager-main" type="submit" ${!data.configured ? "disabled" : ""}>Analizar</button></form>
        ${STATE.managerAnswer ? `<div class="manager-answer"><b>Respuesta</b><p>${escapeHtml(STATE.managerAnswer).replace(/\n/g, "<br>")}</p><small>${managerQuality(cost.dataQuality)} · ${escapeHtml(cost.day || "")}</small></div>` : ""}
      </section>
    </div>
  </section>`;
}

function viewAdminCosts() {
  if (!canAdmin()) return viewLogin();
  const data = STATE.managerData;
  if (!data) return managerHeader("Costos e inventario", "costs") + managerLoadingHtml();
  const suppliers = data.suppliers || [], ingredients = data.ingredients || [], recipes = data.recipes || [], cost = data.cost || {};
  const supplierOptions = suppliers.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
  const ingredientOptions = ingredients.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)} · ${escapeHtml(row.consumptionUnit || "unidad")}</option>`).join("");
  const productOptions = (Store.get().products || []).filter((row) => row?.id).map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
  return `<section class="manager-page">
    ${managerHeader("Costos e inventario", "costs")}
    <div class="manager-date"><label>Día del informe <input id="managerDay" type="date" value="${escapeHtml(data.day || STATE.managerDay || "")}"></label><button class="btn" data-manager-day>Calcular</button><span class="quality quality-${cost.dataQuality}">${managerQuality(cost.dataQuality)}</span></div>
    <div class="manager-kpis">
      <article><small>Ventas netas</small><b>${managerMoney(cost.salesNet)}</b><span>${Number(cost.orderCount || 0)} transacciones</span></article>
      <article><small>Costo teórico</small><b>${managerMoney(cost.theoreticalCost)}</b><span>Según recetas</span></article>
      <article><small>Costo real</small><b>${managerMoney(cost.actualCost)}</b><span>Inventario inicial + compras − final</span></article>
      <article><small>Utilidad bruta</small><b>${managerMoney(cost.grossProfit)}</b><span>${Number(cost.grossMarginPct || 0).toFixed(1)}% de margen</span></article>
    </div>
    <div class="manager-cost-layout">
      <details class="manager-card" open><summary>1. Proveedores · ${suppliers.length}</summary><form class="form compact" id="managerSupplierForm"><label>Nombre</label><input name="name" required maxlength="180"><label>Teléfono</label><input name="phone"><label>Correo</label><input name="email" type="email"><label>Notas</label><textarea name="notes" maxlength="600"></textarea><button class="btn gold" type="submit">Guardar proveedor</button></form>${suppliers.map((row) => `<div class="manager-list-row"><b>${escapeHtml(row.name)}</b><span>${escapeHtml(row.phone || row.email || "Sin contacto")}</span></div>`).join("")}</details>
      <details class="manager-card" open><summary>2. Ingredientes · ${ingredients.length}</summary><form class="form compact" id="managerIngredientForm"><label>Ingrediente</label><input name="name" required><div class="form-pair"><label>Unidad de compra<input name="purchaseUnit" placeholder="libra, caja…"></label><label>Unidad de consumo<input name="consumptionUnit" required placeholder="gramo, unidad…"></label></div><div class="form-pair"><label>Conversión<input name="conversion" type="number" min="0.000001" step="any" value="1" required></label><label>Costo por unidad de consumo<input name="currentCost" type="number" min="0" step="0.0001" value="0"></label></div><div class="form-pair"><label>Existencia actual<input name="currentQty" type="number" min="0" step="any" value="0"></label><label>Mínimo<input name="minimumQty" type="number" min="0" step="any" value="0"></label></div><label>Proveedor principal</label><select name="supplierId"><option value="">Sin asignar</option>${supplierOptions}</select><button class="btn gold" type="submit">Guardar ingrediente</button></form>${ingredients.map((row) => `<div class="manager-list-row"><div><b>${escapeHtml(row.name)}</b><small>${Number(row.currentQty || 0).toFixed(2)} ${escapeHtml(row.consumptionUnit || "")}</small></div><span>${managerMoney(row.currentCost)} c/u</span></div>`).join("")}</details>
      <details class="manager-card"><summary>3. Registrar compra</summary><form class="form compact" id="managerPurchaseForm"><label>Proveedor</label><select name="supplierId" required><option value="">Seleccionar</option>${supplierOptions}</select><label>Factura</label><input name="invoice"><div id="managerPurchaseItems"><div class="purchase-item-row"><label>Ingrediente<select data-purchase-ingredient required><option value="">Seleccionar</option>${ingredientOptions}</select></label><label>Cantidad comprada<input data-purchase-qty type="number" min="0.000001" step="any" required></label><label>Costo por unidad de compra<input data-purchase-cost type="number" min="0" step="0.01" required></label><button type="button" class="btn ghost" data-remove-purchase-row aria-label="Quitar renglón">Quitar</button></div></div><button type="button" class="btn ghost" data-add-purchase-row>+ Agregar otro ingrediente</button><div class="form-pair"><label>Impuesto<input name="tax" type="number" min="0" step="0.01" value="0"></label><label>Transporte<input name="transport" type="number" min="0" step="0.01" value="0"></label></div><label>Descuento</label><input name="discount" type="number" min="0" step="0.01" value="0"><button class="btn gold" type="submit">Confirmar compra completa</button></form></details>
      <details class="manager-card"><summary>4. Crear receta · ${recipes.length}</summary><form class="form compact" id="managerRecipeForm"><label>Producto del menú</label><select name="productId" required><option value="">Seleccionar</option>${productOptions}</select><label>Nombre de receta</label><input name="name" required><label>Porciones producidas</label><input name="yieldQty" type="number" min="0.0001" step="any" value="1" required><div class="recipe-ingredients"><b>Ingredientes por preparación</b>${ingredients.map((row) => `<label><span>${escapeHtml(row.name)} <small>(${escapeHtml(row.consumptionUnit || "unidad")})</small></span><input data-recipe-qty="${escapeHtml(row.id)}" type="number" min="0" step="any" value="0"></label>`).join("") || `<p class="hint">Primero registra ingredientes.</p>`}</div><div class="form-pair"><label>Empaque por porción<input name="packagingCost" type="number" min="0" step="0.01" value="0"></label><label>Otros costos por preparación<input name="otherCost" type="number" min="0" step="0.01" value="0"></label></div><button class="btn gold" type="submit">Guardar receta</button></form></details>
      <details class="manager-card"><summary>5. Conteo y desperdicio</summary><form class="form compact" id="managerMovementForm"><label>Ingrediente</label><select name="ingredientId" required><option value="">Seleccionar</option>${ingredientOptions}</select><label>Operación</label><select name="action"><option value="inventory_count">Conteo físico</option><option value="waste_save">Desperdicio o daño</option><option value="return_save">Devolución al proveedor</option><option value="adjustment_save">Ajuste positivo autorizado</option></select><label>Cantidad</label><input name="qty" type="number" min="0" step="any" required><label>Motivo</label><textarea name="reason" maxlength="400" required></textarea><button class="btn gold" type="submit">Registrar movimiento</button></form></details>
    </div>
    <section class="manager-card"><h3>Rentabilidad por producto</h3><div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Producto</th><th>Unidades</th><th>Ingreso</th><th>Costo</th><th>Utilidad</th><th>Margen</th><th>Calidad</th></tr></thead><tbody>${(cost.products || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${Number(row.qty || 0)}</td><td>${managerMoney(row.revenue)}</td><td>${managerMoney(row.cost)}</td><td>${managerMoney(row.profit)}</td><td>${Number(row.marginPct || 0).toFixed(1)}%</td><td>${managerQuality(row.dataQuality)}</td></tr>`).join("") || `<tr><td colspan="7">Todavía no hay ventas facturadas para este día.</td></tr>`}</tbody></table></div></section>
  </section>`;
}

function backupPanel() {
  if (!canAdmin()) return '';
  const status = STATE.backupStatus, busy = STATE.backupBusy;
  const last = status?.lastSuccess;
  return `<section class="manager-card" aria-labelledby="backup-title" aria-busy="${busy ? 'true' : 'false'}">
    <h3 id="backup-title">Respaldo privado</h3>
    <div role="status" aria-live="polite"><p>${last?.verified ? `Última copia verificada: ${escapeHtml(fmtHn(last.createdAt))}` : status ? 'Sin copia verificada.' : 'Consulta el estado para comprobar la última copia.'}</p>
    ${status?.stale ? '<p class="hint">Atención: no hay copia verificada en las últimas 26 horas.</p>' : ''}
    ${STATE.backupError || status?.lastError ? `<p role="alert">${escapeHtml(STATE.backupError || status.lastError)}</p>` : ''}
    ${status?.running ? '<p>El último intento sigue pendiente de confirmación. Actualiza el estado; no cierres suponiendo que terminó.</p>' : ''}
    ${busy ? '<p>Comprobando respaldo…</p>' : ''}</div>
    <p class="hint">${status?.dailyEnabled ? 'Diario a las 3:00 a. m. de Honduras. Se conservan las últimas 30 copias verificadas.' : 'Programación diaria todavía no activada.'}</p>
    <div class="toolbar"><button class="btn ghost" data-backup-status ${busy ? 'disabled' : ''}>Consultar estado</button>
    <button class="btn" data-backup-create ${busy || !status?.configured ? 'disabled' : ''}>Crear respaldo</button></div>
    <p class="hint">Protege datos enviados al servidor. No guarda consumos pendientes sin internet ni sustituye el respaldo de fotos/documentos. Restaurar requiere revisión; aquí no se sobrescriben cuentas.</p>
  </section>`;
}

async function updateBackupPanel(create = false) {
  if (!canAdmin() || STATE.backupBusy) return;
  STATE.backupBusy = true; STATE.backupError = ''; render();
  try {
    if (create) await managerApi('/api/backups', { method: 'POST' });
    STATE.backupStatus = await managerApi('/api/backups');
  } catch (error) {
    STATE.backupError = error.message + ' Consulta el estado antes de reintentar.';
  } finally {
    STATE.backupBusy = false;
    if (STATE.view === 'admin-system') render();
  }
}

function viewAdminSystem() {
  if (!canAdmin()) return viewLogin();
  const data = STATE.managerData;
  if (!data) return managerHeader("Estado del sistema", "system") + backupPanel() + managerLoadingHtml();
  const health = data.health || {}, incidents = data.incidents || [], auditRows = data.audit || [];
  return `<section class="manager-page">
    ${managerHeader("Estado del sistema", "system")}
    ${backupPanel()}
    <div class="system-hero ${health.status || "yellow"}"><span class="system-dot ${health.status || "yellow"}"></span><div><b>${health.status === "green" ? "Operación estable" : health.status === "red" ? "Atención inmediata" : "Sistema con observaciones"}</b><small>Última revisión ${health.checkedAt ? fmtTime(health.checkedAt) : "pendiente"}</small></div><button class="btn ghost" data-manager-reload>Ejecutar revisión</button></div>
    <div class="system-grid">${(health.checks || []).map((row) => `<article class="manager-alert severity-${row.severity}"><small>${managerSeverity(row.severity)} · ${escapeHtml(row.area)}</small><b>${escapeHtml(row.title)}</b><p>${escapeHtml(row.detail)}</p><em>${escapeHtml(row.suggestedAction)}</em></article>`).join("")}</div>
    <div class="manager-columns">
      <section class="manager-card"><div class="section-h"><h3>Incidentes técnicos</h3><span>${incidents.length}</span></div>${incidents.map((row) => `<article class="incident-row"><div><b>${escapeHtml(row.message || row.type)}</b><small>${escapeHtml(row.area || "Aplicación")} · ${escapeHtml(row.role || "")} · ${fmtTime(row.createdAt)}</small><span>${escapeHtml(row.route || "")}</span></div><div><span class="decision ${escapeHtml(row.status)}">${escapeHtml(row.status || "open")}</span>${!["resolved", "dismissed"].includes(row.status) ? `<button class="btn ghost" data-incident-action="${escapeHtml(row.id)}:resolved">Marcar resuelto</button>` : ""}</div></article>`).join("") || `<div class="okbox">No hay incidentes registrados.</div>`}</section>
      <section class="manager-card"><h3>Auditoría administrativa</h3>${auditRows.map((row) => `<div class="manager-list-row"><div><b>${escapeHtml(row.action)}</b><small>${escapeHtml(row.actor)} · ${fmtTime(row.createdAt)}</small></div><span>${escapeHtml(row.target)}</span></div>`).join("") || `<p class="hint">Las nuevas operaciones se registrarán aquí.</p>`}</section>
    </div>
    <div class="manager-activation"><b>Alcance de seguridad</b><p>Este módulo vigila la aplicación, sincronización, permisos y servicios. No reemplaza un antivirus instalado en Android o en una computadora.</p></div>
  </section>`;
}

async function loadDeliveryAdmin() {
  let next;
  try {
    next = await deliveryApi("/api/delivery/admin");
  } catch (error) { next = { error: error.message, drivers: [], deliveries: [], settings: {} }; }
  const changed = JSON.stringify(STATE.deliveryAdmin) !== JSON.stringify(next);
  STATE.deliveryAdmin = next;
  if (STATE.view === "admin-delivery" && changed) render();
}

function captureDeliverySettingsDraft(form) {
  if (!form) return;
  STATE.deliverySettingsDraft = {
    restaurantAddress: form.restaurantAddress?.value || "",
    restaurantLat: form.lat?.value || "",
    restaurantLng: form.lng?.value || "",
    driverPayBase: form.driverPayBase?.value || "",
    driverPayPerKm: form.driverPayPerKm?.value || "",
    driverPayFallback: form.driverPayFallback?.value || "",
    deliveryCustomerFee1: form.deliveryCustomerFee1?.value || "",
    deliveryCustomerFee3: form.deliveryCustomerFee3?.value || "",
    deliveryCustomerFee65: form.deliveryCustomerFee65?.value || "",
    deliveryCustomerFee8: form.deliveryCustomerFee8?.value || "",
    deliveryCustomerMaxKm: form.deliveryCustomerMaxKm?.value || "",
    deliveryNationwideTestEnabled: form.deliveryNationwideTestEnabled?.checked !== false,
    deliveryFixedZoneEnabled: form.deliveryFixedZoneEnabled?.checked !== false,
    deliveryFixedZoneName: form.deliveryFixedZoneName?.value || "Zona por configurar",
    deliveryFixedZoneFee: form.deliveryFixedZoneFee?.value || "35",
    blockedDeliveryZones: form.blockedDeliveryZones?.value || ""
  };
}

function viewAdminDelivery() {
  if (!canAdmin()) return viewLogin();
  const data = STATE.deliveryAdmin;
  if (!data) return `<div class="section-h"><h2>🏍️ Delivery</h2><button class="btn ghost" data-go="admin">Volver</button></div><div class="okbox">Cargando repartidores y rutas…</div>`;
  if (data.error) return `<div class="section-h"><h2>🏍️ Delivery</h2><button class="btn ghost" data-go="admin">Volver</button></div><div class="errorbox">${escapeHtml(data.error)}</div><button class="btn" id="reloadDeliveryAdmin">Reintentar</button>`;
  const s = STATE.deliverySettingsDraft || data.settings || {}, drivers = data.drivers || [], deliveries = data.deliveries || [];
  const active = deliveries.filter(d => !["delivered", "cancelled"].includes(d.status));
  const completed = deliveries.filter(d => d.status === "delivered").sort((a,b)=>String(b.deliveredAt||"").localeCompare(String(a.deliveredAt||"")));
  const orderFor = (d) => (Store.get().orders||[]).find(x=>x.id===d.orderId)||{};
  const deliveryStatusLabel = {
    available:"Buscando repartidor",
    accepted:"Repartidor asignado",
    heading_pickup:"Repartidor va al restaurante",
    picked_up:"Entregada al repartidor · va al cliente",
    delivered:"Entregada al cliente",
    cancelled:"Cancelada"
  };
  const driverStats = drivers.map((driver) => {
    const jobs=completed.filter(d=>d.driverId===driver.id),ratings=jobs.map(d=>d.rating).filter(Boolean);
    return {driver,jobs:jobs.length,pay:jobs.reduce((n,d)=>n+Number(d.driverPay||0),0),tips:jobs.reduce((n,d)=>n+Number(orderFor(d).tip||0),0),ratings};
  }).filter(x=>x.jobs || x.driver.status === "approved");
  const statusLabel = { pending:"Pendiente", approved:"Aprobado", rejected:"Rechazado", suspended:"Suspendido" };
  return `<div class="section-h"><h2>🏍️ Delivery</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <details class="fold" open><summary>Configuración de rutas y pagos</summary>
      <form class="form" id="deliverySettingsForm">
        <div class="okbox">Coloca las coordenadas exactas del restaurante. Google Maps usará este punto para calcular distancia, tiempo y pago sugerido. <b>No uses solamente −87</b>: la longitud debe tener todos sus decimales.</div>
        <label>Dirección del restaurante</label><input name="restaurantAddress" required value="${escapeHtml(s.restaurantAddress || "")}">
        <div class="split split-2"><div><label>Latitud</label><input name="lat" type="number" step="any" required value="${s.restaurantLat ?? ""}"></div><div><label>Longitud</label><input name="lng" type="number" step="any" required value="${s.restaurantLng ?? ""}"></div></div>
        <button class="btn ghost" type="button" id="captureRestaurantLocation">📍 Medir GPS estando en el local</button><button class="btn ghost" type="button" id="useVerifiedRestaurantLocation">Usar coordenadas de referencia de El Chingadazo</button>
        <div class="okbox"><b>Pago transparente:</b> el repartidor recibe exactamente la tarifa de envío cobrada al cliente. La propina se suma por separado. Ya no se agregan pago base ni pago por kilómetro.</div>
        <input name="driverPayBase" type="hidden" value="0"><input name="driverPayPerKm" type="hidden" value="0"><input name="driverPayFallback" type="hidden" value="${Number(s.driverPayFallback || 0)}">
        <h3>Tarifa que paga el cliente</h3>
        <div class="okbox"><label class="choice-row"><input name="deliveryFixedZoneEnabled" type="checkbox" ${s.deliveryFixedZoneEnabled !== false ? "checked" : ""}><span><b>Envío dentro de Zona por configurar</b> con tarifa fija para cliente y repartidor.</span></label><div class="split split-2"><div><label>Nombre de la zona</label><input name="deliveryFixedZoneName" required value="${escapeHtml(s.deliveryFixedZoneName || "Zona por configurar")}"></div><div><label>Tarifa fija (L.)</label><input name="deliveryFixedZoneFee" type="number" min="0" step="1" required value="${Number(s.deliveryFixedZoneFee ?? 35)}"></div></div></div>
        <div class="split split-2"><div><label>0–1 km (L.)</label><input name="deliveryCustomerFee1" type="number" min="0" step="1" required value="${Number(s.deliveryCustomerFee1 ?? 30)}"></div><div><label>1–3 km (L.)</label><input name="deliveryCustomerFee3" type="number" min="0" step="1" required value="${Number(s.deliveryCustomerFee3 ?? 35)}"></div><div><label>3–6.5 km (L.)</label><input name="deliveryCustomerFee65" type="number" min="0" step="1" required value="${Number(s.deliveryCustomerFee65 ?? 75)}"></div><div><label>6.5–8 km (L.)</label><input name="deliveryCustomerFee8" type="number" min="0" step="1" required value="${Number(s.deliveryCustomerFee8 ?? 110)}"></div></div>
        <label>Radio máximo comercial (km)</label><input name="deliveryCustomerMaxKm" type="number" min="0.1" max="50000" step="0.1" required value="${Number(s.deliveryCustomerMaxKm || 8)}"><small class="hint">Este radio queda guardado para utilizarlo cuando se desactive el modo de pruebas.</small>
        <div class="errorbox"><label class="choice-row"><input name="deliveryNationwideTestEnabled" type="checkbox" ${s.deliveryNationwideTestEnabled !== false ? "checked" : ""}><span><b>Modo de pruebas: permitir pedidos sin límite de kilómetros</b><br>Las rutas mayores de 8 km usarán temporalmente la última tarifa configurada (L. ${Number(s.deliveryCustomerFee8 ?? 110).toFixed(0)}). Desactívalo antes del lanzamiento.</span></label></div>
        <label>Zonas sin delivery (una por línea)</label><textarea name="blockedDeliveryZones" rows="4" placeholder="Agrega únicamente zonas verificadas y revisa esta lista con frecuencia">${escapeHtml(s.blockedDeliveryZones || "")}</textarea>
        <p class="hint">Ejemplo: si el cliente paga L. 35 de envío, el repartidor verá L. 35 de ruta. Si el cliente deja propina, aparecerá adicionalmente.</p>
        <button class="btn gold" type="submit">Guardar configuración de delivery</button>
      </form>
    </details>
    <details class="fold"><summary>Solicitudes y perfiles de repartidores · ${drivers.length}</summary>
      ${drivers.length ? drivers.map(d => `<article class="order"><div class="section-h"><div><b>${escapeHtml(d.name)}</b><div class="hint">${escapeHtml(d.phone)} · ${escapeHtml(d.email)}</div></div><span class="status">${statusLabel[d.status] || d.status}</span></div>
        <div class="hint">DNI: ${escapeHtml(d.dni)}<br>${escapeHtml(d.vehicleType)}${d.vehicleType!=="Bicicleta"?` · placa ${escapeHtml(d.vehiclePlate)}<br>VIN: ${escapeHtml(d.vehicleVin||"Pendiente")}<br>Licencia: ${escapeHtml(d.licenseNumber)} · vence ${escapeHtml(d.licenseExpires)}`:""}<br>${escapeHtml(d.residenceAddress)} · ${escapeHtml(d.residenceReference)}</div>
        ${!d.emailVerified?'<p class="errorbox">Falta confirmar el correo del solicitante.</p>':''}${d.missingRequirements?.length?`<p class="errorbox">Requisitos pendientes: ${d.missingRequirements.map(escapeHtml).join(', ')}.</p>`:''}
        <label class="choice-row okbox"><input type="checkbox" data-driver-photo="${d.id}" ${d.requireDeliveryPhoto ? "checked" : ""}><span><b>Exigir foto de entrega</b><br>Si está activo, no podrá cerrar una orden sin tomarla.</span></label>
        <div class="toolbar" style="flex-wrap:wrap;gap:8px"><button class="btn ghost" data-driver-doc="${d.id}:selfie">Ver rostro</button>${d.vehicleType==='Bicicleta'?`<button class="btn ghost" data-driver-doc="${d.id}:vehicle">Ver bicicleta</button>`:`<button class="btn ghost" data-driver-doc="${d.id}:license">Ver licencia</button><button class="btn ghost" data-driver-doc="${d.id}:vehicle-right">Lateral derecho</button><button class="btn ghost" data-driver-doc="${d.id}:vehicle-left">Lateral izquierdo</button><button class="btn ghost" data-driver-doc="${d.id}:vin">Foto del VIN</button>`}${d.status !== "approved" ? `<button class="btn gold" data-driver-action="approve:${d.id}" ${!d.emailVerified||d.missingRequirements?.length?'disabled':''}>Aprobar</button>` : `<button class="btn danger" data-driver-action="suspend:${d.id}">Suspender</button>`}<button class="btn ghost" data-driver-action="reject:${d.id}">Rechazar</button></div></article>`).join("") : `<p class="hint">Todavía no hay solicitudes.</p>`}
    </details>
    <details class="fold" open><summary>Entregas activas · ${active.length}</summary>
      ${active.length ? active.map(d => { const o=(Store.get().orders||[]).find(x=>x.id===d.orderId)||{}; return `<article class="order"><div class="section-h"><b>${escapeHtml(o.code || d.orderId)}</b><span class="status">${escapeHtml(deliveryStatusLabel[d.status] || d.status)}</span></div><p><b>${escapeHtml(d.driverName || "Buscando repartidor")}</b> · pago ${money(d.driverPay)} · ${Number(d.distanceKm || 0).toFixed(1)} km</p>${d.location ? deliveryTrailMap(d) : `<p class="hint">Todavía no comparte ubicación.</p>`}<p class="hint">Cliente: ${escapeHtml(o.customerName || "")} · ${escapeHtml(o.address || "")}</p>${d.proofObject?`<button class="btn ghost" data-delivery-proof="${d.orderId}">Ver foto de entrega</button>`:""}</article>` }).join("") : `<p class="hint">No hay recorridos activos.</p>`}
    </details>
    <details class="fold"><summary>Estadísticas por repartidor · ${driverStats.length}</summary>
      ${driverStats.length ? driverStats.map(x=>`<article class="order"><div class="section-h"><b>${escapeHtml(x.driver.name)}</b><span>${x.ratings.map(r=>r.emoji).join(" ") || "Sin calificaciones"}</span></div><div class="admin-grid"><div class="kpi"><b>${x.jobs}</b><span>Entregas</span></div><div class="kpi"><b>${money(x.pay)}</b><span>Pago de rutas</span></div><div class="kpi"><b>${money(x.tips)}</b><span>Propinas</span></div><div class="kpi"><b>${money(x.pay+x.tips)}</b><span>Total ganado</span></div></div></article>`).join(""):`<p class="hint">Todavía no hay entregas completadas.</p>`}
    </details>
    <details class="fold"><summary>Historial de delivery · ${completed.length}</summary>
      ${completed.slice(0,100).map(d=>{const o=orderFor(d);return `<article class="order"><div class="section-h"><b>${escapeHtml(o.code||d.orderId)}</b><span>${d.rating?.emoji||"Sin calificar"}</span></div><p>${escapeHtml(d.driverName||"Repartidor")} · ruta ${money(d.driverPay)}${o.tip?` · propina ${money(o.tip)}`:""}</p><p class="hint">${d.deliveredAt?fmtHn(d.deliveredAt):""} · ${escapeHtml(o.customerName||"")}</p>${d.proofObject?`<button class="btn ghost" data-delivery-proof="${d.orderId}">Ver foto de entrega</button>`:""}${d.rating?.note?`<div class="order-note">${escapeHtml(d.rating.note)}</div>`:""}</article>`}).join("")||`<p class="hint">Sin historial todavía.</p>`}
    </details>`;
}

function orderElapsed(o) {
  const done = o.status === "entregado" || o.status === "facturada" || o.status === "cancelado";
  const from = o.receivedAt || o.createdAt || o.statusAt;
  if (!from) return done ? "Completada" : "Sin recibir";
  const to = done ? (o.deliveredAt || o.statusAt || o.createdAt) : Date.now();
  const sec = Math.max(0, Math.floor((new Date(to) - new Date(from)) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (done ? "Tiempo total " : "En curso ") + m + " min " + String(s).padStart(2, "0") + " s";
}

function orderCard(o) {
  const done = ["entregado", "facturada", "cancelado"].includes(o.status);
  const steps = done ? [] : o.type === "delivery"
    ? [["preparacion","En cocina"],["listo","Lista para recoger"],["camino","🏍️ Confirmar entrega al repartidor"],["cancelado","Cancelar"]]
    : (o.invoiced && o.paidAt
      ? [["entregado","✅ Entregado al cliente"],["cancelado","Cancelar"]]
      : [["preparacion","En cocina"],["listo","Listo"],["camino","En camino"],["entregado","Entregado"],["cancelado","Cancelar"]]);
  return `<article class="order ${o.status === "nuevo" ? "is-new" : ""}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <div><b>${o.code || o.id}</b> · ${o.createdAt ? fmtHn(o.createdAt) : ""}</div>
      <span class="status s-${o.status || "nuevo"}">${STATUS_LABEL[o.status] || o.status || "nuevo"}</span>
    </div>
    <div class="timer-chip" data-oid="${o.id}">${orderElapsed(o)}</div>
    <div>${o.customerName || "Cliente"} · ${o.phone || ""}</div>
    <div class="hint">${o.type === "delivery" ? (o.address || "Domicilio") : (o.type === "pickup" || o.channel === "mostrador" ? "Para llevar" : o.type || "")} · ${o.payment || ""} ${o.scheduledFor ? "· para " + fmtHn(o.scheduledFor) : ""}</div>
    <ul style="margin:8px 0 8px 18px">${(o.items || []).map((i) => `<li>${i.qty || 1}× ${i.name || ""}${i.modsText ? " — " + i.modsText : ""}${i.note ? `<div class="order-note">📝 ${i.note}</div>` : ""}</li>`).join("") || "<li>Sin detalle</li>"}</ul>
    ${o.notes ? `<div class="order-note">📝 Nota general: ${o.notes}</div>` : ""}
    <b>Total ${money(o.total)}</b>
    <div class="hint">${o.invoiced ? "✅ Facturada" : needsCashier(o) ? "💵 Pendiente de facturar" : ""}</div>
    <div class="hint">Pts al entregar: +${o.pointsEarned || pointsEarned(o.total)} ${o.pointsGranted ? "· acreditados" : ""}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
      ${(o.status === "nuevo") ? `<button class="btn gold" data-accept="${o.id}">Recibir pedido</button>` : ""}
      ${canCash() && needsCashier(o) ? `<button class="btn gold" data-collect="${o.id}">Confirmar pago y facturar</button>` : ""}
      ${steps.map(([s,l]) => s === "entregado" && o.invoiced && o.paidAt
        ? `<button class="btn gold" data-status="${o.id}:${s}">${l}</button>`
        : s === "entregado" && (!o.invoiced || !o.paidAt)
        ? `<button class="btn ghost" data-status="${o.id}:${s}" title="Debe facturarse primero">🔒 Entregar (falta facturar)</button>`
        : `<button class="btn ghost" data-status="${o.id}:${s}">${l}</button>`).join("")}
      <button class="btn gold" data-wa="${o.id}">WhatsApp</button>
      <button class="btn ghost" data-print-k="${o.id}">Ticket cocina</button>
      <button class="btn ghost" data-print-c="${o.id}">Ticket cliente</button>
    </div>
  </article>`;
}

function orderServiceDay(o) {
  return hnYmd(o && (o.scheduledFor || o.createdAt || o.statusAt || new Date().toISOString()));
}

function orderCalendarHtml(list, selected) {
  const nowP = hnParts();
  const y = STATE.orderCalY || nowP.y;
  const m = STATE.orderCalM != null ? STATE.orderCalM : (nowP.m - 1);
  const monthName = new Date(y, m, 1).toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  const counts = {};
  list.forEach((o) => {
    const day = orderServiceDay(o);
    if (day.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)) counts[day] = (counts[day] || 0) + 1;
  });
  return `<div class="card-block cal-wrap order-calendar">
    <div class="section-h" style="margin:0">
      <button class="btn ghost" data-order-cal-nav="-1" aria-label="Mes anterior">‹</button>
      <h3 style="text-transform:capitalize;margin:0">${monthName}</h3>
      <button class="btn ghost" data-order-cal-nav="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="cal-week">${["L","M","M","J","V","S","D"].map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="cal-grid">${monthGrid(y, m).map((d) => {
      if (!d) return `<span class="cal-empty"></span>`;
      const day = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return `<button type="button" class="cal-day ${day === selected ? "on" : ""} ${counts[day] ? "has" : ""}" data-order-cal-day="${day}">
        <b>${d}</b>${counts[day] ? `<small>${counts[day]} orden${counts[day] === 1 ? "" : "es"}</small>` : ""}
      </button>`;
    }).join("")}</div>
  </div>`;
}

function viewAdminOrders(embed = false) {
  const all = (Store.get().orders || []).filter((o) => o && o.id)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const admin = canAdmin();
  const selected = admin ? (STATE.orderCalDay || hnYmd()) : hnYmd();
  const list = all.filter((o) => orderServiceDay(o) === selected);
  const neu = list.filter((o) => (o.status || "nuevo") === "nuevo");
  const sched = list.filter((o) => o.status === "programado");
  const proc = list.filter((o) => ["preparacion","listo","camino"].includes(o.status));
  const done = list.filter((o) => ["entregado","facturada","cancelado"].includes(o.status));
  const f = STATE.fold || { prog: true, neu: true, proc: true, done: false };
  const block = (key, title, arr, empty) => `<details class="fold" data-fold="${key}" ${f[key] ? "open" : ""}>
    <summary>${title} · ${arr.length}</summary>
    ${arr.length ? arr.map(orderCard).join("") : `<p class="hint">${empty}</p>`}
  </details>`;
  return `${embed ? `<div class="section-h"><h2>Órdenes de hoy</h2>${admin ? `<button class="btn ghost" data-go="admin-orders">Ver calendario</button>` : ""}</div>` : `<div class="section-h"><h2>Órdenes</h2><button class="btn ghost" data-go="admin">Volver</button></div>`}
    ${!embed && admin ? orderCalendarHtml(all, selected) + `<h3 class="orders-day-title">Órdenes del ${selected}</h3>` : ""}
    ${block("prog", "Programados para abrir", sched, "No hay pedidos para la hora de apertura.")}
    ${block("neu", `<span class="${neu.length ? "blink-new" : ""}">Nuevos</span>`, neu, "No hay pedidos nuevos.")}
    ${block("proc", "En proceso", proc, "Nada en cocina / camino.")}
    ${block("done", "Completados", done, "Aún no hay historial.")}`;
}

function viewRewards() {
  const user = currentUser();
  if (!user) return viewLogin();
  const db = Store.get();
  const mine = (db.orders || []).filter((o) => samePerson(user, o) && o.status !== "cancelado");
  const pts = livePoints(user);
  const need = ptsForTorta();
  const pct = Math.min(100, Math.round((pts / need) * 100));
  const lack = Math.max(0, need - pts);
  const spendMore = Math.ceil(lack / 10) * 100;
  const promo = (db.settings.promos || []).filter((p) => p.active).slice(-1)[0];
  const bonus = user.welcomeBonus || 0;
  const history = mine.slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return `<div class="club trapipoints">
    ${db.settings.doublePoints ? `<div class="flash">⚡ DOBLE DE PUNTOS activo · cada L. 100 = 20 pts</div>` : ""}
    ${bonus ? `<div class="okbox">Regalo de bienvenida: +${bonus} pts</div>` : ""}
    <div class="club-hero">
      <div class="trapipoints-mark"><span>★</span> TRAPIPUNTOS</div>
      <p class="kicker">Tu sabor también te premia</p>
      <h1>${user.name.split(" ")[0]}, tienes</h1>
      <div class="ring-wrap">
        <div class="ring" style="--points-progress:${pct}%">
          <div class="ring-in">
            <b id="ptsCount" data-pts="${pts}">0</b>
            <span>pts</span>
          </div>
        </div>
      </div>
      <p class="club-val">Valen ${money(pointsToLempiras(pts))} · canjeables por torta</p>
      <div class="club-bar"><i style="width:${pct}%"></i></div>
      <p>${pts >= need ? "¡Ya puedes canjear una torta mexicana!" : "Te faltan <b>" + lack + " pts</b> para una torta."}</p>
    </div>
    ${promo ? `<div class="flash">${promo.title}<div class="hint">${promo.body}</div></div>` : ""}
    <div class="card-block points-how">
      <div class="points-how-icon">＋</div><div><h3>Así sumas</h3>
      <p>Cada L. 100 = <b>${10 * pointsMultiplier()} Puntos Chingadazo</b>. Puedes canjearlos por una <b>torta mexicana</b> desde ${need} puntos.${db.settings.doublePoints ? " Promo doble activa." : ""}</p></div>
    </div>
    <details class="fold points-history">
      <summary><span><b>Historial de Puntos Chingadazo</b><small>${history.length} ${history.length===1?"movimiento":"movimientos"}</small></span></summary>
      <div class="points-history-body">${history.map((o) => `<div class="club-row"><span>${o.code}<small>${fmtHn(o.createdAt)} · ${o.pointsGranted ? "+"+(o.pointsEarned || 0)+" acreditados" : "+"+(o.pointsEarned || 0)+" al completar"}${o.redeemPts ? " · canje −" + o.redeemPts : ""}</small></span><b>${money(o.total)}</b></div>`).join("") || "<p class='hint'>Tu primera orden ya empieza a sumar.</p>"}</div>
    </details>
    <button class="btn gold full" data-go="menu">Pedir ahora y seguir sumando</button>
  </div>`;
}

function viewAdminPromos() {
  if (!canAdmin()) return viewLogin();
  const s = Store.get().settings;
  const promos = s.promos || [];
  const blasts = s.blasts || [];
  const ed = STATE.editPromo || {};
  return `
    <div class="section-h"><h2>Promos y avisos</h2><button class="btn ghost" data-go="admin">Volver</button></div><button class="btn gold" data-go="stories">Revisar historias de Instagram · 300 puntos</button>
    <details class="fold admin-section-fold" data-fold="adminPromos" ${(ed.id || STATE.fold?.adminPromos) ? "open" : ""}>
      <summary><span>🎁 Promociones</span><small>${promos.length}</small></summary>
      <form class="form card-block" id="promoForm">
        <h3>${ed.id ? "Editar promoción" : "Crear promoción"}</h3>
        <input type="hidden" name="promoId" value="${ed.id || ""}">
        <label>Título</label><input name="title" required value="${(ed.title || "").replace(/"/g, "&quot;")}" placeholder="2x1 en alitas 5–6 pm">
        <label>Detalle</label><textarea name="body" rows="3" required placeholder="Solo app. Estudiantes con carnet 15% de 3 a 5 pm.">${escapeHtml(ed.body || "")}</textarea>
        <label>Horario (opcional)</label><input name="hours" value="${(ed.hours || "").replace(/"/g, "&quot;")}" placeholder="15:00-17:00 estudiantes">
        <button class="btn gold" type="submit">${ed.id ? "Guardar cambios" : "Publicar promoción"}</button>
        ${ed.id ? `<button class="btn ghost" type="button" id="promoCancelEdit">Cancelar edición</button>` : ""}
      </form>
      <details class="fold" data-fold="promoHistory" ${STATE.fold?.promoHistory ? "open" : ""}>
        <summary>Promociones publicadas · ${promos.length}</summary>
        ${promos.slice().reverse().map((p) => `<details class="fold promo-entry">
          <summary><span class="promo-entry-title">${escapeHtml(p.title)}</span>${p.active ? "<span class='status s-listo'>activa</span>" : "<span class='status s-nuevo'>apagada</span>"}</summary>
          <p>${escapeHtml(p.body)}</p>
          <p class="hint">${escapeHtml(p.hours || "Sin horario")} · ${fmtTime(p.at)}</p>
          <div class="promo-actions">
            <button class="btn ghost" data-promo-edit="${p.id}">Editar</button>
            <button class="btn ghost" data-promo-off="${p.id}">${p.active ? "Apagar" : "Encender"}</button>
            <button class="btn danger" data-promo-del="${p.id}">Eliminar</button>
          </div>
        </details>`).join("") || "<p class='hint'>No hay promociones aún.</p>"}
      </details>
    </details>
    <details class="fold"><summary>⭐ Bono real de registro · ${Number(s.welcomeBonus ?? 500)} puntos</summary>
      <form class="form" id="welcomeBonusForm">
        <p class="hint">Aplica a registros nuevos. No cambia puntos ya otorgados ni el texto de los anuncios.</p>
        <label for="bonusPoints">Puntos de bienvenida (0 desactiva el bono)</label>
        <input id="bonusPoints" name="bonus" type="number" min="0" max="100000" step="1" required value="${Number(s.welcomeBonus ?? 500)}">
        <button class="btn gold" type="submit">Guardar bono</button>
      </form>
    </details>
    <details class="fold admin-section-fold" data-fold="adminPush" ${STATE.fold?.adminPush ? "open" : ""}>
      <summary><span>🔔 Notificaciones push</span><small>${blasts.length}</small></summary>
      <form class="form card-block" id="blastForm">
        <h3>Enviar una notificación</h3>
        <label>Título</label><input name="title" required placeholder="¡Promo de la tarde!">
        <label>Mensaje</label><textarea name="body" rows="3" required></textarea>
        <button class="btn" type="submit">Enviar aviso ahora</button>
      </form>
      <p class="hint">El aviso suena y aparece en los teléfonos que tengan el-chingadazo.invalid abierto y hayan activado las notificaciones.</p>
      <details class="fold" data-fold="pushHistory" ${STATE.fold?.pushHistory ? "open" : ""}>
        <summary>Historial de notificaciones · ${blasts.length}</summary>
        ${blasts.slice().sort((a,b) => String(b.at).localeCompare(String(a.at))).map((b) => `<details class="fold promo-entry"><summary><span class="promo-entry-title">${escapeHtml(b.title)}</span><small>${fmtTime(b.at)}</small></summary><p>${escapeHtml(b.body)}</p></details>`).join("") || "<p class='hint'>Sin notificaciones.</p>"}
      </details>
    </details>`;
}

function viewAdminProducts() {
  const db = Store.get();
  const ed = STATE.editProduct || {};
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `
    <div class="section-h"><h2>Carta</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <details class="fold admin-menu-fold" data-fold="adminCategories" ${STATE.fold?.adminCategories ? "open" : ""}>
      <summary><span>📂 Categorías / agregar categoría</span><small>${(db.categories || []).length}</small></summary>
      <form class="form" id="catForm">
        <p class="hint">Se ven en el menú del cliente y en caja. Se sincronizan en todos los aparatos.</p>
        ${(db.categories || []).map((c) => `<div class="hint">${c.icon || ""} ${c.name} · ${c.id}</div>`).join("")}
        <div class="split split-2">
          <div><label>Nombre</label><input name="name" required placeholder="Ej. Postres"></div>
          <div><label>Icono</label><input name="icon" placeholder="🥤"></div>
        </div>
        <button class="btn gold" type="submit">Agregar categoría</button>
      </form>
    </details>
    <details class="fold admin-menu-fold" data-fold="adminProduct" ${(ed.id || STATE.fold?.adminProduct) ? "open" : ""}>
      <summary><span>${ed.id ? "✏️ Editar producto" : "➕ Agregar producto"}</span><small>${ed.id ? escapeHtml(ed.name) : ""}</small></summary>
    <form class="form" id="productForm" style="padding:4px 0 8px;color:#fff8e7">
      <h3>${ed.id ? "Editando: " + escapeHtml(ed.name) : "Nuevo producto"}</h3>
      <button class="btn gold full" type="button" id="saveProduct">Guardar producto</button>
      <button class="btn ghost full" type="button" id="publishPhotos">Publicar fotos a todos los dispositivos</button>
      <input type="hidden" name="prodId" value="${escapeHtml(ed.id)}">
      <label>Nombre</label><input name="name" value="${escapeHtml(ed.name)}">
      <label>Descripción</label><textarea name="description" rows="2">${escapeHtml(ed.description)}</textarea>
      <div class="split split-2">
        <div><label>Precio L.</label><input name="price" type="number" step="1" min="0" required value="${ed.price != null ? ed.price : ""}"></div>
        <div><label>Categoría</label>
          <select name="category">${db.categories.filter(c=>c.id!=="destacados").map(c=>`<option value="${c.id}" ${ed.category===c.id?"selected":""}>${c.name}</option>`).join("")}</select>
        </div>
      </div>
      <label>Foto del producto</label>
      <button class="btn gold" type="button" id="pickPhoto">Elegir foto de la galería</button>
      <input type="file" id="imgFile" accept="image/jpeg,image/png,image/webp,image/*">
      <p class="hint">JPG o PNG. Se aplica al elegirla. Luego toca Guardar producto (arriba).</p>
      <div id="prodPrev">${ed.image ? `<img src="${productImageUrl(ed)}" style="width:140px;height:140px;object-fit:cover;border-radius:12px">` : ""}</div>
      ${ed.id ? `<button class="btn ghost" type="button" id="newProduct">Nuevo producto</button>` : ""}
      <label>Modificadores (JSON opcional)</label>
      <textarea name="modifiers" rows="4" placeholder='[{"id":"acomp","name":"Acompañamiento","required":true,"multi":false,"options":[{"id":"arroz","name":"Arroz","price":0}]}]'>${ed.modifiers ? escapeHtml(JSON.stringify(ed.modifiers, null, 2)) : ""}</textarea>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="featured" ${ed.featured ? "checked" : ""}> Destacado</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="available" ${ed.id ? (ed.available ? "checked" : "") : "checked"}> Disponible</label>
      <button class="btn gold full" type="button" id="saveProduct2">Guardar producto</button>
    </form>
    </details>
    <div class="section-h"><h3>Productos actuales</h3><span>${db.products.length}</span></div>
    <div style="overflow:auto">
      <table class="table">
        <tr><th>Foto</th><th>Plato</th><th>Precio</th><th></th></tr>
        ${db.products.map((p) => `<tr>
          <td><div class="thumb" style="background-image:url('${productImageUrl(p)}');width:56px;height:56px;border-radius:10px;background-size:cover"></div></td>
          <td><b>${p.name}</b><div class="hint">${p.category} · ${p.available ? "activo" : "oculto"}</div></td>
          <td>${money(p.price)}</td>
          <td>
            <button class="btn ghost" data-edit="${p.id}">Editar</button>
            <button class="btn ghost" data-tog="${p.id}">${p.available ? "Agotar" : "Activar"}</button>
            <button class="btn danger" data-del="${p.id}">Borrar</button>
          </td>
        </tr>`).join("")}
      </table>
    </div>`;
}

function viewAdminSettings() {
  const s = Store.get().settings;
  return `
    <div class="section-h"><h2>Ajustes</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <form class="form" id="settingsForm" style="background:#1c1c1c;border:1px solid #3a3a3a;border-radius:18px;padding:16px;color:#fff8e7">
      <label>Nombre del restaurante</label><input name="name" value="${s.name}">
      <label>Teléfono</label><input name="phone" value="${s.phone}">
      <label>WhatsApp (código país + número, sin +)</label><input name="whatsapp" value="${s.whatsapp}">
      <label>Dirección del local</label><input name="address" value="${s.address}">
      <label>Correo que recibe cierres de turno</label><input name="shiftReportEmail" type="email" value="${escapeHtml(s.shiftReportEmail||"")}">
      <label>Horario (texto)</label><input name="hours" value="${s.hours}">
      <fieldset><legend>Horarios por día · Honduras</legend>
      ${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day,i)=>{const h=s.weeklyHours?.[i]||{closed:false,open:'13:00',close:'22:00'};return `<div class="schedule-day"><b>${day}</b><label><input type="checkbox" name="dayClosed${i}" ${h.closed?'checked':''}> Cerrado</label><label>Apertura<input type="time" name="dayOpen${i}" value="${escapeHtml(h.open)}" required></label><label>Cierre<input type="time" name="dayClose${i}" value="${escapeHtml(h.close)}" required></label></div>`;}).join('')}
      <p class="hint">00:00 significa medianoche. Para eventos puedes poner 01:30: el cierre será la madrugada del día siguiente. Restablece el horario al terminar el evento.</p></fieldset>
      <label>Logo</label>
      <input type="file" id="logoFile" accept="image/*">
      <input type="hidden" name="logoImage" value="${s.logoImage || "assets/logo.jpg"}">
      <label>Tamaño del logo (px)</label>
      <input name="logoSize" id="logoSize" type="range" min="32" max="96" value="${s.logoSize || 48}">
      <div class="hint">Ahora: ${s.logoSize || 48}px</div>
      <img src="${s.logoImage || "assets/logo.jpg"}" alt="logo" style="width:${s.logoSize || 48}px;height:${s.logoSize || 48}px;object-fit:cover;border-radius:12px">
      <div class="split split-2">
        <div><label>ITBMS (0.07 = 7%)</label><input name="taxRate" type="number" step="0.01" value="${s.taxRate}"></div>
        <div><label>Costo de envío</label><input name="deliveryFee" type="number" step="0.25" value="${s.deliveryFee}"></div>
      </div>
      <label>Pedido mínimo</label><input name="minOrder" type="number" step="0.25" value="${s.minOrder}">
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="open" ${s.open ? "checked" : ""}> Local abierto para pedidos</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="soundOn" ${s.soundOn ? "checked" : ""}> Sonido al llegar un pedido</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="autoWhatsApp" ${s.autoWhatsApp ? "checked" : ""}> Abrir WhatsApp automáticamente</label>
      <div class="card-block"><h3>Experiencias inteligentes</h3>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="chingadazoAiEnabled" ${s.chingadazoAiEnabled !== false ? "checked" : ""}> Recomendador Chingadazo</label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="foodProfileEnabled" ${s.foodProfileEnabled !== false ? "checked" : ""}> Perfil Comelón y desbloqueables</label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="familyOrderEnabled" ${s.familyOrderEnabled !== false ? "checked" : ""}> Pedido familiar con código temporal</label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="spicyCopyEnabled" ${s.spicyCopyEnabled !== false ? "checked" : ""}> Frases graciosas con doble sentido</label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="deliveryCodeRequired" ${s.deliveryCodeRequired !== false ? "checked" : ""}> Código de 4 dígitos para cerrar delivery</label>
        <p class="hint">Los datos personales, DNI y ubicación nunca se usan para crear perfiles de sabor.</p>
      </div>
      <button class="btn" type="submit">Guardar ajustes</button>
      <button class="btn danger" type="button" id="resetDemo">Archivar ventas de prueba y comenzar en cero</button>
    </form>`;
}

function renderModal() {
  const p = STATE.product;
  const host = $("#modal");
  if (!p) { host.innerHTML = ""; host.classList.add("hidden"); return; }
  host.classList.remove("hidden");
  const unit = itemUnit(p, STATE.mods);
  host.innerHTML = `<div class="modal-bg" id="modalBg"><div class="sheet">
    <div class="handle"></div>
    <button class="btn ghost" id="closeProduct" type="button" style="margin-bottom:8px">← Volver</button>
    <div class="hero-img" style="background-image:url('${productImageUrl(p)}')"></div>
    <h2>${p.name}</h2>
    <p class="hint">${p.description}</p>
    ${(p.modifiers || []).map((g) => `
      <div class="mod">
        <h4>${g.name} ${g.required ? "· obligatorio" : "· opcional"}</h4>
        ${g.options.map((o) => {
          const sel = STATE.mods[g.id];
          const on = g.multi ? (sel || []).includes(o.id) : sel === o.id;
          return `<label class="opt">
            <span><input type="${g.multi ? "checkbox" : "radio"}" name="${g.id}" value="${o.id}" ${on ? "checked" : ""}> ${o.name}</span>
            <span>${o.price ? "+" + money(o.price) : "Incluido"}</span>
          </label>`;
        }).join("")}
      </div>`).join("")}
    <label>Nota para cocina</label>
    <textarea id="itemNote" rows="2" placeholder="Poco picante, sin cebolla...">${STATE.note}</textarea>
    <div class="row" style="display:flex;justify-content:space-between;align-items:center;margin:16px 0">
      <div class="qty">
        <button id="qtyMinus">−</button><b id="qtyVal">${STATE.qty}</b><button id="qtyPlus">+</button>
      </div>
      <b>${money(unit * STATE.qty)}</b>
    </div>
    <button class="btn full" id="addCart">${STATE.posMode ? "Agregar a la cuenta" : STATE.familyMode ? "Agregar a mi pedido familiar" : "Agregar al pedido"}</button>
    <button class="btn ghost full" id="closeProduct2" type="button">Cancelar</button>
  </div></div>`;
}

function closeModal() {
  STATE.product = null;
  STATE.posMode = false;
  if (!STATE.crop) {
    const host = $("#modal");
    if (host) { host.classList.add("hidden"); host.innerHTML = ""; }
  }
}

function posTick() {
  try {
    const ctx = posTick.ctx || (posTick.ctx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1400;
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.055);
  } catch {}
}

async function saveProductFromForm() {
  const f = $("#productForm");
  const ed = STATE.editProduct || {};
  const name = String((f && f.elements && f.elements.name && f.elements.name.value) || ed.name || "").trim();
  if (!name) { alert("Escribe el nombre del producto."); return false; }
  let modifiers = ed.modifiers || [];
  const raw = String((f && f.elements && f.elements.modifiers && f.elements.modifiers.value) || "").trim();
  if (raw) {
    try { modifiers = JSON.parse(raw); } catch {}
  }
  const prod = {
    ...ed,
    id: ed.id || Store.uid("p"),
    name,
    description: String((f && f.elements && f.elements.description && f.elements.description.value) || ed.description || "").trim(),
    price: Number((f && f.elements && f.elements.price && f.elements.price.value) || ed.price || 0),
    category: (f && f.elements && f.elements.category && f.elements.category.value) || ed.category || "mexicana",
    image: ed.image || "assets/logo.jpg",
    featured: !!(f && f.elements && f.elements.featured && f.elements.featured.checked),
    available: !(f && f.elements && f.elements.available) || f.elements.available.checked,
    prepMin: ed.prepMin || 12,
    modifiers,
    updatedAt: new Date().toISOString()
  };
  Store.patch((d) => {
    const i = d.products.findIndex((x) => x.id === prod.id);
    if (i >= 0) d.products[i] = { ...d.products[i], ...prod };
    else d.products.unshift(prod);
  });
  STATE.editProduct = { ...prod };
  STATE.pickingPhoto = false;
  let published = false;
  if (window.Cloud && Cloud.pushProduct) published = await Cloud.pushProduct(prod);
  else if (window.Cloud) published = await Cloud.pushCatalog(Store.get());
  if (!published) {
    alert("El producto quedó guardado en este aparato, pero el servidor no confirmó la publicación. Revisa la conexión e intenta Guardar producto otra vez.");
    return false;
  }
  alert("Producto publicado correctamente. Ya aparecerá en el menú y en los demás teléfonos.");
  return true;
}

function applyImageData(kind, data) {
  if (kind === "product") {
    if (!STATE.editProduct) STATE.editProduct = {};
    STATE.editProduct.image = data;
    Store.patch((d) => {
      if (STATE.editProduct.id) {
        const p = d.products.find((x) => x.id === STATE.editProduct.id);
        if (p) { p.image = data; p.updatedAt = new Date().toISOString(); }
      }
    });
  } else if (kind === "cover") {
    Store.patch((d) => { d.settings.heroImage = data; });
  } else if (kind === "logo") {
    Store.patch((d) => { d.settings.logoImage = data; });
  }
  // Product photos are published together with Guardar producto, after the
  // product has an id. This prevents orphan photos and false success notices.
  if (window.Cloud && kind !== "product") Cloud.pushCatalog(Store.get());
  STATE.crop = null;
  const prev = $("#prodPrev");
  if (prev && kind === "product") prev.innerHTML = `<img src="${data}" style="width:140px;height:140px;object-fit:cover;border-radius:12px">`;
  if (kind !== "product") render();
}

function openCrop(kind, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = kind === "logo" ? 200 : (kind === "cover" ? 640 : 400);
      const fit = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(80, Math.round(img.width * fit));
      canvas.height = Math.max(80, Math.round(img.height * fit));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.55);
      applyImageData(kind, data);
      alert(kind === "cover" ? "Portada actualizada. Mira Inicio." : "Foto preparada. Ahora toca Guardar producto para publicarla en el menú.");
    };
    img.onerror = () => alert("Esa foto no se pudo leer. Prueba JPG o PNG.");
    img.src = reader.result;
  };
  reader.onerror = () => alert("No se pudo abrir la foto de la galería.");
  reader.readAsDataURL(file);
}

function commitCrop() {
  const c = STATE.crop;
  if (!c) return;
  const max = c.kind === "logo" ? 240 : (c.kind === "cover" ? 720 : 480);
  const fit = Math.min(1, max / Math.max(c.img.width, c.img.height));
  const scale = fit * ((Number(c.scale) || 100) / 100);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(64, Math.round(c.img.width * scale));
  canvas.height = Math.max(64, Math.round(c.img.height * scale));
  canvas.getContext("2d").drawImage(c.img, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/jpeg", 0.62);
  URL.revokeObjectURL(c.url);
  if (c.kind === "product") {
    const f = $("#productForm"); if (f) f.image.value = data;
    if (!STATE.editProduct) STATE.editProduct = {};
    STATE.editProduct.image = data;
    if (STATE.editProduct.id) {
      Store.patch((d) => {
        const p = d.products.find((x) => x.id === STATE.editProduct.id);
        if (p) { p.image = data; p.updatedAt = new Date().toISOString(); }
      });
    }
  } else if (c.kind === "cover") {
    const f = $("#coverForm"); if (f) f.heroImage.value = data;
    Store.patch((d) => { d.settings.heroImage = data; });
  } else if (c.kind === "logo") {
    const f = $("#settingsForm"); if (f && f.logoImage) f.logoImage.value = data;
    Store.patch((d) => { d.settings.logoImage = data; });
  }
  STATE.crop = null;
  $("#modal").classList.add("hidden");
  $("#modal").innerHTML = "";
  if (window.Cloud) Cloud.pushCatalog(Store.get());
  render();
}

function notifyAllowed() {
  return !("Notification" in window) || Notification.permission === "granted";
}
function notifyPromptHtml() {
  if (globalThis.CHINGADAZO_CONFIG?.configured === false) return '';
  if (window.ScreenLayout?.tv() || STATE.view === "caja") return "";
  if (!("Notification" in window)) return "";
  if (Notification.permission === "granted") return "";
  try { if (sessionStorage.getItem("chingadazo_notify_later") === "1") return ""; } catch {}
  const blocked = Notification.permission === "denied";
  return `<div class="flash" id="notifyAsk" style="margin:10px 12px 0">
    <div>🔔 ${isStaff() ? "Activa las notificaciones para recibir pedidos nuevos del restaurante." : "Activa las notificaciones para recibir promociones de El Chingadazo."}</div>
    ${blocked
      ? `<p class="hint" style="color:#fff;margin:8px 0 0">Están bloqueadas. En el teléfono: Ajustes → Notificaciones → Safari o Chrome → El Chingadazo → Permitir.</p>`
      : `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn gold" type="button" id="notifyYes">Activar notificaciones</button>
          <button class="btn ghost" type="button" id="notifyLater">Ahora no</button>
        </div>`}
  </div>`;
}

const CUSTOMER_TOUR = [
  { icon: "01", visual: "start", title: "Pedir es muy fácil", body: "Elige lo que te gusta, revisa tu carrito iluminado y envía la orden. Te guiamos paso a paso." },
  { icon: "02", visual: "menu", title: "Abre el Menú", body: "Toca Menú abajo. Verás todos los productos con fotos grandes, precio y un botón + muy claro." },
  { icon: "03", visual: "categories", title: "Filtra con un toque", body: "Las categorías son botones. Toca Birria, Tacos o Burritos para encontrarlo rápido." },
  { icon: "04", visual: "add", title: "Personaliza y agrega", body: "Toca el producto o el botón +, elige cantidad y añade notas como “sin cebolla” o “salsa aparte”." },
  { icon: "05", visual: "cart", title: "Sigue el carrito amarillo", body: "Cuando agregues algo, el carrito se iluminará. Tócalo para revisar, confirmar y luego seguir la orden." }
];

function customerTourHtml() {
  if (STATE.tourStep < 0 || isStaff()) return "";
  const step = CUSTOMER_TOUR[Math.min(STATE.tourStep, CUSTOMER_TOUR.length - 1)];
  const last = STATE.tourStep >= CUSTOMER_TOUR.length - 1;
  return `<div class="tour-overlay" role="dialog" aria-modal="true" aria-label="Guía rápida para ordenar">
    <section class="tour-card">
      <button class="tour-close" data-tour-skip aria-label="Cerrar guía">×</button>
      <div class="tour-step-number">${step.icon}</div>
      <div class="tour-visual tour-${step.visual}"><span></span><i></i><b></b></div>
      <div class="tour-progress">${CUSTOMER_TOUR.map((_, i) => `<i class="${i <= STATE.tourStep ? "on" : ""}"></i>`).join("")}</div>
      <small>Paso ${STATE.tourStep + 1} de ${CUSTOMER_TOUR.length}</small>
      <h2>${step.title}</h2>
      <p>${step.body}</p>
      <button class="btn gold full tour-next" data-tour-next>${last ? "¡Listo, quiero ordenar! 🎉" : STATE.tourStep === 0 ? "Enséñame cómo" : "Siguiente"}</button>
      ${last ? "" : `<button class="tour-skip" data-tour-skip>Omitir guía</button>`}
    </section>
  </div>`;
}

function finishCustomerTour() {
  STATE.tourStep = -1;
  try { localStorage.setItem("chingadazo_customer_tour_v1", "done"); } catch {}
  render();
}
function installPromptHtml() {
  if (globalThis.CHINGADAZO_CONFIG?.configured === false) return '';
  if (!STATE.installPromptVisible || isStaff() || IS_STANDALONE) return "";
  const help = IS_IOS
    ? `<div class="install-steps"><b>En iPhone:</b><span>1. Toca Compartir <strong>□↑</strong></span><span>2. Elige “Agregar a pantalla de inicio”</span><span>3. Toca “Agregar”</span></div>`
    : `<p>Instálala para abrirla como una aplicación, recibir avisos y encontrar tu pedido rápidamente.</p>`;
  return `<div class="install-overlay" role="dialog" aria-modal="true" aria-label="Instalar El Chingadazo">
    <section class="install-card"><div class="install-icon"><img src="assets/logo.jpg" alt=""></div>
      <small>APP OFICIAL</small><h2>Instala El Chingadazo</h2>${help}
      <button class="btn gold full" id="installAppNow">${IS_IOS ? "Ver cómo instalar" : "Instalar aplicación"}</button>
      <button class="install-later" id="installAppLater">Ahora no</button>
    </section></div>`;
}

let appServiceWorkerPromise = null;
function appServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.reject(new Error("Este navegador no admite notificaciones en segundo plano."));
  if (!appServiceWorkerPromise) appServiceWorkerPromise = navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(reg => { reg.update().catch(()=>{}); return reg; });
  return appServiceWorkerPromise;
}
async function subscribeAppPush(requestPermission = false) {
  if (STATE.pushSyncing || !("serviceWorker" in navigator) || !("Notification" in window) || !currentUser()) return false;
  STATE.pushSyncing = true;
  try {
    const permission = Notification.permission === "granted" ? "granted" : (requestPermission ? await Notification.requestPermission() : Notification.permission);
    if (permission !== "granted") return false;
    const user=currentUser(), stampKey="chingadazo_push_synced_"+user.id;
    if (!requestPermission && STATE.pushUser===user.id && Date.now()-Number(localStorage.getItem(stampKey)||0)<6*60*60*1000) return true;
    const cfgRes=await fetch("/api/push-config",{cache:"no-store"}), cfg=await cfgRes.json();
    if(!cfgRes.ok || !cfg.enabled) throw new Error("Las notificaciones push todavía no están configuradas en el servidor.");
    const registration=await appServiceWorker();
    const pushToken=await AuthBridge.messagingToken(registration,cfg.vapidKey);
    const idToken=await AuthBridge.idToken();
    const saved=await fetch("/api/push-subscribe",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+idToken},body:JSON.stringify({token:pushToken,platform:navigator.userAgent})});
    if(!saved.ok) { const data=await saved.json().catch(()=>({})); throw new Error(data.error||"No se pudo activar este dispositivo."); }
    STATE.pushUser=user.id; localStorage.setItem(stampKey,String(Date.now()));
    return true;
  } finally { STATE.pushSyncing=false; }
}
async function askNotifications() {
  if (!("Notification" in window)) { alert("Este navegador no admite avisos. Usa Chrome o Safari."); return; }
  try {
    const p = await Notification.requestPermission();
    if (p === "granted") {
      await subscribeAppPush(true);
      const idToken=await AuthBridge.idToken();
      const test=await fetch("/api/push-test",{method:"POST",headers:{Authorization:"Bearer "+idToken}}), result=await test.json().catch(()=>({}));
      if(!test.ok) throw new Error(result.error||"No se pudo entregar la prueba push.");
      alert("Prueba enviada. Bloquea el teléfono o cierra la app y confirma que recibiste el aviso.");
    } else {
      alert("No quedaron activadas. Puedes activarlas luego en Ajustes del teléfono.");
    }
  } catch {
    alert("Ábrelo desde Safari (iPhone) o Chrome (Android) e instálalo en la pantalla de inicio.");
  }
  render();
}

let lastRenderedMarkup = "";
let appBooting = true;
function render() {
  if (appBooting) return;
  syncLocalAccount();
  window.ScreenLayout?.before();
  if (STATE.crop || STATE.pickingPhoto) return;
  // Background updates must not replace the form currently being edited.
  if (document.activeElement?.matches?.("input, textarea, select") || document.activeElement?.closest?.("#promoForm, #blastForm, #welcomeBonusForm, #deliverySettingsForm")) return;
  const root = $("#app");
  if (!root) return;
  const sameView = STATE.renderedView === STATE.view;
  // Dining mounts after this markup and manages its own disclosure state.
  const detailsState = sameView ? [...root.querySelectorAll("details[data-fold]")].map((d) => [d.dataset.fold,d.open]) : [];
  const previousScroll = sameView ? window.scrollY : 0;
  const map = {
    home: viewHome,
    menu: viewMenu,
    cart: viewCart,
    checkout: () => { const u = currentUser(); return u ? viewCheckout() : viewLogin(); },
    success: viewSuccess,
    orders: viewOrders,
    "live-order": viewLiveOrder,
    login: viewLogin,
    "staff-access": viewStaffAccess,
    recover: viewRecover,
    register: viewRegister,
    privacy: viewPrivacy,
    terms: viewTerms,
    account: viewAccount,
    stories: viewStories,
    caja: viewCaja,
    mesas: () => canCash() && window.DiningUI ? '<section id="diningRoot"></section>' : viewStaffAccess(),
    recibidas: viewRecibidas,
    "admin-promos": viewAdminPromos,
    turno: viewTurno,
    cocina: viewCocina,
    "admin-users": viewTeam,
    rewards: viewRewards,
    admin: viewAdmin,
    "admin-products": viewAdminProducts,
    "admin-orders": viewAdminOrders,
    "admin-settings": viewAdminSettings,
    "admin-crm": viewAdminCRM,
    "admin-clientes": viewAdminClientes,
    "admin-delivery": viewAdminDelivery,
    "admin-insights": viewAdminInsights,
    "admin-manager": viewAdminManager,
    "admin-costs": viewAdminCosts,
    "admin-system": viewAdminSystem,
    "admin-cover": viewAdminCover,
    "chingadazo-ai": viewChingadazoAI,
    "food-profile": viewFoodProfile,
    family: viewFamily,
    "payer-game": viewPayerGame,
    chupistica: viewChupistica
  };
  let view = "";
  try { view = map[STATE.view] ? map[STATE.view]() : viewHome(); }
  catch (err) { console.error(err); view = `<div class="auth-wrap"><h1>No pudimos mostrar esta pantalla</h1><p class="hint">Actualiza e inténtalo nuevamente.</p><button class="btn" data-go="${isStaff()?"admin":"home"}">${isStaff()?"Volver a Administración":"Volver al inicio"}</button></div>`; }
  const diningKitchenSlot=['cocina','admin'].includes(STATE.view)&&canKitchen()&&window.DiningKitchen?'<section id="diningKitchenRoot"></section>':'';
  const markup = renderTop() + notifyPromptHtml() + `<main class="page">${diningKitchenSlot}${view}</main>` + renderTabs() + `<div id="modal" class="hidden"></div><div id="liveNotice" class="notice-banner"></div>` + installPromptHtml() + (STATE.installPromptVisible ? "" : customerTourHtml());
  if (markup === lastRenderedMarkup && sameView) { updateBadges(); window.ScreenLayout?.after(); return; }
  root.innerHTML = markup;
  lastRenderedMarkup = markup;
  window.ScreenLayout?.after();
  if (sameView) [...root.querySelectorAll("details[data-fold]")].forEach((d) => { const saved=detailsState.find(([key])=>key===d.dataset.fold);if(saved)d.open=saved[1]; });
  STATE.renderedView = STATE.view;
  if(STATE.view==='caja'&&canCash())window.DiningCash?.mount(document.getElementById('diningCashRoot'),{
    fullScreen:true,paymentOnMount:STATE.cashPane==='table-payment',
    onPayment:show=>window.CashScreens?.open(show?'table-payment':'waiting',true),
    onWaiting:()=>window.CashScreens?.open('waiting',true),
    onAccount:text=>window.CashScreens?.tableSummary(text),
    user:currentUser(),api:managerApi,getTicket:()=>STATE.posTicket,getContext:()=>localDraft(),
    setContext:value=>Object.assign(STATE,{posDiningAccountId:'',posDiningTableId:''},value),
    ready:()=>!STATE.posSending&&!STATE.pendingPosOrder&&(!globalThis.ChingadazoContinuity||localReady),
    save:async()=>{syncLocalAccount();await localWork;if(globalThis.ChingadazoContinuity&&!localSignature)throw Error('No se confirmó el guardado local.');},
    clear:async operationId=>{Object.assign(STATE,{posTicket:[],posName:'',posPayWith:'',posDiningAccountId:'',posDiningTableId:'',posDiningConfirmedOp:operationId});syncLocalAccount();await localWork;if(globalThis.ChingadazoContinuity&&!localSignature)throw Error('Pedido guardado; falta conciliar el borrador local.');},
    changed:action=>{STATE.cashPane=action==='checkout'?'waiting':'sale';render();},getPayment:()=>({payment:STATE.posPay,payWith:Number(STATE.posPayWith||0),shiftId:myOpenShift()?.id||''}),
    printSale:async (order,choice)=>{await Cloud.sync();if(opensDrawer(order))await openCashDrawer(order);if(choice??autoPrintEnabled())await printTicket(order,'client');}
  });else window.DiningCash?.stop();
  if(STATE.view==='caja'&&canCash())window.CashScreens?.mount(root.querySelector('.page'),{
    getPane:()=>STATE.cashPane,setPane:v=>STATE.cashPane=v,table:()=>!!STATE.posDiningAccountId,
    ticket:()=>STATE.posTicket,total:()=>posSubtotal(),ready:()=>!STATE.posSending&&globalThis.navigator?.onLine!==false,
    busy:()=>STATE.posSending||window.DiningCash?.pending(),pending:()=>!!STATE.pendingPosOrder,onTablePay:()=>window.DiningCash?.startPayment(),onTableCancel:()=>window.DiningCash?.cancelPayment()
  });
  if(STATE.posDiningAccountId){for(const id of ['posSell','posSellAlternate']){const button=document.getElementById(id);if(button)button.hidden=true;}}
  if (STATE.view === 'mesas' && canCash()) window.DiningUI?.mount(document.getElementById('diningRoot'),{user:currentUser(),api:managerApi,isActive:()=>STATE.view==='mesas' && canCash(),products:()=>Store.get().products||[],onCash:table=>{if(STATE.posTicket.length||STATE.pendingPosOrder){alert('Termina o guarda el pedido actual de Caja antes de abrir otra mesa.');return;}STATE.posDiningAccountId=table.accountId;STATE.posDiningTableId=table.id;go('caja');}});
  else window.DiningUI?.stop();
  if (['cocina','admin'].includes(STATE.view) && canKitchen()) window.DiningKitchen?.mount(document.getElementById('diningKitchenRoot'),{user:currentUser(),api:managerApi,isActive:()=>['cocina','admin'].includes(STATE.view)&&canKitchen()});
  else window.DiningKitchen?.stop();
  updateBadges();
  if (STATE.product) renderModal();
  root.querySelectorAll("img[data-customer-map]").forEach(async img=>{try{const token=await AuthBridge.idToken(),res=await fetch(img.dataset.customerMap,{headers:{Authorization:"Bearer "+token}});if(!res.ok)throw new Error();const url=URL.createObjectURL(await res.blob());img.onload=img.onerror=()=>URL.revokeObjectURL(url);img.src=url}catch{img.style.display="none"}});
  animatePoints();
  if (STATE.view === "orders") window.setTimeout(syncCompletedDeliveryRatings, 0);
  if (currentUser() && "Notification" in window && Notification.permission === "granted") window.setTimeout(() => subscribeAppPush(false).catch(()=>{}), 0);
  if (previousScroll > 0) requestAnimationFrame(() => window.scrollTo(0, previousScroll));
}

function animatePoints() {
  const el = $("#ptsCount");
  if (!el) return;
  const target = Number(el.dataset.pts || 0);
  const start = 0;
  const t0 = performance.now();
  const dur = Math.min(1400, 400 + target * 8);
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(start + (target - start) * eased));
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = String(target);
  };
  requestAnimationFrame(tick);
}

function tickTimers() {
  document.querySelectorAll(".timer-chip[data-oid]").forEach((el) => {
    const o = (Store.get().orders || []).find((x) => x.id === el.dataset.oid);
    if (o) el.textContent = orderElapsed(o);
  });
}

function updateBadges() {
  const b = $("#cartBadge");
  if (b) b.textContent = cartCount();
}

async function persistUser(user) {
  if (!user || !user.id) return false;
  try {
    let ok = false;
    if (window.Cloud) ok = await Cloud.pushUser(user);
    else {
      const res = await fetch("https://chingadazo-api.invalid/app/users/" + encodeURIComponent(user.id) + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
        keepalive: true
      });
      ok = res.ok;
    }
    if (ok) {
      Store.patch((d) => {
        const saved = d.users.find((x) => x.id === user.id);
        if (saved) saved.pendingSync = false;
      });
    }
    return ok;
  } catch {
    return false;
  }
}

function login(id, password) {
  // Local demo credentials must not authenticate production users.
  return false;
}

function customerDni(value) {
  const normalized=String(value ?? '').trim().replace(/[\s-]/g,'');
  return /^\d{13}$/.test(normalized)?normalized:'';
}
function customerPhone(value) {
  let normalized=String(value ?? '').trim().replace(/[\s()-]/g,'');
  if(normalized.startsWith('+504'))normalized=normalized.slice(4);
  else if(/^504\d{8}$/.test(normalized))normalized=normalized.slice(3);
  return /^\d{8}$/.test(normalized)?normalized:'';
}
function customerProfileComplete(p) {
  return !!(p && String(p.name || '').trim() && customerPhone(p.phone) && customerDni(p.dni) && String(p.addresses?.[0]?.line || '').trim());
}
async function finishAuthLogin(authUser, profile) {
  if (!authUser || !profile) return false;
  if (profile.role === 'customer' && !customerProfileComplete(profile)) {
    STATE.googleAuth = authUser; go('register'); return false;
  }
  const now = new Date().toISOString();
  window.__verifiedProfile = profile;
  Store.patch((d) => {
    const u = d.users.find((x) => x.id === profile.id);
    if (!u) return;
    u.authUid = authUser.uid;
    u.authProvider = authUser.provider;
    u.emailVerified = authUser.emailVerified === true;
    u.photoURL = authUser.photoURL || u.photoURL || "";
    u.password = "";
    u.pin = "";
    d.session = u.id;
  });
  const saved = Store.get().users.find((x) => x.id === profile.id);
  try { localStorage.setItem("chingadazo_session_id", saved.id); sessionStorage.setItem("chingadazo_session_id", saved.id); } catch {}
  await persistUser(saved);
  await Cloud.sync();
  if(profile.role==="customer") trackFunnel("login_success");
  go(landingFor(saved));
  return true;
}

async function secureLogin(id, password) {
  try {
    const authUser = await AuthBridge.signInEmail(normalizeEmail(id), password);
    if(!authUser.emailVerified){
      alert("Tu cuenta existe, pero falta activarla. Busca el correo de El Chingadazo en Entrada, Spam, No deseados o Promociones y abre el enlace de confirmación.");
      return true;
    }
    PrivateSession.clear();
    await Cloud.sync();
    const profile = Store.get().users.find(u => u.id === 'auth-' + authUser.uid);
    if (!profile) { STATE.googleAuth=authUser; go('register'); return true; }
    if (profile.role !== 'customer') { await AuthBridge.signOut(); PrivateSession.clear(); alert('Entra por el portal privado del personal.'); return true; }
    await finishAuthLogin(authUser,profile);
  } catch(error) {
    const code=String(error?.code || "");
    alert(code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("wrong-password")
      ? "No encontramos una cuenta activa con esos datos. Si es tu primera vez, toca ‘Crear mi cuenta primero’. Si ya te registraste, confirma el correo que enviamos y revisa también Spam."
      : AuthBridge.message(error));
  }
  return true;
}

async function staffPinLogin(pin, expectedId = "") {
  if (STATE.staffLoginBusy) return;
  STATE.staffLoginBusy = true;
  STATE.staffLoginMessage = "";
  render();
  try {
    const res = await fetch("/api/staff-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: String(pin || "") })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403 && String(payload.error || "").includes("dispositivo")) {
        localStorage.removeItem("chingadazo_staff_authorized");
        go("staff-access");
      }
      throw new Error(payload.error || "PIN incorrecto.");
    }
    const authUser = await AuthBridge.signInToken(payload.token);
    const profile = payload.profile;
    if(expectedId && profile.id!==expectedId){await AuthBridge.signOut().catch(()=>{});throw new Error("Ese PIN no pertenece al usuario seleccionado.");}
    PrivateSession.clear();
    Store.patch((d) => {
      const i = d.users.findIndex((u) => u.id === profile.id);
      if (i >= 0) d.users[i] = { ...d.users[i], ...profile };
      else d.users.push(profile);
    });
    await finishAuthLogin(authUser, profile);
  } catch (error) {
    STATE.staffLoginMessage = error.message || "No se pudo iniciar con el PIN.";
    alert(STATE.staffLoginMessage);
  } finally {
    STATE.staffLoginBusy = false;
    if (STATE.view === "staff-access") render();
  }
}

async function authorizeStaffDevice(email, password) {
  const authUser = await AuthBridge.signInEmail(normalizeEmail(email), password);
  const token = await AuthBridge.idToken();
  const res = await fetch("/api/staff-authorize", { method: "POST", headers: { Authorization: "Bearer " + token } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "No se pudo autorizar este dispositivo.");
  localStorage.setItem("chingadazo_staff_authorized", "1");
  const staffRes = await fetch("/api/staff-me", { headers: { Authorization: "Bearer " + token } });
  const profile = await staffRes.json().catch(() => ({}));
  if (!staffRes.ok) throw new Error(profile.error || "No se encontró el perfil administrativo.");
  PrivateSession.clear();
  Store.patch((d) => {
    const i = d.users.findIndex((u) => u.id === profile.id);
    if (i >= 0) d.users[i] = { ...d.users[i], ...profile };
    else d.users.push(profile);
  });
  await finishAuthLogin(authUser, profile);
  return true;
}

let googleAccessBusy = false;
async function googleAccess() {
  if (googleAccessBusy) return;
  googleAccessBusy = true;
  const buttons = [...document.querySelectorAll('#googleLogin, #googleRegister')];
  buttons.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
  try {
    const authUser = await AuthBridge.signInGoogle();
    PrivateSession.clear();
    if (window.Cloud) await Cloud.sync();
    const profile = (Store.get().users || []).find((u) =>
      u.id === 'auth-' + authUser.uid
    );
    if (profile && profile.role !== 'customer') {
      await AuthBridge.signOut(); PrivateSession.clear();
      alert('Entra por el portal privado del personal.'); return;
    }
    if (profile && customerProfileComplete(profile)) {
      await finishAuthLogin(authUser, profile);
      return;
    }
    STATE.googleAuth = authUser;
    go("register");
  } catch (error) {
    alert(AuthBridge.message(error));
  } finally {
    googleAccessBusy = false;
    buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
  }
}

async function refreshVerifiedBonus() {
  if (!window.AuthBridge) return;
  try {
    const authUser = await AuthBridge.current();
    if (!authUser) return;
    const profile = (Store.get().users || []).find((u) =>
      (u.authUid && u.authUid === authUser.uid) || normalizeEmail(u.email) === normalizeEmail(authUser.email)
    );
    if (!profile) return;
    const before = Number(profile.pendingWelcomeBonus || 0);
    if (authUser.emailVerified && before > 0) {
      await finishAuthLogin(authUser, profile);
      alert("¡Correo confirmado! Ya activamos tus " + before + " puntos gratis.");
    }
  } catch {}
}

async function register(data) {
  data.name = String(data.name || '').trim();
  data.address = String(data.address || '').trim();
  if (!data.name) { alert('Escribe tu nombre completo.'); return; }
  if (!data.address) { alert("La dirección es obligatoria."); return; }
  data.email = normalizeEmail(data.email);
  data.phone = customerPhone(data.phone);
  data.dni = customerDni(data.dni);
  if (!data.phone) { alert("Escribe un teléfono hondureño de exactamente 8 dígitos. Puedes incluir +504."); return; }
  if (!data.dni) { alert("Tu número de identidad debe contener exactamente 13 dígitos."); return; }
  const db = Store.get();
  const now = new Date().toISOString();
  let authUser = STATE.googleAuth || null;
  let createdAuth = false;
  if (!authUser) {
    try {
      authUser = await AuthBridge.createEmail(data.email, data.password);
      createdAuth = true;
    } catch (error) {
      alert(AuthBridge.message(error));
      return;
    }
  }
  const existingUser=(Store.get().users||[]).find(u=>u.id==="auth-"+authUser.uid);
  const verified = authUser.emailVerified === true;
  const bonus = Number((Store.get().settings || {}).welcomeBonus ?? 500);
  const user = {
    ...(existingUser||{}),
    id: "auth-" + authUser.uid,
    role: "customer",
    name: data.name,
    dni: data.dni,
    email: data.email,
    phone: data.phone,
    password: "",
    points: existingUser ? Number(existingUser.points||0) : (verified ? bonus : 0),
    welcomeBonus: existingUser ? Number(existingUser.welcomeBonus||0) : (verified ? bonus : 0),
    pendingWelcomeBonus: existingUser ? Number(existingUser.pendingWelcomeBonus||0) : (verified ? 0 : bonus),
    authUid: authUser.uid,
    authProvider: authUser.provider,
    emailVerified: verified,
    photoURL: authUser.photoURL || "",
    welcomeAt: now,
    createdAt: existingUser?.createdAt || now,
    pointsUpdatedAt: existingUser?.pointsUpdatedAt || now,
    pendingSync: true,
    addresses: [{ id: existingUser?.addresses?.[0]?.id || Store.uid("ad"), label: existingUser?.addresses?.[0]?.label || "Principal", line: data.address }, ...(existingUser?.addresses||[]).slice(1)]
  };
  Store.patch((d) => { d.users = d.users.filter(u => u.id !== user.id); d.users.push(user); d.session = user.id; });
  const saved = await persistUser(user);
  if (!saved) {
    Store.patch((d) => {
      d.users = d.users.filter((x) => x.id !== user.id);
      if(existingUser)d.users.push(existingUser);
      if (d.session === user.id) d.session = null;
    });
    STATE.googleAuth=authUser;
    alert("No se confirmó el guardado del perfil. Conservamos tu acceso para que puedas reintentar sin crear otra cuenta.");
    return;
  }
  window.__verifiedProfile = user;
  if(!existingUser)trackFunnel("register_complete");
  if(!verified) trackFunnel("email_pending");
  STATE.googleAuth = null;
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  alert(existingUser ? "Datos actualizados. Conservamos tu cuenta y tus puntos." : verified
    ? "¡Bienvenido! Ganaste " + bonus + " puntos por registrarte con Google."
    : "Cuenta creada. Te enviamos un enlace para activar tus " + bonus + " puntos. Revisa tu correo y Spam.");
  if(window.Cloud)await Cloud.sync().catch(()=>{});
  go(verified && STATE.afterLogin ? STATE.afterLogin : "rewards");
}

document.addEventListener("toggle", (e) => {
  const d = e.target.closest && e.target.closest("details[data-fold]");
  if (!d) return;
  STATE.fold = STATE.fold || {};
  STATE.fold[d.dataset.fold] = d.open;
}, true);
document.addEventListener("click", async (e) => {
  if(e.target.closest?.('#resetFunnelMetrics')){
    if(!canAdmin())return;
    if(prompt('Se archivarán solo las métricas de navegación. Escribe REINICIAR METRICAS para comenzar una medición nueva.')!=='REINICIAR METRICAS')return;
    const button=e.target.closest('#resetFunnelMetrics');button.disabled=true;
    try{const token=await AuthBridge.idToken();const response=await fetch('/api/analytics/reset',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({confirmation:'REINICIAR METRICAS',expectedResetId:STATE.funnelReport?.resetId||'initial',requestId:crypto.randomUUID()})});const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo reiniciar.');await loadFunnelReport();alert('Métricas reiniciadas. Las anteriores quedaron archivadas.');}
    catch(error){alert(error.message);await loadFunnelReport();}finally{button.disabled=false;}return;
  }
  const adminClose=e.target.closest('[data-admin-close-shift]');
  if(adminClose && canCash()){
    const counted=prompt('Efectivo contado para este turno (L.). No incluyas fondos de otro turno. Cancelar conserva el turno abierto.');
    if(counted===null)return;
    if(!counted.trim()||!Number.isFinite(Number(counted))||Number(counted)<0){alert('Ingresa un monto válido.');return;}
    if(!confirm('¿Cerrar este turno con el efectivo contado indicado?'))return;
    adminClose.disabled=true;
    try{await closeMyShift(Number(counted),'Cierre revisado por administración',adminClose.dataset.adminCloseShift);await Cloud.sync();render();}catch(error){alert(error.message);adminClose.disabled=false;}
    return;
  }

  const posControl=e.target.closest('[data-pos-cat],[data-pos-ch],[data-pos-pay],[data-pos-prod],[data-pos-rem],#posSell,#posSellAlternate,#posHold,#posClear,#posExact,[data-hold-open]');
  if(posControl && (window.DiningCash?.pending() || (globalThis.ChingadazoContinuity && STAFF_DEVICE_MODE && !localReady) || STATE.posSending || (STATE.pendingPosOrder && !['posSell','posSellAlternate'].includes(posControl.id)))) {
    e.preventDefault(); return;
  }
  if(e.target.id==='posExact'){STATE.posPayWith=posSubtotal();render();return;}

  const staffSelect=e.target.closest("[data-staff-select]");
  if(staffSelect){STATE.staffSelected=staffSelect.dataset.staffSelect;STATE.staffPin="";STATE.staffLoginMessage="";render();return;}
  const staffKey=e.target.closest("[data-staff-key]");
  if(staffKey){
    if(STATE.staffLoginBusy)return;
    const key=staffKey.dataset.staffKey;
    if(key==="b")STATE.staffPin=STATE.staffPin.slice(0,-1);
    else if(key==="clear")STATE.staffPin="";
    else if(STATE.staffPin.length<6){
      STATE.staffPin+=key;
      if(STATE.staffPin.length===6){
        staffKey.disabled=true;const pin=STATE.staffPin,expected=STATE.staffSelected;STATE.staffPin="";
        await staffPinLogin(pin,expected);return;
      }
    }
    render();return;
  }
  if (canKitchen()) Alarm.unlock();
  const aiAccept = e.target.closest("[data-ai-accept]");
  if (aiAccept) {
    const suggestion = smartRecommendation(); if (!suggestion) return;
    if (STATE.cart.length && !confirm("¿Reemplazar el pedido que ya tienes con esta combinación?")) return;
    STATE.cart = suggestion.items; saveCart(); trackFunnel("ai_accept"); go("cart"); return;
  }
  if (e.target.closest("[data-ai-budget]")) {
    const value = prompt("¿Cuánto quieres gastar solamente en comida? El delivery se calcula con tu GPS.", String(STATE.smartBudget));
    if (value === null) return; const amount = Number(String(value).replace(/[^0-9.]/g,""));
    if (!Number.isFinite(amount) || amount < 100 || amount > 5000) { alert("Escribe un presupuesto entre L.100 y L.5,000."); return; }
    STATE.smartBudget = Math.round(amount); localStorage.setItem("chingadazo_smart_budget", String(STATE.smartBudget)); render(); return;
  }
  if (e.target.closest("[data-ai-people]")) {
    const value = prompt("¿Para cuántas personas es la comida?", String(STATE.smartPeople));
    if (value === null) return; const people = Number(value);
    if (!Number.isInteger(people) || people < 1 || people > 12) { alert("Elige entre 1 y 12 personas."); return; }
    STATE.smartPeople = people; localStorage.setItem("chingadazo_smart_people", String(people)); render(); return;
  }
  if (e.target.closest("[data-ai-surprise], [data-ai-change]")) {
    STATE.smartSeed += 1; sessionStorage.setItem("chingadazo_smart_seed", String(STATE.smartSeed));
    if (e.target.closest("[data-ai-surprise]")) trackFunnel("ai_surprise"); render(); return;
  }
  if (e.target.closest("[data-family-create]")) {
    if (!currentUser()) { STATE.afterLogin="family"; go("login"); return; }
    try { const room=await familyApi({action:"create"}); STATE.familyRoom=room; STATE.familyCode=room.code; localStorage.setItem("chingadazo_family_code",room.code); trackFunnel("family_create"); render(); }
    catch(error){alert(error.message);} return;
  }
  if (e.target.closest("[data-family-refresh]")) { await loadFamilyRoom(); return; }
  if (e.target.closest("[data-family-copy]")) {
    try { await navigator.clipboard.writeText(STATE.familyCode); alert("Código copiado. La otra persona debe abrir El Chingadazo e introducirlo en Pedido familiar."); }
    catch { prompt("Copia este código temporal:", STATE.familyCode); } return;
  }
  if (e.target.closest("[data-family-add]")) { STATE.familyMode=true; STATE.cat="destacados"; go("menu"); return; }
  if (e.target.closest("[data-family-back]")) { STATE.familyMode=false; go("family"); return; }
  const familyQty=e.target.closest("[data-family-qty]");
  if(familyQty){const item=STATE.familyRoom?.items?.find(i=>i.id===familyQty.dataset.familyQty);if(item)try{await familyAction("quantity",{itemId:item.id,qty:Math.max(1,item.qty+Number(familyQty.dataset.d||0))});}catch(error){alert(error.message);}return;}
  const familyRemove=e.target.closest("[data-family-remove]");
  if(familyRemove){try{await familyAction("remove",{itemId:familyRemove.dataset.familyRemove});}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-family-ready]")){const me=STATE.familyRoom?.members?.find(m=>m.id===STATE.familyRoom.meId);try{await familyAction("ready",{ready:!me?.ready});}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-family-checkout]")){
    try{const room=await familyAction("prepare");STATE.cart=(room.items||[]).map(i=>({...i,key:Store.uid("fam")}));STATE.familyCheckoutCode=room.code;STATE.familyMode=false;saveCart();trackFunnel("family_checkout");go("checkout");}catch(error){alert(error.message);}return;
  }
  if(e.target.closest("[data-family-cancel]")){
    if(!confirm("¿Cancelar este círculo familiar?"))return;
    try{await familyAction("cancel");}catch(error){alert(error.message);}STATE.familyRoom=null;STATE.familyCode="";STATE.familyMode=false;localStorage.removeItem("chingadazo_family_code");render();return;
  }
  if(e.target.closest("[data-payer-create]")){
    try{const game=await payerGameApi({action:"create"});STATE.payerGame=game;STATE.payerGameCode=game.code;localStorage.setItem("chingadazo_payer_game_code",game.code);trackFunnel("payer_game_create");render();}catch(error){alert(error.message);}return;
  }
  if(e.target.closest("[data-payer-refresh]")){await loadPayerGame();return;}
  if(e.target.closest("[data-payer-copy]")){
    try{await navigator.clipboard.writeText(STATE.payerGameCode);alert("Código copiado. Tus amigos deben abrir Cuenta → ¿Quién paga hoy? e ingresarlo.");}
    catch{prompt("Copiá este código temporal:",STATE.payerGameCode);}return;
  }
  if(e.target.closest("[data-payer-draw]")){
    if(STATE.payerGameBusy||STATE.payerGame?.status==="spinning")return;
    try{STATE.payerGame=await payerGameAction("draw");trackFunnel("payer_game_draw");render();}
    catch(error){alert(error.message);}return;
  }
  if(e.target.closest("[data-payer-new]")){try{await payerGameAction("new_round");render();}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-payer-leave]")){try{await payerGameAction("leave");STATE.payerGame=null;STATE.payerGameCode="";localStorage.removeItem("chingadazo_payer_game_code");render();}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-payer-cancel]")){
    if(!confirm("¿Cerrar esta ruleta para todos?"))return;
    try{await payerGameAction("cancel");}catch(error){alert(error.message);}STATE.payerGame=null;STATE.payerGameCode="";localStorage.removeItem("chingadazo_payer_game_code");render();return;
  }
  if(e.target.closest("[data-chupi-create]")){
    try{const game=await chupisticaApi({action:"create"});STATE.chupisticaGame=game;STATE.chupisticaCode=game.code;localStorage.setItem("chingadazo_chupistica_code",game.code);trackFunnel("chupistica_create");render();}catch(error){alert(error.message);}return;
  }
  if(e.target.closest("[data-chupi-refresh]")){await loadChupistica();return;}
  if(e.target.closest("[data-chupi-copy]")){
    try{await navigator.clipboard.writeText(STATE.chupisticaCode);alert("Código copiado. Deben abrir Cuenta → Cultura Chupística e ingresarlo.");}
    catch{prompt("Copiá el código de la sala:",STATE.chupisticaCode);}return;
  }
  if(e.target.closest("[data-chupi-start]")){try{await chupisticaAction("start");trackFunnel("chupistica_start");render();}catch(error){alert(error.message);}return;}
  const chupiAnswer=e.target.closest("[data-chupi-answer]");
  if(chupiAnswer){try{await chupisticaAction("answer",{option:Number(chupiAnswer.dataset.chupiAnswer)});trackFunnel("chupistica_answer");render();}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-chupi-reveal]")){try{await chupisticaAction("reveal");render();}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-chupi-next]")){try{await chupisticaAction("next");render();}catch(error){alert(error.message);}return;}
  if(e.target.closest("[data-chupi-leave]")){try{await chupisticaAction("leave");}catch(error){alert(error.message);}STATE.chupisticaGame=null;STATE.chupisticaCode="";localStorage.removeItem("chingadazo_chupistica_code");render();return;}
  if(e.target.closest("[data-chupi-cancel]")){
    if(!confirm("¿Cerrar Cultura Chupística para todos?"))return;
    try{await chupisticaAction("cancel");}catch(error){alert(error.message);}STATE.chupisticaGame=null;STATE.chupisticaCode="";localStorage.removeItem("chingadazo_chupistica_code");render();return;
  }
  if (e.target.id === "googleLogin" || e.target.id === "googleRegister") { googleAccess(); return; }
  if (e.target.closest("[data-recover-again]")) { STATE.recoverySentEmail=""; render(); return; }
  if (e.target.id === "resendVerification") {
    AuthBridge.resendVerification().then(() => alert("Correo de verificación reenviado. Revisa también Spam.")).catch((error) => alert(AuthBridge.message(error)));
    return;
  }
  if (e.target.id === "deleteAccount") {
    const user = currentUser();
    if (!user || user.role !== "customer" || !user.authUid) return;
    if (!confirm("¿Eliminar definitivamente tu cuenta, perfil y puntos? Esta acción no se puede deshacer.")) return;
    const typed = prompt("Para confirmar, escribe exactamente: ELIMINAR MI CUENTA");
    if (typed !== "ELIMINAR MI CUENTA") { alert("No se eliminó la cuenta."); return; }
    if (!confirm("Última confirmación: se eliminarán tu perfil y tus puntos. ¿Deseas continuar?")) { alert("No se eliminó la cuenta."); return; }
    e.target.disabled = true;
    try {
      const ok = await Cloud.deleteUser(user.id);
      if (!ok) throw new Error("No se pudo eliminar el perfil. Solicita la eliminación a soporte.");
      await AuthBridge.deleteCurrent();
      Store.patch((d) => {
        d.users = d.users.filter((u) => u.id !== user.id);
        d.orders.forEach((o) => {
          if (o.userId !== user.id) return;
          o.userId = "deleted";
          o.customerName = "Cliente eliminado";
          o.phone = ""; o.dni = ""; o.address = "";
        });
        d.session = null;
      });
      try { localStorage.removeItem("chingadazo_session_id"); sessionStorage.removeItem("chingadazo_session_id"); } catch {}
      alert("Tu cuenta fue eliminada.");
      go("home");
    } catch (error) {
      alert((error && String(error.code || "").includes("requires-recent-login"))
        ? "Por seguridad, cierra sesión, vuelve a entrar y solicita la eliminación nuevamente."
        : (error.message || "No se pudo eliminar la cuenta."));
      e.target.disabled = false;
    }
    return;
  }
  if (e.target.id === "notifyYes") { askNotifications(); return; }
  if (e.target.id === "installAppNow") {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice=await deferredInstallPrompt.userChoice.catch(()=>({outcome:"dismissed"}));
      if(choice.outcome==="accepted") { STATE.installPromptVisible=false; deferredInstallPrompt=null; }
    } else if (IS_IOS) {
      alert("Toca el botón Compartir de Safari, selecciona ‘Agregar a pantalla de inicio’ y luego toca ‘Agregar’.");
    } else {
      alert("Abre el menú de Chrome y toca ‘Instalar aplicación’ o ‘Agregar a pantalla principal’.");
    }
    render(); return;
  }
  if (e.target.id === "installAppLater") {
    try { localStorage.setItem("chingadazo_install_later",String(Date.now())); } catch {}
    STATE.installPromptVisible=false; render(); return;
  }
  if (e.target.id === "reloadDeliveryAdmin") { await loadDeliveryAdmin(); return; }
  if (e.target.id === "captureRestaurantLocation") {
    if(!confirm("¿Estás físicamente en la entrada del restaurante? Esta medición usa la ubicación de este dispositivo."))return;
    const button=e.target; button.disabled=true;
    try { const point=await bestLocation({maxAccuracy:30,targetAccuracy:10}); const f=document.getElementById("deliverySettingsForm");
      if(f){f.lat.value=point.lat.toFixed(7);f.lng.value=point.lng.toFixed(7);captureDeliverySettingsDraft(f);}
      alert(`Medición obtenida: radio estimado ±${Math.round(point.accuracy)} m. Revisa las coordenadas de la entrada antes de Guardar.`);
    } catch(error){alert(error.message);} finally {button.disabled=false;} return;
  }
  if (e.target.id === "useVerifiedRestaurantLocation") {
    const f = document.getElementById("deliverySettingsForm");
    if (f) { f.lat.value = ""; f.lng.value = ""; f.restaurantAddress.value = "Ubicación por confirmar"; captureDeliverySettingsDraft(f); }
    alert("Coordenadas de referencia colocadas. Revisa que correspondan a la entrada del local. Pulsa Guardar configuración de delivery.");
    return;
  }
  if (e.target.id === "confirmDeliveryLocation") {
    e.target.disabled = true; e.target.textContent = "📍 Confirmando…";
    try {
      const testing = nationwideDeliveryTestEnabled();
      const location = await bestLocation();
      const maximumAccuracy = 100;
      if (location.accuracy > maximumAccuracy) throw new Error(`La precisión es de ±${Math.round(location.accuracy)} m. Activa “Ubicación precisa”, sal al exterior o acércate a una ventana e inténtalo nuevamente.`);
      STATE.checkoutLocation = location; STATE.checkoutDeliveryQuote = null;
      await requestDeliveryQuote(document.getElementById("checkoutForm"));
      trackFunnel("location_confirmed");
      render();
    } catch (error) { alert(error.message); e.target.disabled = false; e.target.textContent = "📍 Confirmar mi ubicación GPS"; }
    return;
  }
  const trackDelivery = e.target.closest("[data-track-delivery]");
  if (trackDelivery) { const id=trackDelivery.dataset.trackDelivery; if(STATE.view!=="live-order"){STATE.deliveryTrackOrder=id;STATE.deliveryTrack=null;trackFunnel("live_order_view");go("live-order");} await loadDeliveryTrack(id); return; }
  const ratingChoice = e.target.closest("[data-rating-choice]");
  if (ratingChoice) {
    STATE.deliveryRating[ratingChoice.dataset.order] = Number(ratingChoice.dataset.ratingChoice);
    const note = document.getElementById("deliveryRatingNote-"+ratingChoice.dataset.order)?.value || "";
    render();
    const field = document.getElementById("deliveryRatingNote-"+ratingChoice.dataset.order); if (field) field.value = note;
    return;
  }
  const ratingSubmit = e.target.closest("[data-rating-submit]");
  if (ratingSubmit) {
    const orderId = ratingSubmit.dataset.ratingSubmit, score = Number(STATE.deliveryRating[orderId] || 0);
    if (!score) return;
    ratingSubmit.disabled = true;
    try { const note=document.getElementById("deliveryRatingNote-"+orderId)?.value || ""; const saved=await deliveryApi("/api/delivery/rating", { method: "POST", body: JSON.stringify({ orderId, score, note }) }); delete STATE.deliveryRating[orderId]; STATE.deliveryTrackCache[orderId]={...(STATE.deliveryTrackCache[orderId]||{}),status:"delivered",rating:saved.rating}; Store.patch((d)=>{const o=(d.orders||[]).find((x)=>x.id===orderId);if(o)o.deliveryRating=saved.rating;}); await loadDeliveryTrack(orderId); }
    catch (error) { alert(error.message); ratingSubmit.disabled = false; }
    return;
  }
  const driverAction = e.target.closest("[data-driver-action]");
  if (driverAction) {
    const [action, driverId] = driverAction.dataset.driverAction.split(":");
    let reason = "";
    if (action === "reject") { reason = prompt("Motivo del rechazo que verá el repartidor:") || ""; if (!reason) return; }
    if (!confirm(action === "approve" ? "¿Aprobar este repartidor después de revisar sus documentos?" : action === "suspend" ? "¿Suspender el acceso de este repartidor?" : "¿Rechazar esta solicitud?")) return;
    driverAction.disabled = true;
    try { await deliveryApi("/api/delivery/admin", { method: "POST", body: JSON.stringify({ action, driverId, reason }) }); await loadDeliveryAdmin(); }
    catch (error) { alert(error.message); driverAction.disabled = false; }
    return;
  }
  const driverPhoto = e.target.closest("[data-driver-photo]");
  if (driverPhoto) {
    driverPhoto.disabled = true;
    try { await deliveryApi("/api/delivery/admin", {method:"POST",body:JSON.stringify({action:"photo_requirement",driverId:driverPhoto.dataset.driverPhoto,required:driverPhoto.checked})}); await loadDeliveryAdmin(); }
    catch(error) { driverPhoto.checked=!driverPhoto.checked; driverPhoto.disabled=false; alert(error.message); }
    return;
  }
  const deliveryProof = e.target.closest("[data-delivery-proof]");
  if (deliveryProof) {
    deliveryProof.disabled=true;
    try { const token=await AuthBridge.idToken(); const res=await fetch(`/api/delivery/proof/${encodeURIComponent(deliveryProof.dataset.deliveryProof)}`,{headers:{Authorization:"Bearer "+token}}); if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||"Foto no disponible.");} const url=URL.createObjectURL(await res.blob()); const w=window.open(url,"_blank","noopener"); if(!w)alert("Permite ventanas emergentes para ver la foto."); setTimeout(()=>URL.revokeObjectURL(url),60000); }
    catch(error){alert(error.message);} finally{deliveryProof.disabled=false;}
    return;
  }
  const driverDoc = e.target.closest("[data-driver-doc]");
  if (driverDoc) {
    const [driverId, kind] = driverDoc.dataset.driverDoc.split(":"); driverDoc.disabled = true;
    try {
      const token = await AuthBridge.idToken();
      const res = await fetch(`/api/delivery/document/${encodeURIComponent(driverId)}/${encodeURIComponent(kind)}`, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Documento no disponible."); }
      const url = URL.createObjectURL(await res.blob()); const w = window.open(url, "_blank", "noopener"); if (!w) alert("Permite ventanas emergentes para ver el documento."); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { alert(error.message); }
    finally { driverDoc.disabled = false; }
    return;
  }
  if (e.target.id === "notifyLater") {
    try { sessionStorage.setItem("chingadazo_notify_later", "1"); } catch {}
    const bar = document.getElementById("notifyAsk");
    if (bar) bar.remove();
    return;
  }
  const tourStart = e.target.closest("[data-tour-start]");
  if (tourStart) { STATE.tourStep = 0; render(); return; }
  const tourSkip = e.target.closest("[data-tour-skip]");
  if (tourSkip) { finishCustomerTour(); return; }
  const tourNext = e.target.closest("[data-tour-next]");
  if (tourNext) {
    if (STATE.tourStep >= CUSTOMER_TOUR.length - 1) { finishCustomerTour(); go("menu"); return; }
    STATE.tourStep += 1;
    if (STATE.tourStep >= 1) STATE.view = "menu";
    render();
    if (STATE.tourStep === 2) setTimeout(() => {
      const rail = document.getElementById("categoryRail");
      if (rail) rail.scrollTo({ left: Math.min(rail.scrollWidth, rail.clientWidth * .8), behavior: "smooth" });
    }, 250);
    return;
  }
  const catScroll = e.target.closest("[data-cat-scroll]");
  if (catScroll) {
    const rail = document.getElementById("categoryRail");
    if (rail) rail.scrollBy({ left: Number(catScroll.dataset.catScroll) * Math.max(180, rail.clientWidth * .72), behavior: "smooth" });
    return;
  }
  if (e.target.id === "pickPhoto") {
    STATE.pickingPhoto = true;
    const inp = $("#imgFile");
    if (inp) inp.click();
    return;
  }
  if (e.target.id === "saveProduct" || e.target.id === "saveProduct2") {
    await saveProductFromForm();
    return;
  }
  if (e.target.id === "publishPhotos") {
    (async () => {
      const list = Store.get().products || [];
      let n = 0;
      for (const p of list) {
        if (p && (p.image || "").startsWith("data:") && Cloud.pushProduct) {
          const ok = await Cloud.pushProduct(p);
          if (ok) n += 1;
        }
      }
      alert(n ? ("Fotos publicadas: " + n + ". Abre el otro aparato y recarga.") : "No hay fotos nuevas en este teléfono para publicar. Elige la foto otra vez y guarda.");
    })();
    return;
  }
  if (e.target.id === "pickCover") {
    const inp = $("#coverFile");
    if (inp) inp.click();
    return;
  }
  if (e.target.id === "unlockSound") {
    Alarm.unlock();
    if ("Notification" in window) Notification.requestPermission();
    alert("Sonido de cocina activado. Deja esta pantalla abierta.");
    return;
  }
  if (e.target.id === "toggleCajaGuide") { STATE.cajaGuide = !STATE.cajaGuide; render(); return; }
  const goBtn = e.target.closest("[data-go]");
  if (goBtn) { e.preventDefault(); if (goBtn.dataset.go === "checkout") requireAuth("checkout"); else go(goBtn.dataset.go); }

  if (STATE.view === "caja" && e.target.closest(".pos-item, .pos-fam, [data-pos-ch], [data-pos-pay], [data-pos-rem], #posSell, #posSellAlternate, #posHold, #posClear, [data-hold-open], [data-pay]")) posTick();
  if (e.target.id === "cropOk") { commitCrop(); return; }
  if (e.target.id === "cropCancel" || e.target.id === "cropBg") {
    if (STATE.crop) URL.revokeObjectURL(STATE.crop.url);
    STATE.crop = null;
    $("#modal").classList.add("hidden");
    $("#modal").innerHTML = "";
    return;
  }
  const posCat = e.target.closest("[data-pos-cat]");
  if (posCat) { STATE.posCat = posCat.dataset.posCat; render(); }
  const posCh = e.target.closest("[data-pos-ch]");
  if (posCh) { STATE.posChannel = posCh.dataset.posCh; render(); }
  const posPayB = e.target.closest("[data-pos-pay]");
  if (posPayB) { STATE.posPay = posPayB.dataset.posPay; render(); }
  const posProd = e.target.closest("[data-pos-prod]");
  if (posProd) {
    const p = productById(posProd.dataset.posProd);
    if (p && (!p.modifiers || !p.modifiers.length)) {
      STATE.posTicket.push({ key: Store.uid("ci"), productId: p.id, name: p.name, qty: 1, unit: p.price, modsText: "", note: "" });
      render();
    } else if (p) { STATE.posMode = true; openProduct(p.id); }
  }
  const posRem = e.target.closest("[data-pos-rem]");
  if (posRem) { STATE.posTicket = STATE.posTicket.filter((i) => i.key !== posRem.dataset.posRem); render(); }
  if (e.target.id === "posSell") sellPosTicket(autoPrintEnabled());
  if (e.target.id === "posSellAlternate") sellPosTicket(!autoPrintEnabled());
  const collectBtn = e.target.closest("[data-collect]");
  if (collectBtn) {
    collectBtn.disabled = true;
    await collectPendingOrder(collectBtn.dataset.collect,undefined,collectBtn.dataset.printChoice!=="no");
    if (document.body.contains(collectBtn)) collectBtn.disabled = false;
    return;
  }
  const collectPay = e.target.closest("[data-collect-pay]");
  if (collectPay) {
    const [id, pay] = collectPay.dataset.collectPay.split(":");
    collectPay.disabled = true;
    await collectPendingOrder(id, pay);
    return;
  }
  if (e.target.id === "posHold") {if(window.DiningCash)window.DiningCash.hold();else holdCurrentTicket();}
  if (e.target.id === "posClear") { STATE.posTicket = []; STATE.posName = ""; STATE.posPayWith = ""; render(); }
  const holdOpen = e.target.closest("[data-hold-open]");
  if (holdOpen) resumeHold(holdOpen.dataset.holdOpen);
  const holdDel = e.target.closest("[data-hold-del]");
  if (holdDel) dropHold(holdDel.dataset.holdDel);

  const cat = e.target.closest("[data-cat]");
  if (cat) { STATE.cat = cat.dataset.cat; STATE.menuSearch = ""; STATE.view = "menu"; render(); }

  const clearMenuSearch = e.target.closest("[data-clear-menu-search]");
  if (clearMenuSearch) { STATE.menuSearch = ""; render(); document.getElementById("menuSearch")?.focus(); return; }

  const prod = e.target.closest("[data-product]");
  if (prod) openProduct(prod.dataset.product);

  if (e.target.id === "modalBg" || e.target.id === "closeProduct" || e.target.id === "closeProduct2") {
    closeModal();
    return;
  }
  if (e.target.id === "qtyMinus") { STATE.qty = Math.max(1, STATE.qty - 1); renderModal(); }
  if (e.target.id === "qtyPlus") { STATE.qty += 1; renderModal(); }
  if (e.target.id === "addCart") await addCurrentToCart();

  const q = e.target.closest("[data-qty]");
  if (q) {
    const item = STATE.cart.find((i) => i.key === q.dataset.qty);
    if (item) { item.qty = Math.max(1, item.qty + Number(q.dataset.d)); saveCart(); render(); }
  }
  const rem = e.target.closest("[data-rem]");
  if (rem) { STATE.cart = STATE.cart.filter((i) => i.key !== rem.dataset.rem); saveCart(); render(); }
  if (e.target.id === "clearCart") { STATE.cart = []; saveCart(); render(); }

  if (e.target.id === "logout") {
    if (STATE.posSending) { alert('Espera a que termine el intento de cobro antes de salir.'); return; }
    if (localAccount) {
      syncLocalAccount(); await localWork;
      if (!localSignature && STATE.posTicket.length) { alert('No se confirmó el guardado. No cierres la sesión hasta resolver el error.'); return; }
    }
    const active = currentUser();
    PrivateSession.clear();
    Store.patch((d) => { d.session = null; });
    try { localStorage.removeItem("chingadazo_session_id"); sessionStorage.removeItem("chingadazo_session_id"); } catch {}
    if (window.AuthBridge) await AuthBridge.signOut().catch(() => {});
    PrivateSession.clear();
    go("home");
  }
  if (e.target.id === "switchStaff") {
    if (STATE.posSending) { alert('Espera la confirmación del intento de cobro antes de cambiar de usuario.'); return; }
    if (localAccount) {
      syncLocalAccount(); await localWork;
      if (!localSignature && STATE.posTicket.length) { alert('No se confirmó el guardado. No cambies de usuario hasta resolver el error.'); return; }
    }
    PrivateSession.clear();
    Store.patch((d) => { d.session = null; });
    try { localStorage.removeItem("chingadazo_session_id"); sessionStorage.removeItem("chingadazo_session_id"); } catch {}
    if (window.AuthBridge) { try { await AuthBridge.signOut(); } catch {} }
    PrivateSession.clear();
    STATE.staffDirectory=null;
    STATE.staffSelected="";
    STATE.staffPin="";
    Alarm.sync();
    go("staff-access");
    return;
  }
  const calDay = e.target.closest("[data-cal-day]");
  if (calDay) { STATE.calDay = calDay.dataset.calDay; STATE.salesFrom=STATE.salesTo=STATE.calDay; render(); return; }
  const calNav = e.target.closest("[data-cal-nav]");
  if (calNav) {
    const nowP = hnParts();
    let y = STATE.calY || nowP.y;
    let m = STATE.calM != null ? STATE.calM : (nowP.m - 1);
    m += Number(calNav.dataset.calNav);
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    STATE.calY = y; STATE.calM = m;
    render();
    return;
  }
  const orderCalDay = e.target.closest("[data-order-cal-day]");
  if (orderCalDay) { STATE.orderCalDay = orderCalDay.dataset.orderCalDay; render(); return; }
  const orderCalNav = e.target.closest("[data-order-cal-nav]");
  if (orderCalNav) {
    const nowP = hnParts();
    let y = STATE.orderCalY || nowP.y;
    let m = STATE.orderCalM != null ? STATE.orderCalM : (nowP.m - 1);
    m += Number(orderCalNav.dataset.orderCalNav);
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    STATE.orderCalY = y; STATE.orderCalM = m;
    STATE.orderCalDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    render();
    return;
  }
  if (e.target.closest("[data-manager-reload]")) {
    STATE.managerData = null;
    await loadManagerData(true);
    return;
  }
  if (e.target.closest("[data-add-purchase-row]")) {
    const box = document.getElementById("managerPurchaseItems"), first = box?.querySelector(".purchase-item-row");
    if (box && first && box.children.length < 40) {
      const next = first.cloneNode(true); next.querySelectorAll("input").forEach((input) => { input.value = ""; }); next.querySelectorAll("select").forEach((select) => { select.value = ""; }); box.appendChild(next);
    }
    return;
  }
  const removePurchaseRow = e.target.closest("[data-remove-purchase-row]");
  if (removePurchaseRow) {
    const box = document.getElementById("managerPurchaseItems"), row = removePurchaseRow.closest(".purchase-item-row");
    if (box && row && box.children.length > 1) row.remove();
    return;
  }
  if (e.target.closest("[data-manager-day]")) {
    STATE.managerDay = String(document.getElementById("managerDay")?.value || "");
    STATE.managerData = null;
    await loadManagerData(true);
    return;
  }
  if (e.target.closest('[data-backup-status]')) { await updateBackupPanel(false); return; }
  if (e.target.closest('[data-backup-create]')) { await updateBackupPanel(true); return; }
  const managerDecision = e.target.closest("[data-manager-decision]");
  if (managerDecision) {
    const split = managerDecision.dataset.managerDecision.lastIndexOf(":");
    const id = managerDecision.dataset.managerDecision.slice(0, split), status = managerDecision.dataset.managerDecision.slice(split + 1);
    managerDecision.disabled = true;
    try {
      const result = await managerApi("/api/manager/decision", { method: "POST", body: JSON.stringify({ id, status }) });
      alert(result.message || "Decisión registrada."); STATE.managerData = null; await loadManagerData(true);
    } catch (error) { alert(error.message); managerDecision.disabled = false; }
    return;
  }
  const incidentAction = e.target.closest("[data-incident-action]");
  if (incidentAction) {
    const split = incidentAction.dataset.incidentAction.lastIndexOf(":");
    const id = incidentAction.dataset.incidentAction.slice(0, split), status = incidentAction.dataset.incidentAction.slice(split + 1);
    incidentAction.disabled = true;
    try { await managerApi("/api/manager/incident", { method: "POST", body: JSON.stringify({ id, status, resolution: "Marcado desde Estado del sistema." }) }); STATE.managerData = null; await loadManagerData(true); }
    catch (error) { alert(error.message); incidentAction.disabled = false; }
    return;
  }
  if (e.target.closest("#toggleOpen")) {
    Store.patch((d) => { d.settings.open = !d.settings.open; });
    publishSettings();
    render();
  }
  if(e.target.closest("#toggleDelivery")){
    const button=e.target.closest("#toggleDelivery"),next=Store.get().settings.deliveryEnabled===false;
    button.disabled=true;
    try{await setDeliveryAvailability(next);alert(next?"Delivery activado. Ya aparece a los clientes.":"Delivery pausado. Los clientes solamente verán Para llevar.");render();}
    catch(error){alert(error.message);button.disabled=false;}
    return;
  }
  if(e.target.closest("#useRawbt")){
    if(!canCash())return;
    try{window.ChingadazoPrinter.setTransport('rawbt');render();alert('RawBT seleccionado en este equipo. En RawBT establece USB Printer P como predeterminada. Ahora toca Imprimir prueba y luego Abrir RawBT en la bandeja.');}
    catch(error){alert(error.message);}return;
  }
  if(e.target.closest("#connectPrinter")){
    const button=e.target.closest("#connectPrinter");button.disabled=true;
    try{const info=await window.ChingadazoPrinter.connect();alert(`Impresora conectada: ${info.productName||"SunPOS 2070"}. La interfaz USB se liberó correctamente.`);}
    catch(error){reportClientIncident("printer",error.message||"No se pudo conectar",{area:"Impresora"});alert("No se pudo conectar: "+error.message);}
    finally{button.disabled=false;}
    return;
  }
  if(e.target.closest("#testPrinter")){
    const button=e.target.closest("#testPrinter");button.disabled=true;
    try{const result=await window.ChingadazoPrinter.print({id:"PRUEBA",code:"PRUEBA-IMPRESORA",createdAt:new Date().toISOString(),customerName:currentUser()?.name||"Personal",type:"pickup",items:[{name:"Prueba El Chingadazo",qty:1,unit:0}],total:0,payment:"Prueba"},"client",Store.get().settings);if(!result?.queued)alert("Prueba enviada. Comprueba el papel y el corte en la impresora.");}catch(error){reportClientIncident("printer",error.message||"Falló la prueba",{area:"Impresora"});alert("No se envió la prueba: "+error.message);}finally{button.disabled=false;}return;
  }
  if(e.target.closest("#setPreparationTime")){
    if(!canCash())return;
    const raw=prompt('Tiempo general de preparación, en minutos (1–240):',String(Store.get().settings.waitMin||25));
    if(raw===null)return;
    const minutes=Number(raw);
    if(!raw.trim()||!Number.isInteger(minutes)||minutes<1||minutes>240){alert('Ingresa un número entero entre 1 y 240 minutos.');return;}
    const button=e.target.closest('#setPreparationTime');button.disabled=true;
    try{
      const token=await AuthBridge.idToken();
      const res=await fetch('/api/operations/settings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'preparation',minutes})});
      const result=await res.json();if(!res.ok)throw new Error(result.error||'No se pudo guardar el tiempo.');
      Store.patch(d=>{d.settings.waitMin=result.waitMin;});render();
    }catch(error){alert(error.message);button.disabled=false;}
    return;
  }
  if(e.target.closest("#testDrawer")){
    if(!canAdmin())return;
    if(!confirm("¿Abrir la gaveta para comprobar la conexión?"))return;
    const button=e.target.closest("#testDrawer");button.disabled=true;
    try{const result=await window.ChingadazoPrinter.drawer();if(!result?.queued)alert("Se envió la orden de apertura a la gaveta. Comprueba si abrió.");}catch(error){reportClientIncident("printer",error.message||"Falló la prueba",{area:"Gaveta"});alert("No se abrió la gaveta: "+error.message);}finally{button.disabled=false;}return;
  }
  if(e.target.closest("#toggleAutoPrint")){
    window.ChingadazoPrinter.setAutomatic(!autoPrintEnabled());render();return;
  }
  if (e.target.closest("#toggleDouble")) {
    Store.patch((d) => { d.settings.doublePoints = !d.settings.doublePoints; });
    publishSettings();
    render();
  }
  const waitBtn = e.target.closest("[data-wait]");
  if (waitBtn) {
    Store.patch((d) => { d.settings.waitMin = Number(waitBtn.dataset.wait); });
    publishSettings();
    render();
  }
  const resendShift=e.target.closest("[data-resend-shift]");
  if(resendShift){
    resendShift.disabled=true;
    try{const token=await AuthBridge.idToken(),res=await fetch("/api/resend-shift-report",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({shiftId:resendShift.dataset.resendShift})}),payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(payload.error||"No se pudo reenviar.");Store.patch(d=>{const i=d.shifts.findIndex(s=>s.id===payload.shift.id);if(i>=0)d.shifts[i]=payload.shift;});alert(payload.email?.status==="sent"?"Cierre enviado correctamente.":"El cierre sigue pendiente: "+(payload.email?.error||"configura el correo"));render();}
    catch(error){alert(error.message);resendShift.disabled=false;}return;
  }
  const editMenu = e.target.closest("[data-edit-menu]");
  if (editMenu) {
    const p = productById(editMenu.dataset.editMenu);
    if (p) STATE.editProduct = { ...p };
    go("admin-products");
  }

  const foldEl = e.target.closest("details[data-fold]");
  if (foldEl && e.target.closest("summary")) {
    setTimeout(() => {
      STATE.fold = STATE.fold || {};
      STATE.fold[foldEl.dataset.fold] = foldEl.open;
    }, 0);
  }
  const st = e.target.closest("[data-status]");
  if (st) {
    const [id, status] = st.dataset.status.split(":");
    const order = (Store.get().orders || []).find((o) => o.id === id);
    if (order?.type === "delivery" && status === "camino" && !confirm("¿Confirmas que entregaste físicamente esta orden al repartidor asignado? Esto NO significa que el cliente ya la recibió.")) return;
    st.disabled = true;
    await applyOrderStatus(id, status);
  }
  const acc = e.target.closest("[data-accept]");
  if (acc) { acc.disabled = true; await applyOrderStatus(acc.dataset.accept, "preparacion"); }
  const pay = e.target.closest("[data-pay]");
  if (pay) { await collectPendingOrder(pay.dataset.pay); return; }
  const pk = e.target.closest("[data-print-k]");
  if (pk) {
    const o = Store.get().orders.find((x) => x.id === pk.dataset.printK);
    if (o) printTicket(o, "kitchen");
  }
  const pc = e.target.closest("[data-print-c]");
  if (pc) {
    const o = Store.get().orders.find((x) => x.id === pc.dataset.printC);
    if (o) printTicket(o, "client");
  }
  const wa = e.target.closest("[data-wa]");
  if (wa) {
    const o = Store.get().orders.find((x) => x.id === wa.dataset.wa);
    if (o) sendWhatsApp(o, true);
  }
  if (e.target.id === "waAgain" && STATE.lastOrder) sendWhatsApp(STATE.lastOrder, true);

  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const p = productById(edit.dataset.edit);
    if (p) {
      STATE.editProduct = { ...p };
      go("admin-products");
    }
  }
  if (e.target.id === "newProduct") {
    STATE.editProduct = { category: STATE.cat && STATE.cat !== "destacados" ? STATE.cat : "refrescos", available: true };
    STATE.fold = STATE.fold || {};
    STATE.fold.adminProduct = true;
    render();
  }
  const tog = e.target.closest("[data-tog]");
  if (tog) {
    Store.patch((d) => { const p = d.products.find((x) => x.id === tog.dataset.tog); if (p) p.available = !p.available; });
    render();
  }
  const poff = e.target.closest("[data-promo-off]");
  if (poff) {
    Store.patch((d) => {
      const p = (d.settings.promos || []).find((x) => x.id === poff.dataset.promoOff);
      if (p) p.active = !p.active;
    });
    publishSettings();
    render();
  }
  const pedit = e.target.closest("[data-promo-edit]");
  if (pedit) {
    STATE.editPromo = (Store.get().settings.promos || []).find((x) => x.id === pedit.dataset.promoEdit) || null;
    render();
    return;
  }
  if (e.target.id === "promoCancelEdit") {
    document.activeElement?.blur();
    STATE.editPromo = null;
    render();
    return;
  }
  const pdel = e.target.closest("[data-promo-del]");
  if (pdel && confirm("¿Eliminar esta promoción?")) {
    Store.patch((d) => {
      d.settings.promos = (d.settings.promos || []).filter((x) => x.id !== pdel.dataset.promoDel);
    });
    publishSettings();
    if (STATE.editPromo && STATE.editPromo.id === pdel.dataset.promoDel) STATE.editPromo = null;
    render();
  }
  const eye = e.target.closest("[data-toggle-pass]");
  if (eye) {
    const form = eye.closest("form");
    const inp = form && form.elements[eye.dataset.togglePass];
    if (inp) {
      inp.type = inp.type === "password" ? "text" : "password";
      eye.textContent = inp.type === "password" ? "👁" : "🙈";
    }
    return;
  }
  const crmu = e.target.closest("[data-crm-user]");
  if (crmu) { STATE.crmUser = crmu.dataset.crmUser; go("admin-crm"); }
  const del = e.target.closest("[data-del]");
  if (del && confirm("¿Borrar este producto?")) {
    Store.patch((d) => { d.products = d.products.filter((x) => x.id !== del.dataset.del); });
    render();
  }
  if (e.target.id === "resetDemo") {
    if (canAdmin()) {
      await resetTestSales();
    }
  }
});

document.addEventListener("change", (e) => {
  if(e.target.matches("[data-staff-photo]")){
    const input=e.target,file=input.files?.[0];if(!file)return;
    (async()=>{try{const photoURL=await staffAvatarFile(file),token=await AuthBridge.idToken(),res=await fetch("/api/staff-photo",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({userId:input.dataset.staffPhoto,photoURL})}),payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(payload.error||"No se pudo guardar la foto.");Store.patch(d=>{const i=d.users.findIndex(u=>u.id===payload.profile.id);if(i>=0)d.users[i]=payload.profile;});alert("Foto del empleado guardada.");render();}catch(error){alert(error.message);}})();return;
  }
  if (e.target.id === "deliveryZone") {
    STATE.checkoutDeliveryZone = e.target.value === "route" ? "route" : "altos-chingadazo";
    STATE.checkoutDeliveryQuote = null;
    const form=e.target.form, box=document.getElementById("deliveryQuote");
    if(box) box.innerHTML=STATE.checkoutDeliveryZone==="altos-chingadazo"?`<b>Tarifa fija ${money(Store.get().settings.deliveryFixedZoneFee ?? 35)}</b><span>Para direcciones dentro de Zona por configurar</span>`:`<b>Ruta real de Google Maps</b><span>Confirma tu ubicación para calcular kilómetros por carretera</span>`;
    if(STATE.checkoutLocation) requestDeliveryQuote(form).then(q=>{if(box)box.innerHTML=`<b>${q.pricingMode==="fixed_zone"?"Tarifa fija":"Envío por ruta"} ${money(q.fee)}</b><span>${q.distanceKm?`Ruta ${Number(q.distanceKm).toFixed(1)} km · `:""}ETA ${q.etaMin||"—"} min</span>`}).catch(error=>alert(error.message));
    return;
  }
  if (e.target.id === "payMethod" || e.target.id === "needsChange") {
    const method = $("#payMethod")?.value;
    const cash = $("#cashExtra");
    const wrap = $("#payWithWrap");
    if (cash) cash.style.display = method === "Efectivo" ? "" : "none";
    if (wrap) wrap.classList.toggle("hidden", $("#needsChange")?.value !== "si");
  }
  if (STATE.product && e.target.closest(".sheet")) {
    const p = STATE.product;
    (p.modifiers || []).forEach((g) => {
      if (g.multi) {
        STATE.mods[g.id] = $$(`input[name="${g.id}"]:checked`).map((i) => i.value);
      } else {
        const el = $(`input[name="${g.id}"]:checked`);
        if (el) STATE.mods[g.id] = el.value;
      }
    });
    renderModal();
  }
  if (e.target.id === "itemNote") STATE.note = e.target.value;
  if (e.target.id === "imgFile") {
    STATE.pickingPhoto = false;
    if (e.target.files[0]) openCrop("product", e.target.files[0]);
  }
  if (e.target.id === "coverFile" && e.target.files[0]) openCrop("cover", e.target.files[0]);
  if (e.target.id === "logoFile" && e.target.files[0]) openCrop("logo", e.target.files[0]);
});

document.addEventListener("input", (e) => {
  if (e.target.id === "menuSearch") {
    STATE.menuSearch = e.target.value;
    const query = String(e.target.value || "").trim().toLowerCase();
    const cards = [...document.querySelectorAll("#menuProductGrid [data-menu-item]")];
    let count = 0;
    cards.forEach(card => {
      const matches = query ? String(card.dataset.menuItem || "").includes(query) : (STATE.cat === "destacados" ? card.querySelector(".tag") !== null : card.dataset.menuCategory === STATE.cat);
      card.classList.toggle("menu-filtered", !matches);
      if (matches) count += 1;
    });
    const result = document.getElementById("menuResultCount");
    if (result) result.textContent = `${count} ${count === 1 ? "producto" : "productos"}`;
    const empty = document.getElementById("menuEmpty");
    if (empty) empty.classList.toggle("menu-filtered", count > 0);
    return;
  }
  const deliveryForm = e.target.closest && e.target.closest("#deliverySettingsForm");
  if (deliveryForm) captureDeliverySettingsDraft(deliveryForm);
  const form = e.target.closest && e.target.closest("#productForm");
  if (form) {
    STATE.editLock = true;
    window.__chingadazoEditLock = true;
    if (!STATE.editProduct) STATE.editProduct = {};
    const n = e.target.name;
    if (n === "name" || n === "description" || n === "price" || n === "category") {
      STATE.editProduct[n] = e.target.value;
    }
    if (n === "featured" || n === "available") STATE.editProduct[n] = e.target.checked;
  }
  if (e.target.id === "itemNote") STATE.note = e.target.value;
  if (e.target.id === "posName") { STATE.posName = e.target.value; syncLocalAccount(); }
  if (e.target.id === "deliveryTip") STATE.checkoutTip = Number(e.target.value || 0);
  if (e.target.id === "posPayWith") { STATE.posPayWith = e.target.value; STATE.posChange = Number(e.target.value || 0) > posSubtotal(); updatePosChangeLabel(); syncLocalAccount(); }
  if (e.target.id === "cropScale" && STATE.crop) {
    STATE.crop.scale = Number(e.target.value || 100);
    const img = $("#cropPrev");
    if (img) img.style.transform = "scale(" + (STATE.crop.scale / 100) + ")";
  }
  if (e.target.id === "logoSize") {
    const n = Number(e.target.value || 48);
    const img = e.target.parentElement.querySelector("img");
    if (img) { img.style.width = n + "px"; img.style.height = n + "px"; }
  }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "managerAskForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    STATE.managerAnswer = ""; STATE.managerError = "";
    try {
      const result = await managerApi("/api/manager/ask", { method: "POST", body: JSON.stringify({ question: form.question.value.trim(), day: STATE.managerDay }) });
      STATE.managerAnswer = result.answer || ""; render();
    } catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "managerSupplierForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { await managerApi("/api/manager/costs", { method: "POST", body: JSON.stringify({ action: "supplier_save", name: form.name.value, phone: form.phone.value, email: form.email.value, notes: form.notes.value }) }); form.reset(); STATE.managerData = null; await loadManagerData(true); alert("Proveedor guardado."); }
    catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "managerIngredientForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { await managerApi("/api/manager/costs", { method: "POST", body: JSON.stringify({ action: "ingredient_save", name: form.name.value, purchaseUnit: form.purchaseUnit.value, consumptionUnit: form.consumptionUnit.value, conversion: Number(form.conversion.value), currentCost: Number(form.currentCost.value), currentQty: Number(form.currentQty.value), minimumQty: Number(form.minimumQty.value), supplierId: form.supplierId.value }) }); form.reset(); STATE.managerData = null; await loadManagerData(true); alert("Ingrediente guardado."); }
    catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "managerPurchaseForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    const items = [...form.querySelectorAll(".purchase-item-row")].map((row) => ({ ingredientId: row.querySelector("[data-purchase-ingredient]")?.value || "", qty: Number(row.querySelector("[data-purchase-qty]")?.value), unitCost: Number(row.querySelector("[data-purchase-cost]")?.value) })).filter((row) => row.ingredientId && row.qty > 0);
    try { await managerApi("/api/manager/costs", { method: "POST", body: JSON.stringify({ action: "purchase_save", supplierId: form.supplierId.value, invoice: form.invoice.value, items, tax: Number(form.tax.value), transport: Number(form.transport.value), discount: Number(form.discount.value) }) }); form.reset(); STATE.managerData = null; await loadManagerData(true); alert("Compra confirmada e inventario actualizado."); }
    catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "managerRecipeForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    const product = (Store.get().products || []).find((row) => row.id === form.productId.value);
    const ingredients = [...form.querySelectorAll("[data-recipe-qty]")].map((input) => ({ ingredientId: input.dataset.recipeQty, qty: Number(input.value) })).filter((row) => row.qty > 0);
    try { await managerApi("/api/manager/costs", { method: "POST", body: JSON.stringify({ action: "recipe_save", productId: form.productId.value, name: form.name.value || product?.name || "Receta", yieldQty: Number(form.yieldQty.value), ingredients, packagingCost: Number(form.packagingCost.value), otherCost: Number(form.otherCost.value) }) }); form.reset(); STATE.managerData = null; await loadManagerData(true); alert("Receta y costo por porción guardados."); }
    catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "managerMovementForm") {
    const form = e.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { await managerApi("/api/manager/costs", { method: "POST", body: JSON.stringify({ action: form.action.value, ingredientId: form.ingredientId.value, qty: Number(form.qty.value), reason: form.reason.value }) }); form.reset(); STATE.managerData = null; await loadManagerData(true); alert("Movimiento de inventario registrado."); }
    catch (error) { alert(error.message); button.disabled = false; }
    return;
  }
  if (e.target.id === "customerSearchForm") {
    STATE.menuSearch = String(e.target.elements.search?.value || "").trim();
    STATE.view = "menu";
    render();
    return;
  }
  if(e.target.id==="familyJoinForm"){
    const code=String(e.target.code.value||"").replace(/\D/g,"");
    try{const room=await familyApi({action:"join",code});STATE.familyRoom=room;STATE.familyCode=room.code;localStorage.setItem("chingadazo_family_code",room.code);trackFunnel("family_join");render();}catch(error){alert(error.message);}return;
  }
  if(e.target.id==="payerGameJoinForm"){
    const code=String(e.target.code.value||"").replace(/\D/g,"");
    try{const game=await payerGameApi({action:"join",code});STATE.payerGame=game;STATE.payerGameCode=game.code;localStorage.setItem("chingadazo_payer_game_code",game.code);trackFunnel("payer_game_join");render();}catch(error){alert(error.message);}return;
  }
  if(e.target.id==="chupisticaJoinForm"){
    const code=String(e.target.code.value||"").replace(/\D/g,"");
    try{const game=await chupisticaApi({action:"join",code});STATE.chupisticaGame=game;STATE.chupisticaCode=game.code;localStorage.setItem("chingadazo_chupistica_code",game.code);trackFunnel("chupistica_join");render();}catch(error){alert(error.message);}return;
  }
  if (e.target.id === "deliverySettingsForm") {
    const f = e.target, btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await deliveryApi("/api/delivery/admin", { method: "POST", body: JSON.stringify({ action: "settings", restaurantAddress: f.restaurantAddress.value.trim(), lat: Number(f.lat.value), lng: Number(f.lng.value), driverPayBase: Number(f.driverPayBase.value), driverPayPerKm: Number(f.driverPayPerKm.value), driverPayFallback: Number(f.driverPayFallback.value), deliveryFixedZoneEnabled: f.deliveryFixedZoneEnabled.checked, deliveryFixedZoneName: f.deliveryFixedZoneName.value.trim(), deliveryFixedZoneFee: Number(f.deliveryFixedZoneFee.value), deliveryCustomerFee1: Number(f.deliveryCustomerFee1.value), deliveryCustomerFee3: Number(f.deliveryCustomerFee3.value), deliveryCustomerFee65: Number(f.deliveryCustomerFee65.value), deliveryCustomerFee8: Number(f.deliveryCustomerFee8.value), deliveryCustomerMaxKm: Number(f.deliveryCustomerMaxKm.value), deliveryNationwideTestEnabled: f.deliveryNationwideTestEnabled.checked, blockedDeliveryZones: f.blockedDeliveryZones.value.trim() }) });
      STATE.deliverySettingsDraft = null;
      await loadDeliveryAdmin(); alert("Configuración de delivery guardada.");
    } catch (error) { alert(error.message); btn.disabled = false; }
    return;
  }
  if (e.target.id === "loginForm") {
    const id = e.target.elements.loginId.value;
    const pw = e.target.elements.password.value;
    const tryLogin = async () => {
      if (!await secureLogin(id, pw)) alert("Datos incorrectos. Si eres cliente nuevo, regístrate o recupera la clave.");
    };
    if (window.Cloud) Cloud.sync().then(tryLogin).catch(tryLogin);
    else tryLogin();
  }
  if (e.target.id === "pinLoginForm") {
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try { await staffPinLogin(e.target.pin.value); }
    finally { if (btn) btn.disabled = false; }
  }
  if (e.target.id === "staffAuthorizeForm") {
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try { await authorizeStaffDevice(e.target.email.value, e.target.password.value); }
    catch (error) { alert(error.message || AuthBridge.message(error)); }
    finally { if (btn) btn.disabled = false; }
  }
  if (e.target.id === "recoverForm") {
    recoverPassword(e.target.email.value);
  }
  if (e.target.id === "registerForm") {
    const f = e.target;
    const submit = f.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await register({ name: f.name.value.trim(), dni: f.dni.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), password: f.password ? f.password.value : "", address: f.address.value.trim() });
    } finally {
      if (submit) submit.disabled = false;
    }
  }
  if (e.target.id === "staffForm") {
    const f = e.target;
    if(f.dataset.saving==='1')return;
    const field=name=>f.elements.namedItem(name);
    const pin = String(field('pin').value || "").trim(), role=field('role').value;
    if (!/^\d{6}$/.test(pin)) { alert("El PIN debe tener exactamente 6 números."); return; }
    f.dataset.saving='1';
    const btn = f.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const photoURL = await staffAvatarFile(field('photo')?.files?.[0]);
      const token = await AuthBridge.idToken();
      if (!token) throw new Error("Por seguridad, vuelve a entrar con tu usuario administrador.");
      const res = await fetch("/api/staff-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name: String(field('name').value || "").trim(), role, pin, photoURL })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo guardar el empleado.");
      Store.patch((d) => {
        const i = d.users.findIndex((u) => u.id === payload.profile.id);
        if (i >= 0) d.users[i] = payload.profile; else d.users.push(payload.profile);
      });
      alert("Usuario creado. Ya puede entrar con su PIN en un equipo autorizado.");
      f.reset(); render();
    } catch (error) { alert(error.message || "No se pudo guardar el empleado."); }
    finally { delete f.dataset.saving; if (btn) btn.disabled = false; }
  }
  if (e.target.matches("[data-staff-pin-form]")) {
    const f=e.target,pin=String(f.pin.value||"").trim(),userId=f.dataset.staffPinForm;
    if(!/^\d{6}$/.test(pin)){alert("El PIN debe tener exactamente 6 números.");return;}
    const btn=f.querySelector('button[type="submit"]');if(btn)btn.disabled=true;
    try{
      const token=await AuthBridge.idToken();
      if(!token)throw new Error("Vuelve a entrar como administrador con tu correo.");
      const res=await fetch("/api/staff-pin",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({userId,pin})});
      const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(payload.error||"No se pudo guardar el PIN.");
      alert("PIN actualizado. "+(payload.profile?.name||"El empleado")+" ya puede entrar.");f.reset();
    }catch(error){alert(error.message||"No se pudo guardar el PIN.");}
    finally{if(btn)btn.disabled=false;}
    return;
  }
  if (e.target.id === "openShiftForm") {
    try { await openMyShift(Number(e.target.fondo.value || 0)); } catch(error) {alert(error.message);return;}
    alert("Turno abierto.");
    go("caja");
  }
  if (e.target.id === "closeShiftForm") {
    const counted = Number(e.target.counted.value || 0);
    const note = e.target.note.value.trim();
    const s = myOpenShift();
    const exp = s ? shiftTotals(s).expected : 0;
    let result;
    try { result=await closeMyShift(counted, note); } catch(error) {await Cloud.sync();alert(error.message);return;}
    const emailText=result?.email?.status==="sent"?"\nReporte enviado a .":"\nEl cierre quedó guardado, pero el correo está pendiente de configuración o reintento.";
    const savedShift=result?.shift||{},serverExpected=Number(savedShift.expected??exp),serverDiff=Number(savedShift.diff??(counted-serverExpected));
    alert("Corte listo. Esperado " + money(serverExpected) + " · contado " + money(counted) + " · diferencia " + money(serverDiff)+emailText);
    STATE.staffDirectory=null;
    render();
  }
  if (e.target.id === "checkoutForm") placeOrder(e.target);
  if (e.target.id === "coverForm") {
    const f = e.target;
    Store.patch((d) => {
      d.settings.heroTitle = f.heroTitle.value.trim();
      d.settings.heroSubtitle = f.heroSubtitle.value.trim();
      if (f.heroImage.value.trim()) d.settings.heroImage = f.heroImage.value.trim();
      if (f.heroHeight) d.settings.heroHeight = Number(f.heroHeight.value || 210);
    });
    if (window.Cloud) Cloud.pushCatalog(Store.get());
    alert("Portada guardada. Ya se ve en Inicio.");
    go("home");
  }
  if (e.target.id === "catForm") {
    const name = e.target.name.value.trim();
    if (!name) return;
    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || Store.uid("cat");
    Store.patch((d) => {
      d.categories = d.categories || [];
      if (!d.categories.some((c) => c.id === id)) d.categories.push({ id, name, icon: e.target.icon.value.trim() || "•" });
    });
    if (window.Cloud) Cloud.pushCategories(Store.get().categories);
    e.target.reset();
    render();
  }
  if (e.target.id === "productForm") {
    await saveProductFromForm();
  }
  if (e.target.id === "settingsForm") {
    const f = e.target;
    const fields = f.elements;
    const weeklyHours=Object.fromEntries(Array.from({length:7},(_,i)=>[i,{closed:f.elements['dayClosed'+i].checked,open:f.elements['dayOpen'+i].value,close:f.elements['dayClose'+i].value}]));
    if (!ChingadazoHours.validate(weeklyHours)) { alert('Revisa los horarios: apertura y cierre deben ser distintos.'); return; }
    Store.patch((d) => {
      Object.assign(d.settings, {
        name: fields.namedItem('name').value, phone: fields.namedItem('phone').value, whatsapp: fields.namedItem('whatsapp').value,
        address: fields.namedItem('address').value, hours: fields.namedItem('hours').value,
        weeklyHours,
        shiftReportEmail: fields.namedItem('shiftReportEmail').value.trim(),
        taxRate: Number(fields.namedItem('taxRate').value), deliveryFee: Number(fields.namedItem('deliveryFee').value),
        minOrder: Number(fields.namedItem('minOrder').value),
        open: fields.namedItem('open').checked, soundOn: fields.namedItem('soundOn').checked, autoWhatsApp: fields.namedItem('autoWhatsApp').checked,
        logoImage: fields.namedItem('logoImage').value,
        logoSize: Number(fields.namedItem('logoSize').value),
        chingadazoAiEnabled: fields.namedItem('chingadazoAiEnabled').checked,
        foodProfileEnabled: fields.namedItem('foodProfileEnabled').checked,
        familyOrderEnabled: fields.namedItem('familyOrderEnabled').checked,
        spicyCopyEnabled: fields.namedItem('spicyCopyEnabled').checked,
        deliveryCodeRequired: fields.namedItem('deliveryCodeRequired').checked
      });
    });
    const saved=await publishSettings();
    if(!saved){alert('No se pudieron guardar los ajustes en el servidor. Revisa la conexión y vuelve a guardar.');return;}
    alert("Ajustes guardados");
    go("admin");
  }
  if (["promoForm", "blastForm", "welcomeBonusForm"].includes(e.target.getAttribute("id"))) {
    const form = e.target;
    const kind = form.getAttribute("id") === "promoForm" ? "promo" : form.getAttribute("id") === "blastForm" ? "blast" : "bonus";
    const value = name => form.elements.namedItem(name)?.value || "";
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const token = await AuthBridge.idToken();
      if (!token) throw new Error("Vuelve a entrar con tu PIN de administrador.");
      const res = await fetch("/api/admin-promotion", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ kind, id: value("promoId"), title: value("title"), body: value("body"), hours: value("hours"), value: Number(value("bonus")) })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No se guardó el cambio.");
      Store.patch(d => {
        if (kind === "bonus") { d.settings.welcomeBonus = result.value; return; }
        const key = kind === "promo" ? "promos" : "blasts";
        const list = d.settings[key] || [];
        const i = list.findIndex(x => x.id === result.entry.id);
        if (i < 0) list.push(result.entry); else list[i] = result.entry;
        d.settings[key] = list;
      });
      STATE.editPromo = null;
      document.activeElement?.blur();
      const pushInfo=result.push;
      const blastMessage=pushInfo && Number(pushInfo.sent)>0
        ? `Aviso enviado por push a ${pushInfo.sent} dispositivo${Number(pushInfo.sent)===1?"":"s"}.`
        : pushInfo && Number(pushInfo.attempted)===0
          ? "Aviso guardado, pero no hay dispositivos suscritos todavía. Cada usuario debe activar las notificaciones una vez."
          : "Aviso guardado, pero el servidor no confirmó su entrega. Revisa la prueba push del dispositivo.";
      alert(kind === "promo" ? "Promoción guardada. No se envió un aviso adicional." : kind === "bonus" ? "Bono guardado para registros nuevos." : blastMessage);
      render();
    } catch (error) { alert(error.message || "No se pudo guardar. Tu texto sigue en el formulario."); }
    finally { btn.disabled = false; }
    return;
  }
});

window.addEventListener("storage", () => {
  if (STATE.editLock || STATE.view === "admin-products") return;
  checkNewOrders();
});

let checkingOrders = false;
async function checkNewOrders() {
  if (checkingOrders || document.hidden) return;
  const before = currentUser();
  const activeCustomerView = before?.role === "customer" && ["orders", "live-order", "success"].includes(STATE.view);
  if (!isStaff() && !activeCustomerView) return;
  checkingOrders = true;
  try {
  if (window.Cloud) {
    const m = Cloud.syncOrders ? await Cloud.syncOrders() : await Cloud.sync();
    backfillPoints();
    if (canKitchen()) Alarm.sync();
    announceStaffOrders(m?.newOnes || []);
    const editing = STATE.editLock || STATE.view === "admin-products" || STATE.view === "admin-cover";
    if (m?.changed && !editing) render();
  }
  const user = currentUser();
  if (user && user.role === "customer") {
    const blast = (Store.get().settings.blasts || []).slice(-1)[0];
    if (blast && blast.id && blast.id !== localStorage.getItem("chingadazo_blast")) {
      localStorage.setItem("chingadazo_blast", blast.id);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(blast.title || "El Chingadazo", { body: blast.body || "", icon: "assets/logo.jpg" });
      }
    }
  }
  if (user && canKitchen()) Alarm.sync();
  } finally {
    checkingOrders = false;
  }
}

function announceStaffOrders(orders) {
  if (!isStaff()) return;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("chingadazo_seen") || "[]"); } catch {}
  (orders || []).filter((o) => o && (o.status === "nuevo" || !o.status) && !seen.includes(o.id)).forEach((o) => {
    seen.push(o.id);
    notifyOwner(o);
  });
  try { localStorage.setItem("chingadazo_seen", JSON.stringify(seen.slice(-100))); } catch {}
}

window.addEventListener("chingadazo:orders-live", (e) => {
  const m = e.detail || {};
  announceStaffOrders(m.newOnes || []);
  if (isStaff()) Alarm.sync();
  const editing = STATE.editLock || STATE.view === "admin-products" || STATE.view === "admin-cover";
  if (m.changed && !editing) render();
});

const reportedIssues = new Set();
async function reportClientIncident(type, message, extra = {}) {
  try {
    const fingerprint = `${type}:${String(message).slice(0,160)}:${location.pathname}`;
    if (reportedIssues.has(fingerprint)) return;
    reportedIssues.add(fingerprint);
    const token = await AuthBridge.idToken();
    if (!token) return;
    await fetch("/api/manager/telemetry", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ type, message: String(message || "Error sin detalle"), area: isStaff() ? (currentUser()?.role || "Personal") : "Clientes", route: location.pathname + location.search, version: "111", ...extra }), keepalive: true });
  } catch { /* La telemetría nunca debe interrumpir Caja ni clientes. */ }
}
window.addEventListener("error", (event) => reportClientIncident("error", event.message || event.error?.message || "Error de interfaz"));
window.addEventListener("unhandledrejection", (event) => reportClientIncident("unhandledrejection", event.reason?.message || String(event.reason || "Promesa rechazada")));
window.addEventListener("load", () => {
  setTimeout(() => {
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const duration = Number(navigation?.duration || 0);
    if (duration > 8000) reportClientIncident("performance", `Carga inicial lenta: ${Math.round(duration)} ms`, { durationMs: duration });
  }, 1000);
});

// Las órdenes se mantienen ágiles sin saturar Android con solicitudes y
// reconstrucciones continuas de toda la aplicación.
setInterval(checkNewOrders, 3500);
setInterval(() => {
  if (document.hidden || !window.Cloud || STATE.editLock || STATE.view === "admin-products" || STATE.view === "admin-cover") return;
  Cloud.sync().then((m) => { if (m?.changed) render(); }).catch(() => {});
}, 30000);
setInterval(tickTimers, 1000);
setInterval(() => {
  if (["orders","live-order"].includes(STATE.view) && STATE.deliveryTrackOrder) loadDeliveryTrack(STATE.deliveryTrackOrder);
  if (STATE.view === "admin-delivery") loadDeliveryAdmin();
}, 10000);
setInterval(()=>{if(STATE.view==="payer-game"&&STATE.payerGameCode)loadPayerGame();},700);
setInterval(()=>{if(STATE.view==="chupistica"&&STATE.chupisticaCode)loadChupistica();},900);
setInterval(()=>{
  const timer=document.querySelector("[data-chupi-ends]");if(!timer)return;
  const serverAtRender=Date.parse(timer.dataset.chupiServer||0),received=Number(timer.dataset.chupiReceived||Date.now()),serverNow=serverAtRender+(Date.now()-received),seconds=Math.max(0,Math.ceil((Date.parse(timer.dataset.chupiEnds||0)-serverNow)/1000));
  timer.textContent=String(seconds);if(seconds===0)document.querySelectorAll("[data-chupi-answer]").forEach(button=>{button.disabled=true;});
},250);
setInterval(() => {
  if (document.hidden || STATE.editLock || STATE.view === "admin-products") return;
  pullLiveSettings();
}, 10000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if(STATE.view==="staff-access"){
    STATE.staffDirectory=null;
    loadStaffDirectory();
  }
  pullLiveSettings();
  checkNewOrders();
});
pullLiveSettings();
startSettingsStream();
if (window.Cloud) {
  Cloud.sync().then(async (m) => {
    backfillPoints();
    await refreshVerifiedBonus();
    if (!STATE.editLock) render();
  }).catch(() => {});
}
if ("BroadcastChannel" in window) {
  const live = new BroadcastChannel("chingadazo_live");
  live.onmessage = () => {
    if (STATE.editLock || STATE.view === "admin-products") return;
    if (STATE.view === "cocina" || STATE.view === "admin") checkNewOrders();
  };
}

if ("serviceWorker" in navigator) {
  appServiceWorker().then((reg) => {
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);
  }).catch(() => {});
}

window.addEventListener('beforeunload', event => {
  if (localAccount && (STATE.posSending || localSaving || (localReady && !localSignature && STATE.posTicket.length))) {
    event.preventDefault(); event.returnValue = '';
  }
});
for (const eventName of ['online','offline']) window.addEventListener(eventName, () => {
  if (!STAFF_DEVICE_MODE || !globalThis.ChingadazoContinuity) return;
  for (const id of ['posSell','posSellAlternate']) {
    const button = document.getElementById(id);
    if (button) button.disabled = navigator.onLine === false || !localReady || STATE.posSending || !STATE.posTicket.length;
  }
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt=event;
  if(!IS_STANDALONE && !STAFF_DEVICE_MODE) {
    STATE.installPromptVisible=true;
    render();
  }
});
window.addEventListener("appinstalled", () => {
  STATE.installPromptVisible=false;
  deferredInstallPrompt=null;
  try { localStorage.removeItem("chingadazo_install_later"); } catch {}
  render();
});

// A cached role never restores an authenticated session on its own.
PrivateSession.clear();
AuthBridge.current().then(async authUser => {
  if (!authUser) return;
  await Cloud.sync();
  const p=Store.get().users.find(u=>u.id==='auth-'+authUser.uid);
  if(p) {
    const staffProfile=["admin","cashier","kitchen"].includes(p.role);
    if((STAFF_DEVICE_MODE&&!staffProfile)||(!STAFF_DEVICE_MODE&&staffProfile)){
      await AuthBridge.signOut();
      PrivateSession.clear();
      Store.patch(d=>{d.session=null;});
      return;
    }
    if (p.role === 'customer' && !customerProfileComplete(p)) {
      STATE.googleAuth=authUser; STATE.view='register'; return;
    }
    window.__verifiedProfile=p; Store.patch(d=>{d.session=p.id;});
  }
}).catch(()=>{PrivateSession.clear();}).finally(()=>{appBooting=false;render();trackFunnel("visit");});
