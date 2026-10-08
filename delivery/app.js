(function () {
  const root = document.getElementById("deliveryApp");
  const DEMO_EMAIL = "repartidor.demo@el-chingadazo.invalid";
  const state = {
    auth: null,
    profile: null,
    available: [],
    mine: [],
    history: [],
    view: "login",
    editApplication: false,
    applicationBusy: false,
    selfie: null,
    stream: null,
    watch: null,
    watchOrderId: "",
    gpsMessage: "Esperando una lectura GPS reciente…",
    refresh: null,
    refreshBusy: false,
    demo: false,
    demoCompleted: false,
    soundEnabled: true,
    alarm: null,
    avatarUrl: "",
    selfiePreviewUrl: "",
    offersLoaded: false,
    emptyOfferPolls: 0,
    pushConfigured: null,
    lastDataSignature: "",
    proofUploading: "",
  };
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (n) => "L. " + Number(n || 0).toFixed(2);
  const notificationPermission = () =>
    "Notification" in window ? Notification.permission : "unsupported";
  const decodePolyline = (s) => {
    const out = [];
    let i = 0,
      lat = 0,
      lng = 0;
    while (i < (s || "").length) {
      for (const which of ["lat", "lng"]) {
        let b,
          shift = 0,
          result = 0;
        do {
          b = s.charCodeAt(i++) - 63;
          result |= (b & 31) << shift;
          shift += 5;
        } while (b >= 32);
        const d = result & 1 ? ~(result >> 1) : result >> 1;
        if (which === "lat") lat += d;
        else lng += d;
      }
      out.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return out;
  };
  const token = () => AuthBridge.idToken();
  async function api(path, options = {}) {
    const t = await token();
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.body instanceof Blob
          ? {}
          : { "Content-Type": "application/json" }),
        ...(t ? { Authorization: "Bearer " + t } : {}),
        ...(options.headers || {}),
      },
    });
    const data = (res.headers.get("content-type") || "").includes("json")
      ? await res.json()
      : null;
    if (!res.ok)
      throw new Error(data?.error || "No se pudo completar la operación.");
    return data;
  }

  function demoOffers() {
    return [
      {
        id: "demo-201",
        code: "TT-D201",
        zone: "Col. Palmira",
        total: 385,
        itemCount: 4,
        ready: true,
        status: "available",
        driverPay: 65,
        distanceKm: 4.8,
        pickupEtaMin: 7,
        deliveryEtaMin: 16,
        offeredAt: new Date().toISOString(),
      },
      {
        id: "demo-202",
        code: "TT-D202",
        zone: "Lomas del Guijarro",
        total: 240,
        itemCount: 2,
        ready: false,
        status: "available",
        driverPay: 52,
        distanceKm: 3.2,
        pickupEtaMin: 7,
        deliveryEtaMin: 12,
        offeredAt: new Date().toISOString(),
      },
    ];
  }
  function demoJob(offer) {
    return {
      ...offer,
      customerName: "Ana Martínez",
      phone: "9999-1234",
      address: "Colonia Palmira, avenida República de Panamá, casa 214",
      addressNotes: "Portón negro; llamar al llegar.",
      payment: "Tarjeta",
      paid: true,
      notes: "Entregar con cuidado, por favor.",
      items: [
        { name: "Mega Torta", qty: 2, modsText: "Sin cebolla · extra queso" },
        { name: "Papas cheddar", qty: 1 },
        { name: "Coca-Cola 2 L", qty: 1 },
      ],
      delivery: {
        id: offer.id,
        orderId: offer.id,
        status: "accepted",
        driverPay: offer.driverPay,
        distanceKm: offer.distanceKm,
        pickupEtaMin: 7,
        deliveryEtaMin: offer.deliveryEtaMin,
        acceptedAt: new Date().toISOString(),
        trail: [
          { lat: 14.0852, lng: -87.1981 },
          { lat: 14.0868, lng: -87.1962 },
          { lat: 14.0887, lng: -87.1939 },
          { lat: 14.0904, lng: -87.1918 },
        ],
      },
    };
  }
  function startDemo() {
    stopTracking();
    stopAlarm();
    state.demo = true;
    state.demoCompleted = false;
    state.auth = { email: DEMO_EMAIL, displayName: "Carlos Demo" };
    state.profile = {
      id: "demo-driver",
      name: "Carlos Demo",
      status: "approved",
      vehicleType: "Moto",
      vehiclePlate: "DEM-2026",
    };
    state.available = demoOffers();
    state.mine = [];
    state.history = [];
    try {
      sessionStorage.setItem("chingadazo_delivery_demo", "1");
    } catch {}
    render();
  }
  function endDemo() {
    stopAlarm();
    state.demo = false;
    state.demoCompleted = false;
    state.auth = null;
    state.profile = null;
    state.available = [];
    state.mine = [];
    state.history = [];
    try {
      sessionStorage.removeItem("chingadazo_delivery_demo");
    } catch {}
    render();
  }
  function demoAccept(id) {
    const offer = state.available.find((x) => x.id === id);
    if (!offer) return;
    state.mine = [demoJob(offer)];
    state.available = state.available.filter((x) => x.id !== id);
    render();
  }
  function demoStatus(next) {
    const job = state.mine[0];
    if (!job) return;
    job.delivery.status = next;
    job.delivery.updatedAt = new Date().toISOString();
    if (next === "heading_pickup") job.delivery.pickupEtaSharedMin = 7;
    if (next === "picked_up") job.delivery.pickedUpAt = job.delivery.updatedAt;
    if (next === "delivered") {
      job.delivery.deliveredAt = job.delivery.updatedAt;
      job.deliveredAt = job.delivery.updatedAt;
      state.history.unshift(job);
      state.mine = [];
      state.demoCompleted = true;
    }
    render();
    if(state.profile?.status==="approved" && state.soundEnabled && notificationPermission()==="granted") enableRemotePush().catch(()=>{});
  }
  function stopAlarm() {
    if (state.alarm) clearInterval(state.alarm);
    state.alarm = null;
  }
  function unlockAudio() {
    try {
      const C=window.AudioContext||window.webkitAudioContext;
      const c=state.audio||(state.audio=new C());
      if(c.state==="suspended") c.resume();
      const o=c.createOscillator(),g=c.createGain();
      g.gain.value=0.0001;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.02);
      try { localStorage.setItem("chingadazo_delivery_sound","1"); } catch {}
    } catch {}
  }
  function alarmTone() {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      const c = state.audio || (state.audio = new C());
      if (c.state === "suspended") c.resume();
      const n = c.currentTime;
      const compressor=c.createDynamicsCompressor(); compressor.threshold.value=-18; compressor.ratio.value=8; compressor.connect(c.destination);
      [784, 1175, 1568, 988, 1568, 1976, 1175, 1760].forEach((f, i) => {
        const o = c.createOscillator(),
          g = c.createGain();
        o.frequency.value = f;
        o.type = i%2 ? "square" : "sawtooth";
        g.gain.setValueAtTime(0.0001, n + i * 0.16);
        g.gain.exponentialRampToValueAtTime(1, n + i * 0.14 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, n + i * 0.14 + 0.125);
        o.connect(g);
        g.connect(compressor);
        o.start(n + i * 0.14);
        o.stop(n + i * 0.14 + 0.14);
      });
    } catch {}
  }
  let deliveryServiceWorkerPromise=null;
  function deliveryServiceWorker() {
    if(!("serviceWorker" in navigator)) return Promise.reject(new Error("Este navegador no admite notificaciones en segundo plano."));
    if(!deliveryServiceWorkerPromise) deliveryServiceWorkerPromise=navigator.serviceWorker.register("/delivery/sw.js",{scope:"/delivery/",updateViaCache:"none"}).then(reg=>{reg.update().catch(()=>{});return reg});
    return deliveryServiceWorkerPromise;
  }
  async function enableRemotePush(sendTest=false) {
    if(state.demo) return false;
    if(!("serviceWorker" in navigator) || !("Notification" in window)) throw new Error("Abre o instala la app en un navegador compatible con notificaciones. También puedes consultar tu aprobación dentro del portal.");
    const permission=Notification.permission==="granted" ? "granted" : await Notification.requestPermission();
    const cfg=await api("/api/delivery/push-config");
    state.pushConfigured=cfg.enabled===true;
    if(!cfg.enabled) throw new Error("Las notificaciones con la app cerrada todavía no están disponibles. Tu confirmación aparecerá dentro de la app.");
    if(permission!=="granted") throw new Error("Permite las notificaciones en la configuración del teléfono para recibir órdenes con la app cerrada.");
    const registration=await deliveryServiceWorker();
    const pushToken=await AuthBridge.messagingToken(registration,cfg.vapidKey);
    if(!pushToken) throw new Error("El teléfono no pudo crear la suscripción push.");
    await api("/api/delivery/push-subscribe",{method:"POST",body:JSON.stringify({token:pushToken,platform:navigator.userAgent})});
    if(sendTest) await api("/api/delivery/push-test",{method:"POST"});
    state.remotePushAccount=state.auth?.uid||state.auth?.email||"active";
    return true;
  }
  async function notifyOffers(offers, previousIds) {
    if (!state.offersLoaded || !("Notification" in window) || Notification.permission !== "granted") return;
    const fresh = offers.filter((o) => !previousIds.has(o.id));
    if (!fresh.length) return;
    const first = fresh[0];
    const message = `${first.code} · ${first.zone} · ganas ${money(Number(first.driverPay || 0) + Number(first.tip || 0))}`;
    try {
      const reg = await deliveryServiceWorker();
      if (reg?.active) reg.active.postMessage({ type: "delivery-offer", title: fresh.length > 1 ? `${fresh.length} entregas nuevas` : "Nueva entrega disponible", body: message, tag: first.id });
      else new Notification("Nueva entrega disponible", { body: message, icon: "../assets/logo.jpg", tag: first.id, requireInteraction: true });
    } catch {}
  }
  function syncAlarm() {
    state.soundEnabled=true;
    if (state.available.length) state.emptyOfferPolls=0;
    else if (state.mine.length) { state.emptyOfferPolls=3; stopAlarm(); return; }
    else if (++state.emptyOfferPolls < 3) return;
    else { stopAlarm(); return; }
    if (state.alarm) return;
    alarmTone();
    state.alarm = setInterval(alarmTone, 2600);
  }

  function header() {
    return `<header class="topbar"><div class="brand"><div class="brand-mark">🏍️</div><div><h1>Chingadazo Delivery</h1><small>${state.demo ? "Vista de demostración" : "Portal privado de repartidores"}</small></div></div>${state.auth ? `<div class="top-actions">${state.demo ? `<span class="demo-badge">DEMO</span>` : ""}<button class="icon-btn" data-action="logout" aria-label="Cerrar sesión">Salir</button></div>` : ""}</header>`;
  }
  function authView() {
    return `${header()}<section class="login-hero"><div class="login-copy"><span class="eyebrow">ENTREGAS CON CONTROL</span><h2>Tu ruta comienza aquí.</h2><p>Acepta pedidos, conoce tu pago y comparte el recorrido con seguridad.</p></div><img src="../assets/delivery-moto-3d.webp" alt="Motocicleta de delivery"></section><div class="tabs"><button class="${state.view === "login" ? "on" : ""}" data-view="login">Entrar</button><button class="${state.view === "register" ? "on" : ""}" data-view="register">Registrarme</button></div>${state.view === "login" ? `<form class="card form login-card" id="loginForm"><div><span class="eyebrow">CUENTA DE REPARTIDOR</span><h2>Bienvenido</h2><p class="muted">Ingresa con la cuenta aprobada por Administración.</p></div><label>Correo electrónico</label><input name="email" type="email" autocomplete="email" placeholder="nombre@correo.com" required><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" placeholder="••••••••" minlength="6" required><button class="btn full">Entrar al portal <span>→</span></button></form>` : registerView(false)}<p class="privacy-foot">🔒 Datos protegidos · Ubicación compartida solamente durante entregas activas</p>`;
  }
  function enhanceForms() {
    const login = document.getElementById("loginForm");
    if (login) {
      const submit = login.querySelector("button.btn.full");
      if (submit) submit.type = "submit";
      if (!login.querySelector('[data-action="demo-login"]')) {
        const divider = document.createElement("div");
        divider.className = "demo-divider";
        divider.innerHTML = "<span>o</span>";
        const demo = document.createElement("button");
        demo.type = "button";
        demo.className = "btn demo-button";
        demo.dataset.action = "demo-login";
        demo.textContent = "Probar la interfaz demo";
        login.append(divider, demo);
      }
    }
    const register = document.getElementById("registerForm");
    if (register) {
      const submit = register.querySelector("button.btn.full:last-child");
      if (submit) submit.type = "submit";
      vehicleFields(register);
    }
  }
  const registrationDocs = [
    {kind:"license",field:"licenseObject",flag:"hasLicensePhoto",label:"Foto de licencia",motor:true},
    {kind:"vehicle-right",field:"vehicleRightObject",flag:"hasVehicleRightPhoto",label:"Foto lateral derecho del vehículo",motor:true},
    {kind:"vehicle-left",field:"vehicleLeftObject",flag:"hasVehicleLeftPhoto",label:"Foto lateral izquierdo del vehículo",motor:true},
    {kind:"vin",field:"vinObject",flag:"hasVinPhoto",label:"Foto del número VIN en el vehículo",motor:true},
    {kind:"vehicle",field:"vehicleObject",flag:"hasVehiclePhoto",label:"Fotografía de la bicicleta",motor:false}
  ];
  function vehicleFields(form) {
    const bike=form.elements.vehicleType.value==="Bicicleta";
    form.querySelectorAll("[data-vehicle-group]").forEach(group=>{
      const active=(group.dataset.vehicleGroup==="bike")===bike;
      group.hidden=!active;
      group.querySelectorAll("input").forEach(input=>{
        input.disabled=!active;
        input.required=active && !(input.type==="file" && state.profile?.[input.dataset.savedFlag]);
      });
    });
  }
  function registerView(existing) {
    const p=state.profile||{},v=k=>esc(p[k]||"");
    return `<form class="card form" id="registerForm"><div><span class="eyebrow">REPARTIDORES</span><h2>${existing ? "Completar solicitud" : "Solicitud de registro"}</h2></div>
      <div class="notice">Una vez registrado recibirás confirmación dentro de la app sobre tu aprobación.</div>
      <label>Nombre completo<input name="name" value="${v('name')}" required maxlength="160"></label>
      <label>Número de identidad<input name="dni" value="${v('dni')}" required maxlength="50"></label>
      <label>Teléfono<input name="phone" value="${v('phone')}" type="tel" required maxlength="50"></label>
      ${existing ? "" : `<label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="6" required></label>`}
      <div class="form-grid"><label>Dirección de residencia<input name="residenceAddress" value="${v('residenceAddress')}" required maxlength="500"></label><label>Referencia de la vivienda<textarea name="residenceReference" required maxlength="500">${v('residenceReference')}</textarea></label></div>
      <label>Vehículo<select name="vehicleType">${['Moto','Automóvil','Bicicleta'].map(t=>`<option ${p.vehicleType===t?'selected':''}>${t}</option>`).join('')}</select></label>
      <div data-vehicle-group="motor"><div class="form-grid"><label>Placa<input name="vehiclePlate" value="${v('vehiclePlate')}" maxlength="50"></label><label>Número VIN<input name="vehicleVin" value="${v('vehicleVin')}" maxlength="17" minlength="17" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" autocapitalize="characters" spellcheck="false" aria-describedby="vinHelp"></label></div><p class="muted" id="vinHelp">17 letras y números. Debe coincidir con el VIN visible en la fotografía del vehículo.</p><div class="form-grid"><label>Número de licencia<input name="licenseNumber" value="${v('licenseNumber')}" maxlength="80"></label><label>Vencimiento de licencia<input name="licenseExpires" value="${v('licenseExpires')}" type="date"></label></div></div>
      <h3>Foto de rostro en vivo</h3><div class="camera" id="cameraBox"><div class="placeholder">${p.hasSelfie?'✓ Fotografía recibida. Puedes conservarla o tomar otra.':'📷 Abre la cámara para tomar tu fotografía de rostro.'}</div></div><div class="row"><button type="button" class="btn secondary" data-action="camera">Abrir cámara</button><button type="button" class="btn secondary hidden" data-action="capture">Tomar foto</button></div>
      ${registrationDocs.map(d=>`<div data-vehicle-group="${d.motor?'motor':'bike'}"><label>${d.label}<input type="file" id="doc-${d.kind}" data-saved-flag="${d.flag}" accept="image/jpeg,image/png,image/webp"></label>${p[d.flag]?'<small class="muted">Recibida. Selecciona otra imagen solo si deseas reemplazarla.</small>':''}</div>`).join('')}
      <p class="muted">Las fotografías deben ser claras y completas, en JPG, PNG o WebP, de hasta 5 MB cada una.</p>
      <label class="notice consent"><input name="consent" type="checkbox" required><span>Autorizo la verificación de mi identidad, los datos y documentos de mi vehículo, y mi ubicación durante entregas activas.</span></label><button type="submit" class="btn full">Enviar solicitud</button>${state.profile?'<button type="button" class="btn secondary" data-action="cancel-application">Volver</button>':''}</form>`;
  }
  function statusView() {
    const p=state.profile||{},docs=[{label:'Fotografía de rostro',flag:'hasSelfie'},...registrationDocs.filter(d=>d.motor!==(p.vehicleType==='Bicicleta'))];
    const info=p.status==='rejected'?`<div class="notice bad"><b>Solicitud rechazada</b><br>${esc(p.rejectionReason||'Revisa y corrige tu solicitud.')}</div>`:p.status==='suspended'?'<div class="notice bad"><b>Cuenta suspendida</b><br>Comunícate con Administración.</div>':'<div class="notice"><b>Solicitud en revisión</b><br>Administración comprobará tus datos y las fotografías antes de aprobarte.</div>';
    return `${header()}<section class="card hero-card"><span class="eyebrow dark">SOLICITUD RECIBIDA</span><h2>Hola, ${esc(p.name||'repartidor')}</h2><p>Una vez registrado recibirás confirmación dentro de la app sobre tu aprobación.</p></section>${info}
      ${p.emailVerified?'':`<div class="notice bad"><b>Falta confirmar el correo.</b><br>Abre el enlace que enviamos a tu correo.<br><button class="btn secondary" data-action="resend">Reenviar correo</button></div>`}
      ${p.status==='pending'?`<section class="card"><h3>Aviso de aprobación</h3><p>Activa las notificaciones para recibir tu confirmación aunque la app esté cerrada. También podrás consultar tu estado aquí.</p><button class="btn full" data-action="approval-push">Activar notificación de aprobación</button><p class="muted" id="approvalPushStatus" role="status">${state.remotePushAccount?"Notificaciones activadas para esta cuenta en este dispositivo.":""}</p></section>`:''}
      <section class="card"><h3>Estado de documentos · ${esc(p.vehicleType)}</h3>${docs.map(d=>`<div class="doc-status"><span>${p[d.flag]?'✓':'!'}</span><p><b>${d.label}</b><small>${p[d.flag]?'Recibida':'Pendiente'}</small></p></div>`).join('')}${p.vehicleType!=='Bicicleta'?`<p class="muted">VIN: ${esc(p.vehicleVin||'Pendiente')} · Licencia vigente hasta ${esc(p.licenseExpires||'—')}</p>`:''}${p.missingRequirements?.length?`<div class="notice bad">Falta completar: ${p.missingRequirements.map(esc).join(', ')}.</div>`:''}${p.status!=='suspended'?'<button class="btn secondary full" data-action="edit-application">Completar o corregir solicitud</button>':''}</section>`;
  }
  function routeMap(delivery, orderId) {
    const live = delivery?.trail || [],
      planned = decodePolyline(
        ["accepted", "heading_pickup"].includes(delivery?.status)
          ? delivery?.pickupRoutePolyline
          : delivery?.routePolyline,
      );
    const pts = planned.length > 1 ? planned : live;
    let poly = "28,180 95,145 155,158 225,92 338,42",
      left = 76,
      top = 38;
    if (pts.length > 1) {
      const lats = pts.map((p) => p.lat),
        lngs = pts.map((p) => p.lng),
        minLa = Math.min(...lats),
        maxLa = Math.max(...lats),
        minLn = Math.min(...lngs),
        maxLn = Math.max(...lngs);
      const xy = (p) => [
        24 + ((p.lng - minLn) / (maxLn - minLn || 1)) * 320,
        185 - ((p.lat - minLa) / (maxLa - minLa || 1)) * 145,
      ];
      poly = pts.map((p) => xy(p).join(",")).join(" ");
      const current = live[live.length - 1] || pts[0],
        last = xy(current);
      left = last[0] / 3.7;
      top = last[1] / 2.2;
    }
    const real=state.demo?"":`<img class="google-route-map" data-google-map="/api/delivery/map/${encodeURIComponent(orderId||delivery?.orderId||delivery?.id)}?v=${encodeURIComponent(delivery?.updatedAt||"")}" alt="Ruta real y tráfico en Google Maps">`;
    return `<div class="map">${real}<div class="map-fallback"><div class="map-label start">🍽️ RESTAURANTE</div><div class="map-label end">📍 CLIENTE</div><svg viewBox="0 0 370 210" preserveAspectRatio="none"><polyline class="route-shadow" points="${poly}"/><polyline class="route-line" points="${poly}"/></svg><span class="pulse" style="left:${left}%;top:${top}%"></span><img class="moto-pin" style="left:${left}%;top:${top}%" src="../assets/delivery-moto-3d.webp" alt="Moto en ruta"></div></div>`;
  }
  function offerCard(o) {
    return `<article class="card job offer"><div class="spread"><div><span class="pill ${o.ready ? "ok" : "gold"}"><i></i>${o.ready ? "Lista para recoger" : "En preparación"}</span><h3 class="job-code">${esc(o.code)}</h3><div class="muted">📍 ${esc(o.deliveryZoneName || o.zone)}</div></div><div class="pay"><small>GANAS</small>${money(Number(o.driverPay || 0) + Number(o.tip || 0))}${o.tip ? `<em>Incluye ${money(o.tip)} de propina</em>` : ""}</div></div><div class="metric-row"><div class="metric"><span>↗</span><strong>${o.distanceKm ? o.distanceKm + " km" : "—"}</strong><small>${o.distanceSource === "google_routes" ? "ruta Google" : o.deliveryZoneName ? "tarifa fija" : "por confirmar"}</small></div><div class="metric"><span>◷</span><strong>${o.deliveryEtaMin || "—"} min</strong><small>tiempo estimado</small></div><div class="metric"><span>▣</span><strong>${o.itemCount}</strong><small>productos</small></div></div><p class="privacy-line">Los datos del cliente se desbloquean al aceptar.</p><div class="offer-actions"><button class="btn secondary" data-reject="${esc(o.id)}">Rechazar</button><button class="btn" data-accept="${esc(o.id)}" ${o.driverPay > 0 ? "" : "disabled"}>${o.driverPay > 0 ? "Aceptar →" : "Pago pendiente"}</button></div></article>`;
  }
  function progress(status) {
    const order = ["accepted", "heading_pickup", "picked_up", "delivered"],
      current = Math.max(0, order.indexOf(status));
    return `<div class="progress">${["Aceptada", "Al restaurante", "Recogida", "Entregada"].map((x, i) => `<div class="${i <= current ? "done" : ""}"><span>${i < current ? "✓" : i + 1}</span><small>${x}</small></div>`).join("")}</div>`;
  }
  function mineCard(o) {
    const d = o.delivery || {},
      started = Date.parse(d.acceptedAt || o.createdAt || Date.now()),
      mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
    const actions =
      d.status === "accepted"
        ? `<button class="btn full" data-status="heading_pickup" data-order="${esc(o.id)}">Voy hacia el restaurante →</button>`
        : d.status === "heading_pickup"
          ? (o.paid
            ? `<button class="btn full" data-status="picked_up" data-order="${esc(o.id)}">Confirmar que recogí la orden →</button>`
            : `<button class="btn full" type="button" disabled>🔒 Esperando cobro y factura de Caja</button>`)
          : d.status === "picked_up"
            ? ((state.profile?.requireDeliveryPhoto === true || o.deliveryPhotoRequired === true) && !o.hasDeliveryPhoto
              ? `<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-proof-input="${esc(o.id)}"><button class="btn full" data-proof="${esc(o.id)}" ${state.proofUploading===o.id?"disabled":""}>📷 ${state.proofUploading===o.id?"Guardando foto…":"Tomar foto de la entrega"}</button><small class="muted">La foto es privada. Después introducirás el código del cliente.</small>`
              : `<div class="delivery-code-step"><label>Código de entrega del cliente</label><input inputmode="numeric" maxlength="4" pattern="[0-9]{4}" data-delivery-code="${esc(o.id)}" placeholder="4 números"><small class="muted">Pídeselo al cliente solamente cuando tenga su orden.</small><button class="btn full" data-status="delivered" data-order="${esc(o.id)}">Confirmar entrega al cliente →</button></div>`)
            : "";
    return `<article class="card active-job"><div class="spread"><div><span class="pill live"><i></i>EN RUTA · ${mins} min</span><h2 class="customer-name">${esc(o.customerName)}</h2><p class="order-code">${esc(o.code)}</p></div><div class="pay"><small>GANAS</small>${money(Number(o.driverPay || 0) + Number(o.tip || 0))}${o.tip ? `<em>Propina ${money(o.tip)}</em>` : ""}</div></div>${progress(d.status)}${routeMap(d)}<div class="metric-row two"><div class="metric"><span>◷</span><strong>${d.pickupEtaSharedMin || d.pickupEtaMin || "—"} min</strong><small>al restaurante</small></div><div class="metric"><span>⌖</span><strong>${d.deliveryEtaMin || "—"} min</strong><small>al cliente · ${o.distanceKm || "—"} km</small></div></div><section class="delivery-details"><h3>Detalles del destino</h3><p class="address"><b>📍 ${esc(o.address)}</b><small>${esc(o.addressNotes)}</small></p><div class="contact-row"><a class="contact" href="tel:${esc(o.phone)}">📞 <span><small>LLAMAR</small>${esc(o.phone)}</span></a><span class="payment">${o.paid ? "✓ Pagada" : "! Pendiente en Caja"}</span></div></section><details class="order-items" open><summary>Orden completa · ${o.itemCount} productos</summary><ul class="items">${(o.items || []).map((i) => `<li>${i.image ? `<img class="item-photo" src="${esc(i.image)}" alt="">` : ""}<div><b>${Number(i.qty || 1)}× ${esc(i.name)}</b>${i.modsText ? `<div class="muted">${esc(i.modsText)}</div>` : ""}${i.note ? `<div>📝 ${esc(i.note)}</div>` : ""}</div></li>`).join("")}</ul>${o.notes ? `<div class="notice">📝 ${esc(o.notes)}</div>` : ""}</details><div class="action-grid"><a class="btn secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address)}">Abrir navegación</a>${actions}</div></article>`;
  }
  function historyCard(o) {
    const d = o.delivery || {};
    return `<article class="history-job"><div><b>${esc(o.code)}</b><small>${o.deliveredAt ? new Date(o.deliveredAt).toLocaleString("es-HN") : "Completada"} · ${esc(o.customerName)}</small></div><div><strong>${money(Number(o.driverPay || 0) + Number(o.tip || 0))}</strong><small>${o.rating?.emoji || "Sin calificar"}</small></div></article>`;
  }
  function dashboard() {
    const p = state.profile,
      total = state.history.reduce(
        (n, x) => n + Number(x.driverPay || 0) + Number(x.tip || 0),
        0,
      ),
      rated = state.history.filter((x) => x.rating),
      avg = rated.length
        ? (
            rated.reduce((n, x) => n + Number(x.rating.score || 0), 0) /
            rated.length
          ).toFixed(1)
        : "—";
    const permission = notificationPermission();
    const soundLabel = state.pushConfigured===false
      ? "⚠️ Falta activar push con la app cerrada"
      : permission==="granted"
        ? "🔔 Sonido y push activos · tocar para probar"
        : permission==="unsupported"
          ? "📲 Instala la app para activar notificaciones"
          : "🔔 Activar alertas con la app cerrada";
    return `${header()}${p.approvalNotice?`<div class="notice ok" role="status"><b>${esc(p.approvalNotice.title)}</b><br>${esc(p.approvalNotice.body)}</div>`:""}${state.demo ? `<div class="demo-strip"><b>Modo demostración</b><span>Ninguna acción modifica pedidos reales.</span></div>` : ""}<section class="driver-summary"><div><span class="online"><i></i> DISPONIBLE</span><h2>Hola, ${esc(p.name)}</h2><p>${state.mine.length ? "Tu entrega está en curso. Conduce con cuidado." : "Estás listo para recibir una nueva ruta."}</p></div><div class="avatar">${state.avatarUrl ? `<img src="${state.avatarUrl}" alt="${esc(p.name)}">` : esc((p.name || "R").charAt(0))}</div></section><button class="sound-button on" data-action="sound">${soundLabel}</button><div class="quick-stats"><div><strong>${state.mine.length}</strong><span>Activa</span></div><div><strong>⭐ ${avg}</strong><span>Calificación</span></div><div><strong>${money(total)}</strong><span>Historial</span></div></div>${state.demoCompleted ? `<div class="success-card"><span>✓</span><div><b>Entrega demo completada</b><p>Probaste correctamente todo el recorrido.</p></div><button class="btn secondary" data-action="demo-reset">Repetir</button></div>` : ""}${state.mine.length && !state.demo ? `<p id="gpsStatus" class="muted" role="status">${esc(state.gpsMessage)}</p>` : ""}${state.mine.map(mineCard).join("")}<div class="section-title"><div><span class="eyebrow">NUEVAS RUTAS · ${state.available.length}</span><h2>Entregas disponibles</h2></div><button class="icon-btn refresh" data-action="refresh" aria-label="Actualizar">↻</button></div>${state.available.length ? state.available.map(offerCard).join("") : `<div class="card empty"><img src="../assets/delivery-moto-3d.webp" alt="Moto"><h3>Sin entregas disponibles</h3><p>Te avisaremos cuando aparezca una nueva ruta.</p></div>`}<details class="history card"><summary><span><b>Historial de entregas</b><small>${state.history.length} completadas · ${rated.length} calificadas</small></span><strong>${money(total)}</strong></summary>${state.history.length ? state.history.map(historyCard).join("") : `<p class="muted">Tus entregas terminadas aparecerán aquí.</p>`}</details>`;
  }
  async function hydrateAvatar() {
    if (state.demo || state.avatarUrl || !state.profile?.hasSelfie) return;
    try {
      const t = await token(),
        r = await fetch("/api/delivery/avatar", {
          headers: { Authorization: "Bearer " + t },
        });
      if (r.ok) {
        state.avatarUrl = URL.createObjectURL(await r.blob());
        const a = document.querySelector(".avatar");
        if (a)
          a.innerHTML = `<img src="${state.avatarUrl}" alt="Foto de perfil">`;
      }
    } catch {}
  }
  function render() {
    const historyOpen = !!root.querySelector("details.history[open]");
    const itemsOpen = !!root.querySelector("details.order-items[open]");
    const scrollY = window.scrollY;
    const markup = !state.auth
      ? authView()
      : !state.profile || state.editApplication
        ? header() + registerView(true)
        : state.profile.status !== "approved"
          ? statusView()
          : dashboard();
    if(markup===state.lastMarkup) return;
    root.innerHTML = markup;
    state.lastMarkup=markup;
    enhanceForms();
    const history = root.querySelector("details.history");
    if (history && historyOpen) history.open = true;
    const items = root.querySelector("details.order-items");
    if (items) items.open = itemsOpen || !state.lastDataSignature;
    hydrateAvatar();
    root.querySelectorAll("img[data-google-map]").forEach(async img=>{try{const t=await token(),res=await fetch(img.dataset.googleMap,{headers:{Authorization:"Bearer "+t}});if(!res.ok)throw new Error();const url=URL.createObjectURL(await res.blob());img.onload=img.onerror=()=>URL.revokeObjectURL(url);img.src=url}catch{img.style.display="none"}});
    if (scrollY > 0) requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }
  async function load() {
    try {
      if (sessionStorage.getItem("chingadazo_delivery_demo") === "1") {
        startDemo();
        return;
      }
    } catch {}
    state.auth = await AuthBridge.current();
    if (!state.auth) {
      render();
      return;
    }
    try {
      const data = await api("/api/delivery/profile");
      state.profile = data.profile;
      if (state.profile?.status === "pending" && !state.remotePushAccount && notificationPermission()==="granted") enableRemotePush().catch(()=>{});
      if (state.profile?.status === "approved") {
        state.soundEnabled=true;
        try { localStorage.setItem("chingadazo_delivery_sound","1"); } catch {}
        try { const cfg=await api("/api/delivery/push-config"); state.pushConfigured=cfg.enabled===true; } catch { state.pushConfigured=false; }
        await refresh();
        if(!state.remotePushAccount && "Notification" in window && Notification.permission==="granted") enableRemotePush().catch(()=>{});
      }
    } catch (e) {
      console.error(e);
    }
    render();
  }
  async function refresh() {
    if (state.demo) {
      render();
      return;
    }
    if (state.refreshBusy || document.hidden) return false;
    state.refreshBusy = true;
    try {
    const previousIds = new Set(state.available.map((o) => o.id));
    const data = await api("/api/delivery/orders");
    const signature = JSON.stringify({
      available: (data.available || []).map((o) => [o.id, o.status, o.ready, o.driverPay, o.tip, o.distanceKm]),
      mine: (data.mine || []).map((o) => [o.id, o.delivery?.status, o.delivery?.updatedAt, o.paid]),
      history: (data.history || []).map((o) => [o.id, o.deliveredAt, o.rating?.score, o.rating?.note]),
      profile: [data.profile?.status, data.profile?.name]
    });
    const changed = signature !== state.lastDataSignature;
    state.profile = data.profile;
    state.available = data.available || [];
    state.mine = data.mine || [];
    state.history = data.history || [];
    notifyOffers(state.available, previousIds);
    state.offersLoaded = true;
    state.lastDataSignature = signature;
    if (state.mine.length) startTracking(state.mine[0].id);
    else stopTracking();
    syncAlarm();
    return changed;
    } finally {
      state.refreshBusy = false;
    }
  }
  function currentPosition() { return window.ChingadazoGPS.locate(); }
  function gpsStatus(message) {
    state.gpsMessage=message;
    const element=document.getElementById("gpsStatus");if(element)element.textContent=message;
  }
  function startTracking(orderId) {
    if (state.demo || !navigator.geolocation || !orderId) return;
    if (state.watch !== null && state.watchOrderId === orderId) return;
    if (state.watch !== null) stopTracking();
    state.watchOrderId = orderId;
    let sending=false, lastSent=0;
    state.watch = navigator.geolocation.watchPosition(
      async (p) => {
        const point=window.ChingadazoGPS.sample(p);
        if(!point || point.accuracy>100){gpsStatus("Señal GPS imprecisa. Activa Ubicación precisa y mantén esta pantalla abierta.");return;}
        if(sending || Date.now()-lastSent<5000 || state.watchOrderId!==orderId)return;
        sending=true;
        try {
          await api("/api/delivery/location", {
            method: "POST",
            body: JSON.stringify({
              orderId,
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy: point.accuracy,
              capturedAt: point.capturedAt,
              heading: p.coords.heading,
              speed: p.coords.speed,
            }),
          });
          lastSent=Date.now();
          gpsStatus(`Ubicación enviada · radio estimado ±${Math.round(point.accuracy)} m · ${new Date(lastSent).toLocaleTimeString("es-HN")}`);
        } catch (e) {
          console.warn(e);
          gpsStatus("No se pudo enviar la ubicación. Revisa la conexión; se reintentará con la próxima lectura.");
        } finally { sending=false; }
      },
      () => gpsStatus("No hay lectura GPS reciente. Revisa el permiso de ubicación y mantén la pantalla abierta."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }
  function stopTracking() {
    if (state.watch !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(state.watch);
    state.watch = null;
    state.watchOrderId = "";
  }
  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Este navegador no permite abrir la cámara. Usa Safari o Chrome actualizado.",
      );
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    document.getElementById("cameraBox").innerHTML =
      `<video id="selfieVideo" autoplay playsinline></video>`;
    document.getElementById("selfieVideo").srcObject = state.stream;
    document
      .querySelector('[data-action="capture"]')
      .classList.remove("hidden");
  }
  async function capture() {
    const v = document.getElementById("selfieVideo");
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 960;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    state.selfie = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
    if (state.selfiePreviewUrl) URL.revokeObjectURL(state.selfiePreviewUrl);
    state.selfiePreviewUrl = URL.createObjectURL(state.selfie);
    document.getElementById("cameraBox").innerHTML =
      `<img alt="Fotografía capturada" src="${state.selfiePreviewUrl}">`;
  }
  async function upload(kind, blob) {
    const data = await api("/api/delivery/document?kind=" + kind, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    });
    return data.objectName;
  }
  async function uploadDeliveryProof(orderId, blob) {
    const data = await api("/api/delivery/document?kind=proof&orderId=" + encodeURIComponent(orderId), {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    });
    return data.objectName;
  }
  async function prepareDeliveryProof(file) {
    if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 1500000) return file;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error("No se pudo leer la foto. Inténtalo nuevamente."));el.src=url;});
      const scale=Math.min(1,1600/Math.max(img.naturalWidth||1,img.naturalHeight||1));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo preparar la foto.")),"image/jpeg",0.8));
    } finally { URL.revokeObjectURL(url); }
  }

  root.addEventListener("click", async (e) => {
    unlockAudio();
    const el = e.target.closest("button");
    if (!el) return;
    try {
      if (el.dataset.view) {
        state.view = el.dataset.view;
        render();
      } else if (el.dataset.action === "logout") {
        stopAlarm();
        stopTracking();
        state.stream?.getTracks().forEach((track) => track.stop());
        state.stream = null;
        if (state.avatarUrl) URL.revokeObjectURL(state.avatarUrl);
        if (state.selfiePreviewUrl) URL.revokeObjectURL(state.selfiePreviewUrl);
        state.avatarUrl = "";
        state.selfiePreviewUrl = "";
        state.selfie = null;
        if (state.demo) endDemo();
        else {
          await AuthBridge.signOut();
          state.auth = null;
          state.profile = null;
          state.editApplication=false; state.remotePushAccount=null;
          render();
        }
      } else if (el.dataset.action === "edit-application") {
        state.editApplication=true; render();
      } else if (el.dataset.action === "cancel-application") {
        state.editApplication=false; state.stream?.getTracks().forEach(t=>t.stop()); state.stream=null; render();
      } else if (el.dataset.action === "approval-push") {
        el.disabled=true;
        try { await enableRemotePush(); const msg=document.getElementById("approvalPushStatus"); if(msg)msg.textContent="Notificaciones activadas para esta cuenta en este dispositivo."; }
        finally { el.disabled=false; }
      } else if (el.dataset.action === "sound") {
        state.soundEnabled = true;
        try { localStorage.setItem("chingadazo_delivery_sound", "1"); } catch {}
        alarmTone();
        if(!state.demo) { await enableRemotePush(true); alert("Prueba enviada. Cierra la app o bloquea el teléfono y confirma que recibiste el aviso."); }
        syncAlarm();
        render();
      } else if (el.dataset.action === "demo-reset") {
        startDemo();
      } else if (el.dataset.action === "resend") {
        await AuthBridge.resendVerification(
          location.origin + "/delivery/?verified=1",
        );
        alert("Correo reenviado. Revisa también Spam.");
      } else if (el.dataset.action === "camera") await openCamera();
      else if (el.dataset.action === "capture") await capture();
      else if (el.dataset.action === "refresh") {
        await refresh();
        render();
      } else if (el.dataset.reject) {
        el.disabled = true;
        if (state.demo) {
          state.available = state.available.filter(
            (x) => x.id !== el.dataset.reject,
          );
          syncAlarm();
          render();
        } else {
          await api("/api/delivery/reject", {
            method: "POST",
            body: JSON.stringify({ orderId: el.dataset.reject }),
          });
          await refresh();
          render();
        }
      } else if (el.dataset.accept) {
        el.disabled = true;
        if (state.demo) demoAccept(el.dataset.accept);
        else {
          const location = await currentPosition();
          await api("/api/delivery/accept", {
            method: "POST",
            body: JSON.stringify({ orderId: el.dataset.accept, location }),
          });
          await refresh();
          render();
        }
      } else if (el.dataset.status) {
        el.disabled = true;
        if (state.demo) demoStatus(el.dataset.status);
        else {
          const payload = {
            orderId: el.dataset.order,
            status: el.dataset.status,
          };
          if (el.dataset.status === "delivered") {
            const codeInput = root.querySelector(`[data-delivery-code="${CSS.escape(el.dataset.order)}"]`);
            payload.deliveryCode = String(codeInput?.value || "").replace(/\D/g, "");
            if (!/^\d{4}$/.test(payload.deliveryCode)) throw new Error("Escribe los 4 números que muestra la app del cliente.");
          }
          if (el.dataset.status === "heading_pickup")
            payload.pickupEtaMin = state.mine[0]?.delivery?.pickupEtaMin || 5;
          await api("/api/delivery/status", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          await refresh();
          render();
        }
      } else if (el.dataset.proof) {
        const input = [...root.querySelectorAll("[data-proof-input]")].find(x=>x.dataset.proofInput===el.dataset.proof);
        if (!input) throw new Error("Actualiza la entrega e inténtalo nuevamente.");
        input.click();
      }
    } catch (error) {
      alert(error.message);
      el.disabled = false;
    }
  });
  root.addEventListener("change", async (e) => {
    const input = e.target.closest?.("[data-proof-input]");
    if (!input) return;
    const orderId = input.dataset.proofInput;
    const file = input.files?.[0];
    if (!file) return;
    state.proofUploading = orderId; render();
    try {
      await uploadDeliveryProof(orderId, await prepareDeliveryProof(file));
      state.proofUploading = "";
      await refresh(); render();
      alert("Foto guardada. Ahora escribe el código de 4 números del cliente para confirmar la entrega.");
    } catch (error) {
      state.proofUploading = "";
      alert(error.message || "No se pudo guardar la foto. Inténtalo nuevamente.");
      await refresh().catch(()=>{}); render();
    }
  });
  root.addEventListener("click", (e) => {
    const demo = e.target.closest('[data-action="demo-login"]');
    if (demo) startDemo();
  });
  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    unlockAudio();
    const f = e.target;
    const button = f.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      if (f.id === "loginForm") {
        const email = f.email.value.trim().toLowerCase(),
          password = f.password.value;
        state.auth = await AuthBridge.signInEmail(email, password);
        await load();
      } else if (f.id === "registerForm") {
        if(!f.reportValidity()) { button.disabled=false; return; }
        if(!state.selfie && !state.profile?.hasSelfie)throw new Error("Toma tu fotografía de rostro con la cámara.");
        const fields=Object.fromEntries(new FormData(f)),bike=fields.vehicleType==="Bicicleta";
        const docs=registrationDocs.filter(d=>d.motor!==bike).map(d=>({...d,file:f.querySelector('#doc-'+d.kind).files[0]}));
        for(const d of docs)if(!d.file&&!state.profile?.[d.flag])throw new Error("Carga: "+d.label+".");
        for(const d of docs)if(d.file && !/^image\/(jpeg|png|webp)$/.test(d.file.type))throw new Error("Usa fotografías JPG, PNG o WebP.");
        for(const d of docs)if(d.file?.size>5*1024*1024)throw new Error(d.label+": la fotografía debe pesar menos de 5 MB.");
        state.applicationBusy=true;
        if(!state.auth)state.auth=await AuthBridge.createEmail(fields.email.trim(),fields.password,location.origin+"/delivery/?verified=1");
        delete fields.email; delete fields.password;
        if(state.selfie)fields.selfieObject=await upload("selfie",state.selfie);
        for(const d of docs)if(d.file)fields[d.field]=await upload(d.kind,d.file);
        const data=await api("/api/delivery/profile",{method:"POST",body:JSON.stringify(fields)});
        state.profile=data.profile; state.editApplication=false; state.selfie=null;
        state.stream?.getTracks().forEach(t=>t.stop()); state.stream=null;
        render();
        if(notificationPermission()==="granted")enableRemotePush().catch(()=>{});
        alert("Solicitud enviada. Confirma tu correo. Recibirás confirmación dentro de la app sobre tu aprobación.");
      }
    } catch (error) {
      alert(AuthBridge.message ? AuthBridge.message(error) : error.message);
      button.disabled = false;
    } finally { state.applicationBusy=false; }
  });
  root.addEventListener("change",e=>{if(e.target.name==="vehicleType")vehicleFields(e.target.form);});
  AuthBridge.ready.then(load).catch((e) => {
    root.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`;
  });
  state.refresh = setInterval(async () => {
    if (!document.hidden && !state.demo && !state.editApplication && !state.applicationBusy && state.profile?.status === "pending" && !state.profilePollBusy && Date.now()-(state.profilePollAt||0)>15000) {
      state.profilePollBusy=true; state.profilePollAt=Date.now();
      try { await load(); } catch {} finally { state.profilePollBusy=false; }
    }
    if (!document.hidden && !state.demo && state.profile?.status === "approved") {
      try {
        const changed = await refresh();
        if (changed) render();
      } catch {}
    }
  }, 4000);
  if ("serviceWorker" in navigator) deliveryServiceWorker().catch(() => {});
})();
