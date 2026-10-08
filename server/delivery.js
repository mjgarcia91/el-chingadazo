// Delivery authorization and workflow. Driver documents stay outside Realtime DB;
// only private object names are stored in the driver profile.
export function createDelivery({ db, mutateDb, verifyFirebaseUser, json, readBody, uploadDocument, readDocument, computeRoute, awardOrder, notifyCustomer, documentExists, notifyDriverApproved }) {
  const key = (x) => /^[A-Za-z0-9_-]{1,150}$/.test(String(x || ""));
  const err = (message, status = 403) => Object.assign(new Error(message), { status });
  const clean = (value, max = 300) => {
    const out = String(value || "").trim();
    if (!out || out.length > max || /[<>"`]/.test(out)) throw err("Dato inválido o incompleto.", 400);
    return out;
  };
  const number = (value, min, max, label) => {
    const out = Number(value);
    if (!Number.isFinite(out) || out < min || out > max) throw err(label || "Número inválido.", 400);
    return out;
  };
  const values = (x) => x ? Object.values(x).filter(Boolean) : [];
  const nowIso = () => new Date().toISOString();
  const documentFields = {selfie:'selfieObject',license:'licenseObject','vehicle-right':'vehicleRightObject','vehicle-left':'vehicleLeftObject',vin:'vinObject',vehicle:'vehicleObject'};
  function requiredDocuments(p) {
    return p.vehicleType === "Bicicleta" ? ['selfie','vehicle'] : ['selfie','license','vehicle-right','vehicle-left','vin'];
  }
  function missingRequirements(p) {
    const missing=[];
    for(const k of ['name','dni','phone','residenceAddress','residenceReference'])if(!String(p[k]||'').trim())missing.push(({name:'nombre',dni:'identidad',phone:'teléfono',residenceAddress:'dirección',residenceReference:'referencia'})[k]);
    if(!['Moto','Automóvil','Bicicleta'].includes(p.vehicleType))missing.push('tipo de vehículo');
    if(p.vehicleType!=='Bicicleta'){
      if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(p.vehicleVin||''))missing.push('VIN de 17 caracteres');
      if(!p.vehiclePlate)missing.push('placa');
      if(!p.licenseNumber)missing.push('licencia');
      const expiry=Date.parse(p.licenseExpires+'T23:59:59Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.licenseExpires||'') || !Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0,10)!==p.licenseExpires || expiry<=Date.now())missing.push('licencia vigente');
    }
    for(const kind of requiredDocuments(p))if(!p[documentFields[kind]])missing.push(({selfie:'foto de rostro',license:'foto de licencia','vehicle-right':'foto lateral derecho','vehicle-left':'foto lateral izquierdo',vin:'foto del VIN',vehicle:'foto del vehículo'})[kind]);
    return missing;
  }
  async function validateApplication(env,p) {
    const missing=missingRequirements(p);
    if(missing.length)throw err('Completa los requisitos: '+missing.join(', ')+'.',400);
    for(const kind of requiredDocuments(p)){
      const objectName=p[documentFields[kind]],prefix='drivers/'+p.authUid+'/'+kind;
      if(typeof objectName!=='string' || !(objectName.startsWith(prefix+'-')||objectName.startsWith(prefix+'.')) || objectName.includes('..') || objectName.slice(prefix.length).includes('/'))throw err('Las fotografías no corresponden a esta cuenta o documento.',403);
      const exists=documentExists ? await documentExists(env,objectName) : (await readDocument(env,objectName)).ok;
      if(!exists)throw err('No se encontró la fotografía requerida: '+kind+'. Vuelve a cargarla.',400);
    }
  }
  async function flushApprovalPush(env,id) {
    if(!notifyDriverApproved)return;
    const path='/drivers/'+encodeURIComponent(id),attempt=crypto.randomUUID(),at=nowIso();
    if(await db(env,'/roles/'+encodeURIComponent(id.replace(/^auth-/,'')))!=='driver')return;
    const claimed=await mutateDb(env,path,p=>{
      if(!p || p.status!=='approved' || !p.emailVerified || p.applicationVersion!==123 || missingRequirements(p).length || !p.approvalNotice || p.approvalPush?.state==='sent' || (p.approvalPush?.state==='sending'&&Date.now()-Date.parse(p.approvalPush.at)<120000))return p;
      return {...p,approvalPush:{state:'sending',attempt,at,noticeId:p.approvalNotice.id}};
    });
    if(claimed?.approvalPush?.attempt!==attempt)return;
    let result;
    try{result=await notifyDriverApproved(env,id);}catch{result={sent:0,failed:1};}
    await mutateDb(env,path,p=>p?.approvalPush?.attempt===attempt ? {...p,approvalPush:{...p.approvalPush,state:result?.sent>0?'sent':result?.failed?'failed':'waiting_subscription',at:nowIso()}} : p);
  }
  async function flushApprovalPushes(env) {
    const drivers=await db(env,'/drivers')||{};
    for(const [id,p]of Object.entries(drivers))if(p?.status==='approved'&&p.approvalNotice&&p.approvalPush?.state!=='sent')await flushApprovalPush(env,id);
  }
  async function retryApprovalPush(request,env) { const a=await auth(request,env);await flushApprovalPush(env,a.id); }
  const safeDriver = (p) => p ? {
    id: p.id, authUid: p.authUid, email: p.email || "", name: p.name || "",
    phone: p.phone || "", dni: p.dni || "", residenceAddress: p.residenceAddress || "",
    residenceReference: p.residenceReference || "", licenseNumber: p.licenseNumber || "",
    licenseExpires: p.licenseExpires || "", vehicleType: p.vehicleType || "Moto",
    vehiclePlate: p.vehiclePlate || "", vehicleVin: p.vehicleVin || "", applicationVersion:p.applicationVersion||0,
    missingRequirements:missingRequirements(p), approvalNotice:p.approvalNotice||null, approvalPushState:p.approvalPush?.state||"",
    hasVehicleRightPhoto:!!p.vehicleRightObject,hasVehicleLeftPhoto:!!p.vehicleLeftObject,hasVinPhoto:!!p.vinObject,hasVehiclePhoto:!!p.vehicleObject, status: p.status || "pending",
    rejectionReason: p.rejectionReason || "", createdAt: p.createdAt || "",
    approvedAt: p.approvedAt || "", approvedBy: p.approvedBy || "",
    emailVerified: p.emailVerified === true,
    hasSelfie: !!p.selfieObject, hasLicensePhoto: !!p.licenseObject,
    requireDeliveryPhoto: p.requireDeliveryPhoto === true
  } : null;
  async function auth(request, env) {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) throw err("Inicia sesión.", 401);
    let user;
    try { user = await verifyFirebaseUser(token); } catch { throw err("La sesión venció. Entra nuevamente.", 401); }
    const id = "auth-" + user.localId;
    const [role, driver] = await Promise.all([
      db(env, "/roles/" + encodeURIComponent(user.localId)),
      db(env, "/drivers/" + encodeURIComponent(id))
    ]);
    return { user, id, role: role || "", driver };
  }
  function requireDriver(a, approved = true) {
    if (!a.driver) throw err("Completa primero tu solicitud de repartidor.", 403);
    if (approved && (a.role !== "driver" || a.driver.status !== "approved")) throw err("Tu cuenta todavía no ha sido aprobada para repartir.", 403);
  }
  function requireAdmin(a) {
    if (a.role !== "admin") throw err("Solo Administración puede realizar esta acción.", 403);
  }
  function latLng(input, optional = false) {
    if (optional && (input?.lat === undefined || input?.lng === undefined)) return null;
    if(input?.lat===null || input?.lng===null || String(input?.lat??'').trim()==='' || String(input?.lng??'').trim()==='')throw err("Coordenadas incompletas.",400);
    return {
      lat: number(input?.lat, -90, 90, "Latitud inválida."),
      lng: number(input?.lng, -180, 180, "Longitud inválida.")
    };
  }
  function publicOffer(order, delivery) {
    const address = String(order.address || "");
    const zone = address.split(",").slice(0, 2).join(",").trim() || "Zona por confirmar";
    return {
      id: order.id, code: order.code, zone, total: Number(order.total || 0),
      itemCount: (order.items || []).reduce((n, i) => n + Number(i.qty || 1), 0),
      ready: order.status === "listo", status: delivery.status,
      driverPay: Number(delivery.driverPay || 0), distanceKm: Number(delivery.distanceKm || 0),
      distanceSource: delivery.distanceSource || order.deliveryDistanceSource || "", deliveryZoneName: order.deliveryZoneName || "",
      tip: Number(order.tip || 0),
      pickupEtaMin: Number(delivery.pickupEtaMin || 0), deliveryEtaMin: Number(delivery.deliveryEtaMin || 0),
      offeredAt: delivery.offeredAt || order.createdAt
    };
  }
  function fullJob(order, delivery) {
    return {
      ...publicOffer(order, delivery), delivery,
      customerName: order.customerName || "Cliente", phone: order.phone || "",
      address: order.address || "", addressNotes: order.addressNotes || "",
      destinationLat: Number.isFinite(Number(order.deliveryLat)) ? Number(order.deliveryLat) : null,
      destinationLng: Number.isFinite(Number(order.deliveryLng)) ? Number(order.deliveryLng) : null,
      payment: order.payment || "", paid: !!(order.paidAt && order.invoiced),
      items: order.items || [], notes: order.notes || "", createdAt: order.createdAt || "",
      deliveredAt: delivery.deliveredAt || order.deliveredAt || "", rating: delivery.rating || null,
      deliveryPhotoRequired: delivery.deliveryPhotoRequired === true,
      hasDeliveryPhoto: !!delivery.proofObject
    };
  }
  async function quote(env, order, settings, from) {
    const restaurant = Number.isFinite(Number(settings.restaurantLat)) && Number.isFinite(Number(settings.restaurantLng))
      ? { lat: Number(settings.restaurantLat), lng: Number(settings.restaurantLng) } : null;
    const destination = Number.isFinite(Number(order.deliveryLat)) && Number.isFinite(Number(order.deliveryLng))
      ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) } : null;
    let route = null;
    if (restaurant && destination && computeRoute) {
      try { route = await computeRoute(env, restaurant, destination); } catch { route = null; }
    }
    const radians = (x) => x * Math.PI / 180;
    const air = (a, b) => {
      if (!a || !b) return 0;
      const dlat = radians(b.lat - a.lat), dlng = radians(b.lng - a.lng);
      const h = Math.sin(dlat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dlng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    const distanceKm = Number(route?.distanceKm || (order.deliveryDistanceSource === "google_routes" ? order.deliveryDistanceKm : 0) || 0);
    const fallback = Math.max(0, Number(settings.driverPayFallback || settings.deliveryFee || 0));
    // The restaurant passes through the exact delivery fee paid by the customer.
    // Tips remain separate. Fallback only applies to legacy orders that do not
    // contain a deliveryFee field at all.
    const hasCustomerFee = Object.prototype.hasOwnProperty.call(order, "deliveryFee") && Number.isFinite(Number(order.deliveryFee));
    const driverPay = Number(hasCustomerFee ? Math.max(0, Number(order.deliveryFee)) : fallback).toFixed(2);
    const deliveryEtaMin = Math.max(1, Math.ceil(Number(route?.durationMin || (distanceKm ? distanceKm / 25 * 60 : settings.waitMin || 25))));
    let pickupEtaMin = 0, pickupRoutePolyline = "";
    if (from && restaurant) {
      try {
        const pickup = computeRoute ? await computeRoute(env, from, restaurant) : null;
        pickupEtaMin = pickup ? Math.max(1, Math.ceil(Number(pickup.durationMin || 0))) : 0;
        pickupRoutePolyline = pickup?.polyline || "";
      } catch { pickupEtaMin = 0; }
    }
    return { driverPay: Number(driverPay), distanceKm: Number(distanceKm.toFixed(2)), distanceSource: route ? "google_routes" : (order.deliveryDistanceSource || ""), deliveryEtaMin, pickupEtaMin, pickupRoutePolyline, routePolyline: route?.polyline || order.deliveryRoutePolyline || "" };
  }
  async function ensureDelivery(env, order, settings) {
    let existing = await db(env, "/deliveries/" + encodeURIComponent(order.id));
    if (existing) return existing;
    const q = await quote(env, order, settings || {}, null);
    return mutateDb(env, "/deliveries/" + encodeURIComponent(order.id), current => current || {
      id: order.id, orderId: order.id, status: "available", ...q,
      pricingVersion: settings?.deliveryPricingUpdatedAt || "",
      offeredAt: nowIso(), updatedAt: nowIso(), revision: crypto.randomUUID()
    }, 5, true);
  }
  async function profile(request, env) {
    const a = await auth(request, env);
    if (request.method === "GET") {
      if (a.driver && a.user.emailVerified === true && a.driver.emailVerified !== true) {
        a.driver = await mutateDb(env, "/drivers/" + encodeURIComponent(a.id), current => current ? {...current,emailVerified:true,updatedAt:nowIso()} : current);
      }
      return json({ profile: safeDriver(a.driver) });
    }
    const input = await readBody(request);
    if (input.consent !== true && input.consent !== "on") throw err("Debes autorizar la verificación de identidad, licencia y ubicación.", 400);
    if(['admin','cashier','kitchen'].includes(a.role))throw err('Cierra la sesión del personal y usa una cuenta propia de repartidor.',403);
    if(['approved','suspended'].includes(a.driver?.status))throw err('Solicita a Administración la revisión de cambios en tu cuenta.',409);
    const previous=a.driver||{},vehicleType=clean(input.vehicleType,80),bike=vehicleType==='Bicicleta',at=nowIso();
    const saved={...previous,id:a.id,authUid:a.user.localId,email:a.user.email||'',
      name:clean(input.name,160),dni:clean(input.dni,50),phone:clean(input.phone,50),
      residenceAddress:clean(input.residenceAddress,500),residenceReference:clean(input.residenceReference,500),
      vehicleType,vehiclePlate:bike?'':clean(input.vehiclePlate,50),vehicleVin:bike?'':String(input.vehicleVin||'').trim().toUpperCase(),
      licenseNumber:bike?'':clean(input.licenseNumber,80),licenseExpires:bike?'':String(input.licenseExpires||''),
      emailVerified:a.user.emailVerified===true,status:'pending',applicationVersion:123,
      consentAt:at,createdAt:previous.createdAt||at,updatedAt:at,revision:crypto.randomUUID(),approvalNotice:null,approvalPush:null};
    for(const [kind,field]of Object.entries(documentFields))saved[field]=requiredDocuments(saved).includes(kind)?String(input[field]||previous[field]||''):'';
    await validateApplication(env,saved);
    await mutateDb(env,'/drivers/'+encodeURIComponent(a.id),current=>{
      if(JSON.stringify(current||{})!==JSON.stringify(previous))throw err('La solicitud cambió. Actualiza antes de continuar.',409);
      return saved;
    },5,true);
    await db(env,'/roles/'+encodeURIComponent(a.user.localId),{method:'PUT',body:JSON.stringify('driver_pending')});
    return json({ profile: safeDriver(saved) });
  }
  async function documentUpload(request, env, url) {
    const a = await auth(request, env);
    const kind = url.searchParams.get("kind");
    if (![...Object.keys(documentFields), "proof"].includes(kind)) throw err("Documento inválido.", 400);
    let orderId = "";
    if (kind === "proof") {
      requireDriver(a);
      orderId = clean(url.searchParams.get("orderId"), 150);
      if (!key(orderId)) throw err("Orden inválida.", 400);
      const trip = await db(env, "/deliveries/" + encodeURIComponent(orderId));
      if (!trip || trip.driverId !== a.id || trip.status !== "picked_up") throw err("La foto solo puede tomarse durante tu entrega activa al cliente.", 409);
    }
    const mime = String(request.headers.get("Content-Type") || "").split(";")[0];
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw err("Usa una imagen JPG, PNG o WebP.", 415);
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw err("La fotografía debe pesar menos de 5 MB.", 413);
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const objectName = kind === "proof"
      ? `deliveries/${orderId}/${a.user.localId}/proof-${Date.now()}.${ext}`
      : `drivers/${a.user.localId}/${kind}-${crypto.randomUUID()}.${ext}`;
    await uploadDocument(env, objectName, bytes, mime);
    if (kind === "proof") {
      const at = nowIso();
      await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
        if (!current || current.driverId !== a.id || current.status !== "picked_up") throw err("La entrega cambió de estado. Actualiza e inténtalo nuevamente.", 409);
        return { ...current, proofObject: objectName, proofUploadedAt: at, updatedAt: at, revision: crypto.randomUUID() };
      });
    }
    return json({ objectName });
  }
  async function orders(request, env) {
    const a = await auth(request, env); requireDriver(a);
    const [rawOrders, rawDeliveries, settings] = await Promise.all([db(env, "/orders"), db(env, "/deliveries"), db(env, "/settings")]);
    const deliveries = rawDeliveries || {};
    const available = [], mine = [], history = [];
    for (const order of values(rawOrders)) {
      if (order.type !== "delivery") continue;
      let delivery = deliveries[order.id];
      if (!delivery && order.status === "entregado") {
        delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(order.id), current => current || {
          id: order.id, orderId: order.id, status: "delivered", deliveredAt: order.deliveredAt || order.statusAt || order.updatedAt || nowIso(),
          updatedAt: order.updatedAt || nowIso(), revision: crypto.randomUUID(), migratedFromOrder: true
        }, 5, true);
      }
      if (!delivery) delivery = await ensureDelivery(env, order, settings || {});
      const exactCustomerFee = Object.prototype.hasOwnProperty.call(order, "deliveryFee") && Number.isFinite(Number(order.deliveryFee))
        ? Math.max(0, Number(order.deliveryFee)) : null;
      if (exactCustomerFee !== null && !["delivered", "cancelled"].includes(delivery.status) && Number(delivery.driverPay || 0) !== exactCustomerFee) {
        delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(order.id), current => current && !["delivered", "cancelled"].includes(current.status)
          ? { ...current, driverPay: exactCustomerFee, payMatchesCustomerFee: true, updatedAt: nowIso(), revision: crypto.randomUUID() }
          : current, 5, true);
      }
      if (order.status === "entregado" && delivery.status !== "delivered" && delivery.status !== "cancelled") {
        const repairedStatus = delivery.status === "picked_up" ? "camino" : "listo";
        await mutateDb(env, "/orders/" + encodeURIComponent(order.id), current => current && current.status === "entregado"
          ? { ...current, status: repairedStatus, deliveredAt: "", deliveredBy: "", updatedAt: nowIso(), revision: crypto.randomUUID(), deliveryRepairAt: nowIso() }
          : current);
        order.status = repairedStatus;
      }
      if (delivery.status === "delivered" && order.status !== "entregado") {
        const at = delivery.deliveredAt || nowIso();
        await mutateDb(env, "/orders/" + encodeURIComponent(order.id), current => current && current.status !== "cancelado"
          ? { ...current, status: "entregado", deliveredAt: current.deliveredAt || at, deliveredBy: current.deliveredBy || delivery.driverId, statusAt: at, updatedAt: at, revision: crypto.randomUUID() }
          : current);
        order.status = "entregado";
      }
      // Repairs points for deliveries completed by older versions. The rewards
      // ledger in access.award makes this safe to run repeatedly.
      if (delivery.status === "delivered" && awardOrder) await awardOrder(env, order);
      if (delivery.driverId === a.id && ["delivered", "cancelled"].includes(delivery.status)) {
        history.push(fullJob(order, delivery));
        continue;
      }
      if (order.status === "cancelado") continue;
      if (delivery.status === "available" && !delivery.driverId && (!(Number(delivery.driverPay) > 0) || delivery.pricingVersion !== (settings?.deliveryPricingUpdatedAt || ""))) {
        const q = await quote(env, order, settings || {}, null);
        delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(order.id), current => {
          if (!current || current.status !== "available" || current.driverId) return current;
          return { ...current, ...q, pricingVersion: settings?.deliveryPricingUpdatedAt || "", updatedAt: nowIso(), revision: crypto.randomUUID() };
        }, 5, true);
      }
      if (delivery.status === "available" && !delivery.driverId && !delivery.declinedBy?.[a.id]) available.push(publicOffer(order, delivery));
      if (delivery.driverId === a.id && !["delivered", "cancelled"].includes(delivery.status)) mine.push(fullJob(order, delivery));
    }
    history.sort((x,y)=>String(y.deliveredAt || y.createdAt).localeCompare(String(x.deliveredAt || x.createdAt)));
    return json({ available, mine, history: history.slice(0,50), profile: safeDriver(a.driver), serverTime: Date.now() });
  }
  async function accept(request, env) {
    const a = await auth(request, env); requireDriver(a);
    const input = await readBody(request); const orderId = clean(input.orderId, 150);
    if (!key(orderId)) throw err("Orden inválida.", 400);
    const [order, settings] = await Promise.all([db(env, "/orders/" + encodeURIComponent(orderId)), db(env, "/settings")]);
    if (!order || order.type !== "delivery" || ["cancelado", "entregado"].includes(order.status)) throw err("Esta orden ya no está disponible.", 409);
    const from = latLng(input.location, true);
    const q = await quote(env, order, settings || {}, from);
    if (!(q.driverPay > 0)) throw err("Administración todavía no configuró el pago de esta entrega.", 409);
    const at = nowIso();
    const delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
      current = current || { id: orderId, orderId, status: "available", offeredAt: at };
      if (current.driverId && current.driverId !== a.id) throw err("Otro repartidor aceptó esta orden.", 409);
      if (current.status !== "available" && current.driverId !== a.id) throw err("Esta orden ya no está disponible.", 409);
      const firstPoint=from?{...from,accuracy:Number(input.location?.accuracy || 0),heading:null,speed:null,at}:null;
      return { ...current, ...q, driverId: a.id, driverName: a.driver.name, status: "accepted",
        deliveryPhotoRequired: a.driver.requireDeliveryPhoto === true,
        ...(firstPoint?{location:firstPoint,trail:[firstPoint]}:{}), acceptedAt: current.acceptedAt || at, updatedAt: at, revision: crypto.randomUUID() };
    }, 5, true);
    if (notifyCustomer) await notifyCustomer(env, order, "Repartidor asignado", `${a.driver.name} aceptó la entrega de ${order.code || order.id}.`).catch(()=>null);
    return json({ job: fullJob(order, delivery) });
  }
  async function rejectOffer(request, env) {
    const a = await auth(request, env); requireDriver(a);
    const input = await readBody(request); const orderId = clean(input.orderId, 150);
    const delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
      if (!current || current.status !== "available" || current.driverId) throw err("La entrega ya no está disponible.", 409);
      return { ...current, declinedBy: { ...(current.declinedBy || {}), [a.id]: nowIso() }, updatedAt: nowIso(), revision: crypto.randomUUID() };
    });
    return json({ ok: true, delivery });
  }
  async function location(request, env) {
    const a = await auth(request, env); requireDriver(a);
    const input = await readBody(request); const orderId = clean(input.orderId, 150);
    const capturedAt=input.capturedAt===undefined?Date.now():Number(input.capturedAt);
    if(!Number.isFinite(capturedAt) || Date.now()-capturedAt>30000 || capturedAt-Date.now()>5000)throw err("La ubicación está desactualizada. Obtén una nueva lectura GPS.",400);
    const point = { capturedAt, ...latLng(input), accuracy: number(input.accuracy, 0.01, 100, "Precisión inválida."),
      heading: Number.isFinite(Number(input.heading)) ? Number(input.heading) : null,
      speed: Number.isFinite(Number(input.speed)) ? Math.max(0, Number(input.speed)) : null, at: nowIso() };
    const delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
      if (!current || current.driverId !== a.id || !["accepted", "heading_pickup", "picked_up"].includes(current.status)) throw err("No tienes esta entrega activa.", 403);
      if(current.location?.capturedAt && capturedAt<=current.location.capturedAt)return current;
      const trail = Array.isArray(current.trail) ? current.trail.slice(-239) : [];
      const last = trail[trail.length - 1];
      if (!last || Date.parse(point.at) - Date.parse(last.at) >= 4000) trail.push(point);
      return { ...current, location: point, trail, updatedAt: point.at, revision: crypto.randomUUID() };
    });
    return json({ location: delivery.location });
  }
  async function status(request, env) {
    const a = await auth(request, env); requireDriver(a);
    const input = await readBody(request); const orderId = clean(input.orderId, 150); const nextStatus = clean(input.status, 40);
    const allowed = { accepted: ["heading_pickup"], heading_pickup: ["picked_up"], picked_up: ["delivered"] };
    const order = await db(env, "/orders/" + encodeURIComponent(orderId));
    if (!order) throw err("La orden ya no existe.", 404);
    if (["picked_up", "delivered"].includes(nextStatus) && (!order.invoiced || !order.paidAt)) throw err("Caja debe cobrar y facturar la orden antes de entregarla al repartidor.", 409);
    const at = nowIso();
    const delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
      if (!current || current.driverId !== a.id) throw err("Esta entrega no te pertenece.", 403);
      if (current.status === nextStatus) return current;
      if (!(allowed[current.status] || []).includes(nextStatus)) throw err("Completa los pasos de entrega en orden.", 409);
      if (nextStatus === "delivered" && a.driver.requireDeliveryPhoto === true && !current.proofObject) throw err("Toma la foto de entrega antes de confirmar.", 409);
      if (nextStatus === "delivered" && order.deliveryCode && String(input.deliveryCode || "").replace(/\D/g, "") !== String(order.deliveryCode)) throw err("El código de entrega no coincide. Pídeselo al cliente al recibir la orden.", 409);
      const patch = { status: nextStatus, updatedAt: at, revision: crypto.randomUUID() };
      if (nextStatus === "heading_pickup") { patch.headingPickupAt = at; patch.pickupEtaSharedMin = Math.max(1, Math.min(180, Number(input.pickupEtaMin || current.pickupEtaMin || 1))); }
      if (nextStatus === "picked_up") patch.pickedUpAt = at;
      if (nextStatus === "delivered") patch.deliveredAt = at;
      return { ...current, ...patch };
    });
    let savedOrder = order;
    if (nextStatus === "picked_up" || nextStatus === "delivered") {
      savedOrder = await mutateDb(env, "/orders/" + encodeURIComponent(orderId), current => {
        if (!current) throw err("Orden inexistente.", 404);
        const statusValue = nextStatus === "picked_up" ? "camino" : "entregado";
        return { ...current, status: statusValue, statusAt: at, statusBy: a.id, updatedAt: at,
          ...(statusValue === "entregado" ? { deliveredAt: current.deliveredAt || at, deliveredBy: a.id } : {}), revision: crypto.randomUUID() };
      });
    }
    // Delivery completion used to bypass the normal staff status endpoint, so
    // the idempotent rewards ledger never ran. Award only after the paid and
    // invoiced order has been committed as delivered.
    if (nextStatus === "delivered" && awardOrder) await awardOrder(env, savedOrder);
    if (notifyCustomer && ["heading_pickup","picked_up","delivered"].includes(nextStatus)) {
      const notices={
        heading_pickup:["Tu repartidor va al restaurante",`${a.driver.name} se dirige a recoger ${order.code || order.id}.`],
        picked_up:["¡Tu pedido va en camino!",`${a.driver.name} recogió ${order.code || order.id}. Abre la app para seguir la ruta.`],
        delivered:["Pedido entregado",`${order.code || order.id} fue marcado como entregado. Cuéntanos cómo fue tu experiencia.`]
      };
      await notifyCustomer(env, savedOrder, notices[nextStatus][0], notices[nextStatus][1]).catch(()=>null);
    }
    return json({ delivery });
  }
  async function track(request, env, orderId) {
    const a = await auth(request, env);
    const [order, delivery] = await Promise.all([db(env, "/orders/" + encodeURIComponent(orderId)), db(env, "/deliveries/" + encodeURIComponent(orderId))]);
    if (!order || !delivery) throw err("Seguimiento no disponible.", 404);
    if (a.role !== "admin" && order.userId !== a.id) throw err("Esta orden no pertenece a tu cuenta.", 403);
    if (delivery.status === "delivered" && order.status !== "entregado" && order.status !== "cancelado") {
      const at=delivery.deliveredAt || nowIso();
      await mutateDb(env, "/orders/" + encodeURIComponent(orderId), current => current && current.status !== "cancelado"
        ? { ...current, status:"entregado", deliveredAt:current.deliveredAt || at, deliveredBy:current.deliveredBy || delivery.driverId, statusAt:at, updatedAt:at, revision:crypto.randomUUID() }
        : current);
    }
    const visible = a.role === "admin" || ["picked_up", "delivered"].includes(delivery.status);
    return json({ status: delivery.status, driverName: visible ? delivery.driverName || "Tu repartidor" : "",
      deliveryEtaMin: Number(delivery.deliveryEtaMin || 0), pickedUpAt: delivery.pickedUpAt || "",
      deliveredAt: delivery.deliveredAt || "", location: visible ? delivery.location || null : null,
      trail: visible ? delivery.trail || [] : [], routePolyline: visible ? delivery.routePolyline || "" : "", rating: delivery.rating || null,
      distanceKm: Number(delivery.distanceKm || 0) });
  }
  async function rating(request, env) {
    const a = await auth(request, env); const input = await readBody(request);
    const orderId = clean(input.orderId, 150);
    const legacyScores = {"😍":5,"😊":4,"😐":3,"😞":1};
    const score = input.score === undefined ? legacyScores[String(input.emoji || "")] : Number(input.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) throw err("Elige una calificación del 1 al 5.", 400);
    const emoji = ({1:"😞",2:"🙁",3:"😐",4:"😊",5:"😍"})[score];
    const order = await db(env, "/orders/" + encodeURIComponent(orderId));
    if (!order || order.userId !== a.id || order.status !== "entregado") throw err("Solo puedes calificar una entrega completada de tu cuenta.", 403);
    const delivery = await mutateDb(env, "/deliveries/" + encodeURIComponent(orderId), current => {
      if (!current || current.status !== "delivered") throw err("La entrega aún no terminó.", 409);
      if (current.rating) return current;
      return { ...current, rating: { emoji, score, note: String(input.note || "").trim().slice(0, 300), at: nowIso(), customerId: a.id }, updatedAt: nowIso() };
    });
    await mutateDb(env, "/orders/" + encodeURIComponent(orderId), current => current
      ? { ...current, deliveryRating: delivery.rating, updatedAt: nowIso() }
      : current);
    return json({ rating: delivery.rating });
  }
  async function admin(request, env) {
    const a = await auth(request, env); requireAdmin(a);
    if (request.method === "GET") {
      const [drivers, deliveries, settings] = await Promise.all([db(env, "/drivers"), db(env, "/deliveries"), db(env, "/settings")]);
      const s = settings || {};
      return json({ drivers: values(drivers).map(safeDriver), deliveries: values(deliveries).filter(d=>!d.testArchivedAt), settings: {
        restaurantLat: s.restaurantLat ?? "", restaurantLng: s.restaurantLng ?? "", restaurantAddress: s.restaurantAddress || s.address || "",
        driverPayBase: Number(s.driverPayBase || 0), driverPayPerKm: Number(s.driverPayPerKm || 0), driverPayFallback: Number(s.driverPayFallback || s.deliveryFee || 0),
        deliveryCustomerFee1: Number(s.deliveryCustomerFee1 ?? 30), deliveryCustomerFee3: Number(s.deliveryCustomerFee3 ?? 35),
        deliveryCustomerFee65: Number(s.deliveryCustomerFee65 ?? 75), deliveryCustomerFee8: Number(s.deliveryCustomerFee8 ?? 110),
        deliveryCustomerMaxKm: Number(s.deliveryCustomerMaxKm || 8), deliveryNationwideTestEnabled: s.deliveryNationwideTestEnabled !== false, blockedDeliveryZones: s.blockedDeliveryZones || "",
        deliveryFixedZoneEnabled: s.deliveryFixedZoneEnabled !== false, deliveryFixedZoneName: s.deliveryFixedZoneName || "Zona por configurar", deliveryFixedZoneFee: Number(s.deliveryFixedZoneFee ?? 35)
      } });
    }
    const input = await readBody(request); const action = clean(input.action, 30);
    if (action === "settings") {
      const current = await db(env, "/settings") || {};
      const restaurant = latLng(input);
      const next = { ...current, restaurantLat: restaurant.lat, restaurantLng: restaurant.lng,
        restaurantAddress: clean(input.restaurantAddress, 500), driverPayBase: number(input.driverPayBase, 0, 10000),
        driverPayPerKm: number(input.driverPayPerKm, 0, 1000), driverPayFallback: number(input.driverPayFallback, 0, 10000),
        deliveryCustomerFee1: number(input.deliveryCustomerFee1, 0, 10000), deliveryCustomerFee3: number(input.deliveryCustomerFee3, 0, 10000),
        deliveryCustomerFee65: number(input.deliveryCustomerFee65, 0, 10000), deliveryCustomerFee8: number(input.deliveryCustomerFee8, 0, 10000),
        deliveryCustomerMaxKm: number(input.deliveryCustomerMaxKm, .1, 50000), deliveryNationwideTestEnabled: input.deliveryNationwideTestEnabled !== false, blockedDeliveryZones: String(input.blockedDeliveryZones || "").trim().slice(0,2000),
        deliveryFixedZoneEnabled: input.deliveryFixedZoneEnabled !== false, deliveryFixedZoneName: clean(input.deliveryFixedZoneName || "Zona por configurar", 120), deliveryFixedZoneFee: number(input.deliveryFixedZoneFee ?? 35, 0, 10000),
        deliveryPricingUpdatedAt: nowIso() };
      await db(env, "/settings", { method: "PUT", body: JSON.stringify(next) });
      return json({ settings: next });
    }
    const driverId = clean(input.driverId, 150); if (!key(driverId)) throw err("Repartidor inválido.", 400);
    const driver = await db(env, "/drivers/" + encodeURIComponent(driverId));
    if (!driver) throw err("Solicitud inexistente.", 404);
    if (action === "photo_requirement") {
      const saved = await mutateDb(env, "/drivers/" + encodeURIComponent(driverId), current => current ? {...current,requireDeliveryPhoto:input.required===true,updatedAt:nowIso()} : current);
      return json({ profile: safeDriver(saved) });
    }
    if (!["approve", "reject", "suspend"].includes(action)) throw err("Acción inválida.", 400);
    if(action==='approve'){
      if(driver.emailVerified!==true)throw err('El repartidor debe confirmar su correo antes de ser aprobado.',409);
      await validateApplication(env,driver);
    }
    const statusValue=action==='approve'?'approved':action==='reject'?'rejected':'suspended',at=nowIso();
    const saved=await mutateDb(env,'/drivers/'+encodeURIComponent(driverId),current=>{
      if(JSON.stringify(current)!==JSON.stringify(driver))throw err('La solicitud cambió. Revísala nuevamente.',409);
      if(action==='approve'&&current.status==='approved')return current;
      return {...current,status:statusValue,rejectionReason:action==='reject'?String(input.reason||'').trim().slice(0,300):'',
        approvedAt:action==='approve'?at:current.approvedAt||'',approvedBy:action==='approve'?a.id:current.approvedBy||'',updatedAt:at,
        ...(action==='approve'?{applicationVersion:123,approvalNotice:{id:crypto.randomUUID(),title:'Solicitud aprobada',body:'Tu solicitud fue aprobada. Ya puedes entrar al portal y recibir entregas.',at},approvalPush:{state:'pending',at}}:{approvalPush:null,approvalNotice:null})};
    });
    await db(env,'/roles/'+encodeURIComponent(driver.authUid),{method:'PUT',body:JSON.stringify(action==='approve'?'driver':'driver_'+statusValue)});
    if(action==='approve')await flushApprovalPush(env,driverId).catch(()=>{});
    return json({ profile: safeDriver(saved) });
  }
  async function documentRead(request, env, driverId, kind) {
    const a = await auth(request, env); requireAdmin(a);
    const driver = await db(env, "/drivers/" + encodeURIComponent(driverId));
    if (!driver) throw err("Repartidor inexistente.", 404);
    const objectName = Object.hasOwn(documentFields,kind) ? driver[documentFields[kind]] : "";
    if (!objectName) throw err("Documento inexistente.", 404);
    return readDocument(env, objectName);
  }
  async function proofRead(request, env, orderId) {
    const a = await auth(request, env); requireAdmin(a);
    if (!key(orderId)) throw err("Orden inválida.", 400);
    const delivery = await db(env, "/deliveries/" + encodeURIComponent(orderId));
    if (!delivery?.proofObject) throw err("Esta entrega no tiene foto.", 404);
    return readDocument(env, delivery.proofObject);
  }
  async function avatar(request, env) {
    const a = await auth(request, env); requireDriver(a, false);
    if (!a.driver?.selfieObject) throw err("Fotografía no disponible.", 404);
    return readDocument(env, a.driver.selfieObject);
  }
  return { flushApprovalPushes, retryApprovalPush, profile, documentUpload, orders, accept, rejectOffer, location, status, track, rating, admin, documentRead, proofRead, avatar };
}
