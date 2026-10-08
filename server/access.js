// Server-only authorization. No request can choose an arbitrary Firebase path.
export function createAccess({db, mutateDb, verifyFirebaseUser, json, computeRoute, onOrderCreated, expireShifts=async()=>{}, isShiftExpired=()=>false, schedule=globalThis.ChingadazoHours}) {
  const values = x => x ? Object.values(x).filter(Boolean) : [];
  const staffRoles = ['admin','cashier','kitchen'];
  const publicNodes = ['products','categories','catalog','settings'];
  const key = x => /^[A-Za-z0-9_-]{1,150}$/.test(x || '');
  const error = (message,status=403) => Object.assign(new Error(message),{status});
  const text = (x,max=300) => {
    const s=String(x || '').trim();
    if(s.length>max || /[<>"`]/.test(s)) throw error('Texto inválido o demasiado largo.',400);
    return s;
  };
  const strip = p => {
    if(!p) return p;
    const {password,pin,rewardLedger,redemptions,storyRequests,...safe}=p;
    return safe;
  };
  const kitchenOrder = p => {
    const {dni,email,phone,address,addressNotes,...safe}=p;
    return safe;
  };
  const hnDay = value => {
    const parts=new Intl.DateTimeFormat('en-GB',{
      timeZone:'America/Tegucigalpa',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(value ? new Date(value) : new Date());
    const get=t=>parts.find(p=>p.type===t)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const orderDay = p => hnDay(p?.scheduledFor || p?.createdAt || p?.statusAt);
  const radians = x => x * Math.PI / 180;
  const airKm = (a,b) => {
    if(!a || !b)return 0;
    const dlat=radians(b.lat-a.lat),dlng=radians(b.lng-a.lng);
    const h=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  };
  async function customerDeliveryQuote(env,s,input,address) {
    const validCoordinate=(v,max)=>v!==null && v!==undefined && String(v).trim()!=='' && Number.isFinite(Number(v)) && Math.abs(Number(v))<=max;
    if(!validCoordinate(s.restaurantLat,90) || !validCoordinate(s.restaurantLng,180) || !validCoordinate(input.deliveryLat,90) || !validCoordinate(input.deliveryLng,180))throw error('Confirma las coordenadas de entrega y del restaurante.',400);
    if(!Number.isFinite(Number(input.deliveryAccuracy)) || Number(input.deliveryAccuracy)<=0 || Number(input.deliveryAccuracy)>100)throw error('Activa Ubicación precisa y confirma nuevamente el GPS.',409);
    if(input.deliveryCapturedAt!==undefined && (!Number.isFinite(Number(input.deliveryCapturedAt)) || Date.now()-Number(input.deliveryCapturedAt)>300000 || Number(input.deliveryCapturedAt)-Date.now()>5000))throw error('Confirma nuevamente tu ubicación antes de pedir.',409);

    const origin=Number.isFinite(Number(s.restaurantLat))&&Number.isFinite(Number(s.restaurantLng))?{lat:Number(s.restaurantLat),lng:Number(s.restaurantLng)}:null;
    const destination=Number.isFinite(Number(input.deliveryLat))&&Number.isFinite(Number(input.deliveryLng))?{lat:Number(input.deliveryLat),lng:Number(input.deliveryLng)}:null;
    if(!origin || !destination)throw error('Confirma tu ubicación exacta para calcular el envío.',400);
    if(Number.isInteger(origin.lat) || Number.isInteger(origin.lng))throw error('Administración debe guardar las coordenadas completas del restaurante; no uses una longitud recortada como -87.',409);
    const blocked=String(s.blockedDeliveryZones || '').split(/[,\n;]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    const normalized=String(address || '').toLowerCase();
    const blockedMatch=blocked.find(x=>normalized.includes(x));
    if(blockedMatch)throw error('Delivery no disponible en esta zona. Comunícate con el restaurante para consultar.',409);
    const zoneId=String(input.deliveryZoneId || 'route');
    const fixedEnabled=s.deliveryFixedZoneEnabled!==false;
    const fixedName=String(s.deliveryFixedZoneName || 'Zona por configurar');
    const plain=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const fixedZone=zoneId==='altos-chingadazo' && fixedEnabled;
    if(fixedZone && !plain(address).includes(plain(fixedName)))throw error(`La tarifa fija de L. ${Number(s.deliveryFixedZoneFee ?? 35).toFixed(0)} es únicamente para direcciones dentro de ${fixedName}. Para otra dirección selecciona “Otra zona”.`,409);
    let route=null;
    try {route=computeRoute?await computeRoute(env,origin,destination):null;} catch {}
    const nationwideTest=s.deliveryNationwideTestEnabled!==false;
    if(!route && !fixedZone && !nationwideTest)throw error('No se pudo calcular una ruta real por carretera. Administración debe revisar la clave de Google Routes antes de aceptar pedidos fuera de Zona por configurar.',503);
    const distance=Math.max(0,Number(route?.distanceKm || airKm(origin,destination) || 0));
    const max=Math.max(.1,Number(s.deliveryCustomerMaxKm || 8));
    if(!fixedZone && !nationwideTest && distance>max)throw error(`La ruta real está a ${distance.toFixed(1)} km. Consulta disponibilidad para entregas de más de ${max} km.`,409);
    const fee=fixedZone?Number(s.deliveryFixedZoneFee ?? 35):distance<=1?Number(s.deliveryCustomerFee1 ?? 30):distance<=3?Number(s.deliveryCustomerFee3 ?? 35):distance<=6.5?Number(s.deliveryCustomerFee65 ?? 75):Number(s.deliveryCustomerFee8 ?? 110);
    return {fee:Math.max(0,fee),distanceKm:Number(distance.toFixed(2)),etaMin:Math.max(1,Math.ceil(Number(route?.durationMin || (distance ? distance/25*60 : s.waitMin || 25)))),routePolyline:route?.polyline || '',pricingMode:fixedZone?'fixed_zone':(nationwideTest?'nationwide_test':'google_route'),distanceSource:route?'google_routes':(nationwideTest?'air_distance_test':'fixed_zone'),deliveryZoneId:fixedZone?'altos-chingadazo':'route',deliveryZoneName:fixedZone?fixedName:(nationwideTest?'Honduras · modo de pruebas':'Otra zona'),nationwideTest};
  }
  async function promoteDueOrders(env, raw) {
    const now=Date.now();
    for(const p of values(raw)) {
      if(p.status!=='programado' || !p.scheduledFor || Date.parse(p.scheduledFor)>now) continue;
      const saved=await mutateDb(env,'/orders/'+p.id,current=>{
        if(!current || current.status!=='programado' || Date.parse(current.scheduledFor)>Date.now())return current;
        const at=new Date().toISOString();
        return {...current,status:'nuevo',statusAt:at,updatedAt:at,revision:crypto.randomUUID(),scheduledActivatedAt:at};
      });
      if(raw && typeof raw==='object')raw[p.id]=saved;
    }
    return raw;
  }
  async function identity(request,env) {
    const token=(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'');
    if(!token) return null;
    let user;
    try {user=await verifyFirebaseUser(token);} catch {throw error('Vuelve a iniciar sesión.',401);}
    const role=await db(env,'/roles/'+user.localId);
    const profile=await db(env,'/users/auth-'+user.localId);
    if(profile?.active===false) throw error('Usuario desactivado.');
    return {user,id:'auth-'+user.localId,role:staffRoles.includes(role)?role:'customer'};
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
  async function profileSave(env,a,id,input) {
    if(id!==a.id && a.role!=='admin' && a.role!=='cashier') throw error('Perfil no autorizado.');
    const old=await db(env,'/users/'+id);

    if(id!==a.id && old && old.role!=='customer') throw error('Usa Usuarios y roles para administrar al personal.');
    if(id!==a.id && !old && id.startsWith('auth-')) throw error('Ese perfil requiere su propia sesión.');
    const settings=await db(env,'/settings') || {};
    const result=await mutateDb(env,'/users/'+id,p=>{
      const now=new Date().toISOString();
      const fresh=!p;
      p=p || {id,role:id===a.id?a.role:'customer',points:0,createdAt:now};
      if(id===a.id ? a.role==='customer' : p.role==='customer'){
        if(input.phone!==undefined){const phone=customerPhone(input.phone);if(!phone)throw error('El teléfono debe tener exactamente 8 dígitos de Honduras.',400);input={...input,phone};}
        if(input.dni!==undefined){const dni=customerDni(input.dni);if(!dni)throw error('La identidad debe tener exactamente 13 dígitos.',400);input={...input,dni};}
        const merged={...p,...input};
        if(id===a.id && (!String(merged.name||'').trim() || !customerPhone(merged.phone) || !customerDni(merged.dni) || !String(merged.addresses?.[0]?.line||'').trim()))throw error('Completa nombre, teléfono de 8 dígitos, identidad de 13 dígitos y dirección.',400);
      }
      for(const k of ['name','phone','dni']) if(input[k]!==undefined) p[k]=text(input[k],160);
      if(input.addresses!==undefined) {
        if(!Array.isArray(input.addresses) || input.addresses.length>10) throw error('Direcciones inválidas.',400);
        p.addresses=input.addresses.map(ad=>({id:text(ad.id,150),label:text(ad.label,80),line:text(ad.line,500)}));
      }
      if(id===a.id) {
        p.role=a.role;p.authUid=a.user.localId;p.email=a.user.email || '';
        p.authProvider=a.user.providerUserInfo?.[0]?.providerId || 'custom';
        p.emailVerified=a.user.emailVerified===true;
        if(fresh && a.role==='customer') p.pendingWelcomeBonus=Math.max(0,Number(settings.welcomeBonus ?? 500));
        if(a.role==='customer' && p.emailVerified && !p.welcomeBonus && Number(p.pendingWelcomeBonus)>0) {
          const bonus=Math.min(100000,Number(p.pendingWelcomeBonus));
          p.points=Number(p.points || 0)+bonus;p.welcomeBonus=bonus;p.welcomeAt=now;
          p.pendingWelcomeBonus=0;p.pointsUpdatedAt=now;
        }
      } else if(!old) p.email=text(input.email,160);
      p.password='';p.pin='';p.updatedAt=now;p.pendingSync=false;
      return p;
    },5,true);
    return strip(result);
  }
  async function award(env,o) {
    if(!o || o.securityVersion!==72 || o.status!=='entregado' || !o.invoiced || !o.paidAt || !key(o.userId)) return;
    const p=await db(env,'/users/'+o.userId);
    if(!p || p.role!=='customer') return;
    await mutateDb(env,'/users/'+o.userId,u=>{
      u.rewardLedger=u.rewardLedger || {};
      if(!u.rewardLedger[o.id]) {
        const pts=Math.max(0,Number(o.pointsEarned || 0));
        u.points=Number(u.points || 0)+pts;u.rewardLedger[o.id]=pts || true;
        u.pointsUpdatedAt=new Date().toISOString();
      }
      return u;
    });
  }
  function priceItems(catalog,input) {
    if(!Array.isArray(input)||!input.length||input.length>50)throw error('Pedido inválido.',400);
    const products=values(catalog);
    return input.map(i=>{
      const p=products.find(p=>p.id===i?.productId);
      if(!p || p.available===false || !Number.isInteger(i.qty) || i.qty<1 || i.qty>50)throw error('Producto no disponible o cantidad inválida.',400);
      if(i.mods!=null && (typeof i.mods!=='object'||Array.isArray(i.mods)||Object.keys(i.mods).some(id=>!(p.modifiers||[]).some(g=>g.id===id))))throw error('Opción inválida.',400);
      let unit=Number(p.price);const labels=[],mods={};
      for(const g of p.modifiers||[]) {
        const sel=i.mods?.[g.id],ids=sel==null?[]:Array.isArray(sel)?sel:[sel];
        if((g.required&&!ids.length)||(!g.multi&&ids.length>1)||new Set(ids).size!==ids.length)throw error('Revisa las opciones del producto.',400);
        const names=[];
        for(const oid of ids){const opt=(g.options||[]).find(o=>o.id===oid);if(!opt)throw error('Opción inválida.',400);unit+=Number(opt.price||0);names.push(opt.name);}
        mods[g.id]=sel||[];if(names.length)labels.push(g.name+': '+names.join(', '));
      }
      if(!Number.isFinite(unit)||unit<0)throw error('Precio sin configurar.',400);
      const image=String(p.image||'').startsWith('media:')?'/api/media/'+encodeURIComponent(p.id):String(p.image||'');
      return {productId:p.id,name:p.name,image,qty:i.qty,unit,mods,modsText:labels.join(' · '),note:text(i.note,500)};
    });
  }
  async function quoteItems(env,items){return priceItems(await db(env,'/products'),items);}
  async function createOrder(env,a,id,input) {
    if(id.startsWith('dining-')||input.diningAccountId)throw error('Usa el cobro de mesas.',409);
    if(!Array.isArray(input.items) || !input.items.length || input.items.length>50) throw error('Pedido inválido.',400);
    const customer=a.role==='customer';
    if(!customer && !['admin','cashier'].includes(a.role)) throw error('Cocina no puede crear cobros.');
    const [catalog,settings,profile]=await Promise.all([db(env,'/products'),db(env,'/settings'),db(env,'/users/'+a.id)]);
    const s=settings || {};
    if (customer && s.weeklyHours) {
      if (!schedule?.validate(s.weeklyHours) || s.open !== true) throw error('Los pedidos están pausados temporalmente.',409);
      const when=input.scheduledFor ? new Date(input.scheduledFor) : new Date();
      if (!Number.isFinite(when.getTime()) || !schedule.active(s,when)) throw error('El horario seleccionado está fuera de atención.',409);
    }
    if(customer && input.type==='delivery' && s.deliveryEnabled===false)throw error('El delivery está pausado. En este momento solamente puedes ordenar Para llevar.',409);
    if(customer && (!a.user.emailVerified || !customerPhone(profile?.phone) || !customerDni(profile?.dni))) throw error('Confirma tu correo y completa tu perfil antes de pedir.',400);
    const familyCode=customer?String(input.familyCode || '').replace(/\D/g,''):'';
    let familyRoom=null;
    if(familyCode){
      if(!/^\d{6}$/.test(familyCode))throw error('Código familiar inválido.',400);
      familyRoom=await db(env,'/familyRooms/'+familyCode);
      if(!familyRoom || familyRoom.organizerId!==a.id || familyRoom.status!=='open' || Date.parse(familyRoom.expiresAt || 0)<=Date.now())throw error('El pedido familiar ya no está disponible.',409);
    }
    const items=priceItems(catalog,input.items);
    const subtotal=items.reduce((v,i)=>v+i.qty*i.unit,0);
    if(customer && subtotal<Number(s.minOrder || 0))throw error('No alcanza el pedido mínimo.',400);
    const tax=customer?Math.round(subtotal*Number(s.taxRate || 0)*100)/100:0;
    const deliveryQuote=customer && input.type==='delivery'?await customerDeliveryQuote(env,s,input,input.address):null;
    const deliveryFee=deliveryQuote?deliveryQuote.fee:0;
    const tip=customer && input.type==='delivery'?Math.round(Math.max(0,Math.min(10000,Number(input.tip || 0)))*100)/100:0;
    const redeemPts=Number(input.redeemPts || 0);
    if(redeemPts && (!customer || redeemPts!==1100 || !items.some(i=>['torta-mexicana','mega-torta'].includes(i.productId)))) throw error('Canje inválido.',400);
    const total=Math.max(0,Math.round((subtotal+tax+deliveryFee+tip-(redeemPts?110:0))*100)/100);
    if(input.type!=='delivery' && Math.abs(Number(input.total)-total)>0.01)throw error('El precio cambió. Actualiza el carrito antes de confirmar.',409);
    if(!['Efectivo','Tarjeta','Transferencia'].includes(input.payment))throw error('Forma de pago inválida.',400);
    const now=new Date().toISOString();
    const deliveryLat=input.type==='delivery' && input.deliveryLat!==null && input.deliveryLat!==undefined?Number(input.deliveryLat):null;
    const deliveryLng=input.type==='delivery' && input.deliveryLng!==null && input.deliveryLng!==undefined?Number(input.deliveryLng):null;
    const deliveryAccuracy=input.type==='delivery'?Number(input.deliveryAccuracy || 0):0;
    if(input.type==='delivery' && ((deliveryLat!==null && (!Number.isFinite(deliveryLat) || deliveryLat < -90 || deliveryLat > 90)) || (deliveryLng!==null && (!Number.isFinite(deliveryLng) || deliveryLng < -180 || deliveryLng > 180))))throw error('Ubicación de entrega inválida.',400);
    if(customer && input.type==='delivery' && (!Number.isFinite(deliveryAccuracy) || deliveryAccuracy<=0 || deliveryAccuracy>100))throw error('No se pudo confirmar una ubicación confiable. Activa la ubicación del teléfono e inténtalo nuevamente.',400);
    if(customer && input.type==='delivery' && deliveryAccuracy>100)throw error(`La precisión es de ±${Math.round(deliveryAccuracy)} m. Activa “Ubicación precisa” e inténtalo nuevamente.`,409);
    const deliveryCode=input.type==='delivery' && s.deliveryCodeRequired!==false?String(1000+crypto.getRandomValues(new Uint32Array(1))[0]%9000):'';
    const order={id,code:'CH-'+id.slice(-8).toUpperCase(),createdAt:now,updatedAt:now,securityVersion:72,
      userId:customer?a.id:(key(input.userId)?input.userId:a.id),customerName:customer?profile.name:text(input.customerName,160),
      phone:customer?profile.phone:text(input.phone,50),dni:customer?profile.dni:'',email:customer?a.user.email || '':'',
      source:customer?'app':'caja',channel:customer?'app':text(input.channel,30),
      type:input.type==='delivery'?'delivery':'pickup',address:text(input.address,500),addressNotes:text(input.addressNotes,500),deliveryLat,deliveryLng,deliveryAccuracy:Math.max(0,deliveryAccuracy),notes:text(input.notes,1000),
      payment:input.payment,needsChange:input.payment==='Efectivo' && input.needsChange===true,payWith:Number(input.payWith || 0),
      items,subtotal,tax,deliveryFee,tip,total,redeemPts,redeemValue:redeemPts?110:0,pointsEarned:Math.floor(Math.max(0,subtotal+tax-(redeemPts?110:0))/100)*10*(s.doublePoints?2:1),pointsGranted:false,
      familyCode,deliveryCode,status:'nuevo',paidAt:'',invoiced:false};
    if(deliveryQuote){order.deliveryDistanceKm=deliveryQuote.distanceKm;order.deliveryEtaMin=deliveryQuote.etaMin;order.deliveryRoutePolyline=deliveryQuote.routePolyline;order.deliveryDistanceSource=deliveryQuote.distanceSource;order.deliveryPricingMode=deliveryQuote.pricingMode;order.deliveryZoneId=deliveryQuote.deliveryZoneId;order.deliveryZoneName=deliveryQuote.deliveryZoneName;}
    if(!Number.isFinite(order.payWith) || order.payWith<0)throw error('Monto inválido.',400);
    if(input.scheduledFor && customer){
      const t=Date.parse(input.scheduledFor);
      if(!Number.isFinite(t) || t<Date.now() || t>Date.now()+7*86400000)throw error('Horario inválido.',400);
      order.scheduledFor=new Date(t).toISOString();order.status='programado';
    }
    if(!customer){
      const shift=key(input.shiftId)?await db(env,'/shifts/'+input.shiftId):null;
      if(!shift || shift.closedAt || isShiftExpired(shift) || shift.userId!==a.id)throw error('Abre tu propio turno antes de vender.',409);
      order.shiftId=shift.id;order.receivedAt=now;order.receivedBy=a.id;
      if(input.paidAt && order.payment==='Efectivo' && order.payWith<order.total)throw error('Efectivo insuficiente.',400);
      if(input.paidAt){order.paidAt=now;order.paidBy=a.id;order.invoiced=true;order.invoicedAt=now;order.invoicedBy=a.id;order.paymentChannel=order.payment==='Tarjeta'?'pos':order.payment==='Transferencia'?'transfer':'cash';}
    }
    // Reservation is idempotent. A retry must reuse the same order id.
    if(redeemPts)await mutateDb(env,'/users/'+a.id,u=>{
      u.redemptions=u.redemptions || {};
      if(!u.redemptions[id]){
        if(Number(u.points || 0)<redeemPts)throw error('Puntos insuficientes.',409);
        u.points-=redeemPts;u.redemptions[id]={points:redeemPts,at:now};u.pointsUpdatedAt=now;
      }
      return u;
    });
    let fresh=false;
    const saved=await mutateDb(env,'/orders/'+id,old=>{
      // mutateDb may call this function again after a conflicting write.
      fresh = !old;
      if(old?.testArchivedAt)throw error('Venta de prueba archivada.',409);
      if(old && old.userId!==order.userId)throw error('Identificador ocupado.',409);
      if(old && !customer) {
        const sale = value => JSON.stringify([
          value.userId,value.customerName,value.channel,value.type,value.address,value.payment,
          Number(value.payWith || 0),Number(value.total),value.shiftId,!!value.paidAt,
          (value.items || []).map(i=>[i.productId,i.qty,i.unit,i.mods,i.note])
        ]);
        if(sale(old)!==sale(order))throw error('Este identificador ya corresponde a otra cuenta. Conserva el intento original.',409);
      }
      return old || order;
    },5,true);
    if(fresh && familyRoom)await mutateDb(env,'/familyRooms/'+familyCode,room=>{
      if(!room || room.organizerId!==a.id)return room;
      return {...room,status:'ordered',orderId:saved.id,orderedAt:now,revision:crypto.randomUUID()};
    });
    if(fresh && onOrderCreated)try{await onOrderCreated(env,saved);}catch{}
    return saved;
  }
  async function updateOrder(env,a,id,input,request) {
    if(!['admin','cashier'].includes(a.role))throw error('Usa los botones de estado permitidos para tu rol.');
    const expected=request.headers.get('if-match');
    return mutateDb(env,'/orders/'+id,old=>{
      if(!old)throw error('Orden inexistente.',404);
      if(old.diningAccountId)throw error('La liquidación de mesa es inmutable.',409);
      if(old.testArchivedAt)throw error('Venta de prueba archivada.',409);
      const revision='"'+(old.revision || old.updatedAt || old.createdAt || '')+'"';
      if(expected && expected!=='*' && expected!==revision)throw error('La orden cambió en otra caja.',412);
      if(input.total!==old.total || JSON.stringify(input.items)!==JSON.stringify(old.items))throw error('No se puede alterar el importe o productos de una orden recibida.',409);
      if(old.paidAt && ['payment','payWith','shiftId','userId','customerName'].some(field=>input[field] !== undefined && input[field]!==old[field]))throw error('No se puede cambiar una venta ya cobrada. Revisa el intento original.',409);
      if(['cancelado','entregado','facturada'].includes(old.status))return old;
      const next={...old};const now=new Date().toISOString();
      // Only the dedicated status endpoint changes delivery state.
      if(input.cashierRequestedAt){next.cashierRequestedAt=old.cashierRequestedAt || now;next.cashierRequestedBy=old.cashierRequestedBy || a.id;}
      if((input.paidAt || input.invoiced) && !old.paidAt){
        if(!key(input.shiftId))throw error('Abre tu turno antes de facturar.',409);
        // Validated outside the transaction below; ownership is checked again by route.
        next.paidAt=now;next.paidBy=a.id;next.invoiced=true;next.invoicedAt=now;next.invoicedBy=a.id;next.shiftId=input.shiftId;
        if(!['Efectivo','Tarjeta','Transferencia'].includes(input.payment))throw error('Pago inválido.',400);
        next.payment=input.payment;
        next.paymentChannel=next.payment==='Tarjeta'?'pos':next.payment==='Transferencia'?'transfer':'cash';
        next.payWith=Number(input.payWith ?? old.payWith ?? 0);
        if(!Number.isFinite(next.payWith) || next.payWith<0 || (next.payment==='Efectivo' && next.payWith<old.total))throw error('Efectivo insuficiente.',400);
        next.needsChange=next.payment==='Efectivo' && next.payWith>old.total;
      }
      if(old.paidAt && input.invoiced && !old.invoiced){next.invoiced=true;next.invoicedAt=now;next.invoicedBy=a.id;}
      next.updatedAt=now;next.revision=crypto.randomUUID();return next;
    });
  }
  async function route(request,env) {
    const parts=new URL(request.url).pathname.slice('/api/data/'.length).split('/');
    if(parts.length>2 || parts.some(p=>!key(p)))throw error('Ruta no permitida.');
    const [node,id]=parts;const read=request.method==='GET';
    if(!['GET','PUT','PATCH','DELETE'].includes(request.method))throw error('Método no permitido.',405);
    if(read && publicNodes.includes(node)) {
      const value=await db(env,'/'+parts.join('/'));
      if(node==='settings') {
        if(id)throw error('Ruta no permitida.');
        const out={};for(const k of ['operationEpoch','open','waitMin','soundOn','opensAt','closeWeek','closeSun','weeklyHours','promos','blasts','doublePoints','welcomeBonus','taxRate','deliveryFee','minOrder','restaurantLat','restaurantLng','deliveryCustomerFee1','deliveryCustomerFee3','deliveryCustomerFee65','deliveryCustomerFee8','deliveryCustomerMaxKm','deliveryNationwideTestEnabled','deliveryFixedZoneEnabled','deliveryFixedZoneName','deliveryFixedZoneFee','chingadazoAiEnabled','foodProfileEnabled','familyOrderEnabled','spicyCopyEnabled','deliveryCodeRequired','deliveryEnabled']) if(value?.[k]!==undefined)out[k]=value[k];
        return json(out);
      }
      return json(value);
    }
    const a=await identity(request,env);
    if(!a) throw error('Inicia sesión.',401);
    const isStaff=staffRoles.includes(a.role);
    if(node==='shifts' && ['admin','cashier'].includes(a.role))await expireShifts(env);
    if(read) {
      if(!['users','orders','shifts','media'].includes(node))throw error('Ruta privada.');
      if(node==='media' && a.role!=='admin')throw error('Solo administración.');
      let raw=await db(env,'/'+parts.join('/'));
      if(node==='orders' && !id && isStaff)raw=await promoteDueOrders(env,raw);
      const allowed=p=>!p.testArchivedAt && (node==='orders'?(a.role==='admin' || p.userId===a.id || (isStaff && orderDay(p)===hnDay())):node==='users'?(a.role==='admin' || p.id===a.id || (a.role==='cashier' && p.role==='customer')):node==='shifts'?(a.role==='admin' || (a.role==='cashier' && p.userId===a.id)):true);
      if(id){
        if(raw && !allowed(raw))throw error('Acceso no autorizado.');
        const response=json(node==='users'?strip(raw):node==='orders' && raw && a.role==='kitchen'?kitchenOrder(raw):raw);
        if(node==='orders' && raw)response.headers.set('ETag','"'+(raw.revision || raw.updatedAt || raw.createdAt || '')+'"');
        return response;
      }
      if(node==='media')return json(raw);
      const out={};for(const p of values(raw)) if(allowed(p))out[p.id]=node==='users'?strip(p.id===a.id?{...p,role:a.role}:p):node==='orders' && a.role==='kitchen'?kitchenOrder(p):p;
      return json(out);
    }
    if(Number(request.headers.get('content-length') || 0)>8000000)throw error('Archivo demasiado grande.',413);
    const input=request.method==='DELETE'?null:await request.json();
    if(node==='users' && id===a.id && request.method==='DELETE' && a.role==='customer') {
      const orders=values(await db(env,'/orders')).filter(o=>o.userId===a.id);
      for(const o of orders)await mutateDb(env,'/orders/'+o.id,current=>({...current,userId:'deleted',customerName:'Cliente eliminado',phone:'',email:'',dni:'',address:'',addressNotes:''}));
      await db(env,'/users/'+a.id,{method:'DELETE'});
      return json({ok:true});
    }
    if(node==='users' && id && request.method==='PUT')return json(await profileSave(env,a,id,input));
    if(node==='orders' && id && request.method==='PUT') {
      const old=await db(env,'/orders/'+id);
      if(old?.testArchivedAt)throw error('Venta de prueba archivada. Recarga la aplicación.',409);
      if(!old)return json(await createOrder(env,a,id,input));
      if(a.role==='customer') {if(old.userId===a.id)return json(old);throw error('Orden no autorizada.');}
      if(!['admin','cashier'].includes(a.role))throw error('Cocina no puede registrar pagos.');
      if((input.paidAt || input.invoiced) && !old.paidAt){
        const sh=key(input.shiftId)?await db(env,'/shifts/'+input.shiftId):null;
        if(!sh || sh.closedAt || isShiftExpired(sh) || sh.userId!==a.id)throw error('Turno inválido.',409);
      }
      return json(await updateOrder(env,a,id,input,request));
    }
    if(node==='shifts' && id && request.method==='PUT' && ['admin','cashier'].includes(a.role)) {
      const old=await db(env,'/shifts/'+id);
      if(input.userId!==a.id || (old && old.userId!==a.id))throw error('Turno ajeno.');
      if(old?.closedAt)return json(old);
      if(!old){
        const latest=values(await db(env,'/shifts')).filter(s=>s?.userId===a.id && !s.closedAt && !s.testArchivedAt)
          .sort((x,y)=>String(y.openedAt||'').localeCompare(String(x.openedAt||'')))[0];
        if(latest&&!latest.closedAt)throw error('Ya tienes un turno abierto.',409);
        const fondo=Number(input.fondo||0);
        if(!Number.isFinite(fondo)||fondo<0||fondo>1000000)throw error('Fondo inicial inválido.',400);
        const fresh={id,userId:a.id,userName:text(input.userName,160)||'Empleado',openedAt:new Date().toISOString(),closedAt:'',fondo,counted:0,note:''};
        return json(await db(env,'/shifts/'+id,{method:'PUT',body:JSON.stringify(fresh)}));
      }
      return json(old);
    }
    if(a.role==='admin' && ['products','categories','catalog','settings','media'].includes(node)) {
      if (node==='settings' && input?.weeklyHours && !schedule?.validate(input.weeklyHours)) throw error('Horarios inválidos.',400);
      if(node==='media' && (!id || typeof input!=='string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(input)))throw error('Usa PNG, JPG, WebP o GIF.',400);
      return json(await db(env,'/'+parts.join('/'),{method:request.method,body:input===null?undefined:JSON.stringify(input)}));
    }
    throw error('Operación no autorizada.');
  }
  async function quoteDelivery(request,env) {
    const a=await identity(request,env);
    if(!a || a.role!=='customer')throw error('Entra con tu cuenta de cliente para calcular el envío.',401);
    const input=await request.json(),s=await db(env,'/settings') || {};
    if(s.deliveryEnabled===false)throw error('El delivery está pausado temporalmente.',409);
    return json(await customerDeliveryQuote(env,s,input,text(input.address,500)));
  }
  return {route,identity,award,profileSave,createOrder,quoteDelivery,quoteItems};
}
