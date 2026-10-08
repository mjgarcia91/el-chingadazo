const Cloud = (() => {
  const ROOT = "https://chingadazo-api.invalid/app";
  let status = "conectando";
  let orderEpoch = 0;
  const RANK = { programado: 0, nuevo: 1, preparacion: 2, listo: 3, camino: 4, entregado: 5, facturada: 5, cancelado: 6 };

  function arr(x) {
    if (!x) return [];
    return Array.isArray(x) ? x : Object.values(x);
  }

  async function put(path, body) {
    const res = await fetch(ROOT + path + ".json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    status = res.ok ? "en vivo" : "error";
    return res.ok;
  }
  async function patch(path, body) {
    const res = await fetch(ROOT + path + ".json", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    status = res.ok ? "en vivo" : "error";
    return res.ok;
  }

  // Optimistic transaction for order changes. Firebase's ETag prevents two
  // cashiers from charging/invoicing the same order at the same time.
  async function mutateOrder(id, mutator, attempts = 4) {
    if (!id || typeof mutator !== "function") return null;
    const url = ROOT + "/orders/" + encodeURIComponent(id) + ".json";
    for (let n = 0; n < attempts; n += 1) {
      const currentRes = await fetch(url, {
        cache: "no-store",
        headers: { "X-Firebase-ETag": "true" }
      });
      if (!currentRes.ok) throw new Error("No se pudo leer la orden (" + currentRes.status + ")");
      const current = await currentRes.json();
      if (!current) throw new Error("La orden ya no existe.");
      const next = mutator(structuredClone(current));
      if (!next) return { ...current, __transactionApplied: false };
      const etag = currentRes.headers.get("etag");
      const saveRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "if-match": etag || "*" },
        body: JSON.stringify(next)
      });
      if (saveRes.ok) {
        status = "en vivo";
        const saved = (await saveRes.json()) || next;
        Store.patch((d) => {
          const i = (d.orders || []).findIndex((o) => o.id === id);
          if (i >= 0) d.orders[i] = pickOrder(d.orders[i], saved);
          else d.orders.unshift(saved);
        });
        return { ...saved, __transactionApplied: true };
      }
      if (saveRes.status !== 412) throw new Error("El servidor rechazó el cambio (" + saveRes.status + ")");
    }
    throw new Error("Otra caja modificó la orden al mismo tiempo. Inténtalo nuevamente.");
  }

  async function invoiceOrder(id, details) {
    const token = await AuthBridge.idToken();
    if (!token) throw new Error("La sesión del empleado venció. Cambia de usuario e ingresa nuevamente con tu PIN.");
    const res = await fetch("/api/invoice-order", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id, ...(details || {}) })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "No se pudo confirmar el cobro.");
    if (!payload.order) throw new Error("El servidor no devolvió la orden facturada.");
    Store.patch((d) => {
      const i = (d.orders || []).findIndex((o) => o.id === id);
      if (i >= 0) d.orders[i] = payload.order;
      else d.orders.unshift(payload.order);
    });
    return { ...payload.order, __transactionApplied: !payload.alreadyInvoiced, __alreadyInvoiced: !!payload.alreadyInvoiced };
  }

  async function pullOrders() {
    const res = await readResponse("/orders");
    if (!res.ok) throw new Error("orders " + res.status);
    return arr(await res.json());
  }

  async function readResponse(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(ROOT + path + ".json", { cache: "no-store", signal: controller.signal });
    } finally { clearTimeout(timer); }
  }

  async function pull() {
    const read = async (path, fallback) => {
      try {
        const res = await readResponse(path);
        return res.ok ? ((await res.json()) ?? fallback) : fallback;
      } catch { return fallback; }
    };
    // Media can make /app.json very large. Pull each node separately so one
    // photograph never prevents new products/categories from synchronizing.
    const [orders, settingsRes, productsRes, usersRes, catalog, shiftsRes, categoriesRes] = await Promise.all([
      pullOrders().catch(() => []), read("/settings", {}), read("/products", {}), read("/users", {}),
      read("/catalog", {}), read("/shifts", {}), read("/categories", {})
    ]);
    return {
      orders,
      settings: settingsRes || {},
      users: arr(usersRes),
      products: arr(productsRes),
      catalog: catalog || {},
      shifts: arr(shiftsRes),
      // Product photos remain in Firebase and are requested individually from
      // /api/media/:id. Pulling the whole media node can exceed browser storage.
      media: {},
      categories: arr(categoriesRes)
    };
  }

  async function pushOrder(order) {
    if (!order || !order.id) return false;
    const res=await fetch(ROOT+'/orders/'+encodeURIComponent(order.id)+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(order)});
    const saved=await res.json();
    if(!res.ok)throw Object.assign(new Error(saved.error || 'No se confirmó la orden.'),{status:res.status});
    orderEpoch += 1;
    Store.patch(d=>{const i=d.orders.findIndex(o=>o.id===saved.id);if(i<0)d.orders.unshift(saved);else d.orders[i]=saved;});
    return true;
  }

  async function pushStatus(id, statusValue) {
    const db = Store.get();
    const o = (db.orders || []).find((x) => x.id === id);
    if (o) {
      o.status = statusValue;
      o.statusAt = new Date().toISOString();
      o.updatedAt = o.statusAt;
      return pushOrder(o);
    }
    return put("/orders/" + encodeURIComponent(id) + "/status", statusValue);
  }

  async function pushSettings(settings) {
    return patch("/settings", {
      open: settings.open === true,
      waitMin: Number(settings.waitMin || 25),
      soundOn: settings.soundOn !== false,
      opensAt: settings.opensAt || "11:00",
      closeWeek: settings.closeWeek || "21:00",
      closeSun: settings.closeSun || "20:00",
      ...(settings.weeklyHours ? {weeklyHours:settings.weeklyHours} : {}),
      promos: settings.promos || [],
      blasts: (settings.blasts || []).slice(-20),
      doublePoints: !!settings.doublePoints,
      welcomeBonus: Number(settings.welcomeBonus ?? 500)
      ,taxRate: Number(settings.taxRate || 0), deliveryFee: Number(settings.deliveryFee || 0), minOrder: Number(settings.minOrder || 0),
      restaurantLat: Number(settings.restaurantLat || 0), restaurantLng: Number(settings.restaurantLng || 0),
      deliveryCustomerFee1: Number(settings.deliveryCustomerFee1 ?? 30), deliveryCustomerFee3: Number(settings.deliveryCustomerFee3 ?? 35),
      deliveryCustomerFee65: Number(settings.deliveryCustomerFee65 ?? 75), deliveryCustomerFee8: Number(settings.deliveryCustomerFee8 ?? 110),
      deliveryCustomerMaxKm: Number(settings.deliveryCustomerMaxKm || 8)
      ,chingadazoAiEnabled: settings.chingadazoAiEnabled !== false
      ,foodProfileEnabled: settings.foodProfileEnabled !== false
      ,familyOrderEnabled: settings.familyOrderEnabled !== false
      ,spicyCopyEnabled: settings.spicyCopyEnabled !== false
      ,deliveryCodeRequired: settings.deliveryCodeRequired !== false
      ,deliveryEnabled: settings.deliveryEnabled !== false
      ,shiftReportEmail: settings.shiftReportEmail || ""
    });
  }

  async function pushCatalog(db) {
    const settings = db?.settings || {};
    const catalog = {
      heroImage: settings.heroImage || "",
      heroTitle: settings.heroTitle || "",
      heroSubtitle: settings.heroSubtitle || "",
      heroHeight: Number(settings.heroHeight || 210),
      logoImage: settings.logoImage || "",
      logoSize: Number(settings.logoSize || 48)
    };
    await put("/catalog", {
      heroTitle: catalog.heroTitle,
      heroSubtitle: catalog.heroSubtitle,
      heroHeight: catalog.heroHeight,
      logoSize: catalog.logoSize,
      heroImage: (catalog.heroImage || "").startsWith("data:") ? "" : catalog.heroImage,
      logoImage: (catalog.logoImage || "").startsWith("data:") ? "" : catalog.logoImage
    });
    if ((catalog.heroImage || "").startsWith("data:")) await put("/media/hero", catalog.heroImage);
    if ((catalog.logoImage || "").startsWith("data:")) await put("/media/logo", catalog.logoImage);
    const products = db?.products || [];
    for (const p of products) {
      if (!p?.id) continue;
      await pushProduct(p);
    }
    return true;
  }

  async function pullMedia() {
    try {
      const res = await fetch(ROOT + "/media.json", { cache: "no-store" });
      if (!res.ok) return {};
      return (await res.json()) || {};
    } catch { return {}; }
  }

  async function pushProduct(p) {
    if (!p?.id) return false;
    const img = p.image || "";
    const slim = {
      id: p.id, name: p.name, description: p.description, price: p.price,
      category: p.category, featured: !!p.featured,
      available: p.available !== false, modifiers: p.modifiers || [],
      updatedAt: p.updatedAt || new Date().toISOString(),
      image: img.startsWith("data:") ? ("media:" + p.id) : img
    };
    const key = encodeURIComponent(p.id);
    // Publish the photo first. Do not leave a product pointing to missing media.
    if (img.startsWith("data:")) {
      const mediaOk = await put("/media/" + key, img);
      if (!mediaOk) return false;
    }
    const productOk = await put("/products/" + key, slim);
    if (!productOk) return false;
    try {
      const check = await fetch(ROOT + "/products/" + key + ".json", { cache: "no-store" });
      const saved = check.ok ? await check.json() : null;
      return !!saved && saved.id === p.id && saved.name === p.name;
    } catch { return false; }
  }

  async function pushCategories(list) {
    const map = {};
    (list || []).forEach((c) => { if (c && c.id) map[c.id] = c; });
    return put("/categories", map);
  }

  async function pushUser(user) {
    if (!user || !user.id) return false;
    const payload = {
      id: user.id, role: user.role, name: user.name, email: user.email,
      phone: user.phone, dni: user.dni, points: user.points || 0,
      password: "", pin: "",
      username: user.username || "", addresses: user.addresses || [],
      welcomeBonus: Number(user.welcomeBonus || 0),
      welcomeAt: user.welcomeAt || "",
      welcomeEmailSent: user.welcomeEmailSent === true,
      pointsUpdatedAt: user.pointsUpdatedAt || "",
      createdAt: user.createdAt || user.welcomeAt || "",
      updatedAt: user.updatedAt || user.createdAt || "",
      authUid: user.authUid || "",
      authProvider: user.authProvider || "",
      emailVerified: user.emailVerified === true,
      pendingWelcomeBonus: Number(user.pendingWelcomeBonus || 0),
      verifiedAt: user.verifiedAt || "",
      photoURL: user.photoURL || "",
      pendingSync: false
    };
    const res=await fetch(ROOT+'/users/'+encodeURIComponent(user.id)+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const profile=await res.json();
    if(!res.ok)throw new Error(profile.error || 'No se pudo guardar el perfil.');
    Store.patch(d=>{const i=d.users.findIndex(u=>u.id===profile.id);if(i<0)d.users.push(profile);else d.users[i]=profile;});
    return true;
  }

  async function deleteUser(id) {
    if (!id) return false;
    const res = await fetch(ROOT + "/users/" + encodeURIComponent(id) + ".json", { method: "DELETE" });
    status = res.ok ? "en vivo" : "error";
    return res.ok;
  }

  async function push(db) {
    const orders = db?.orders || [];
    for (const o of orders) await pushOrder(o);
  }

  function pickOrder(a, b) {
    if (!a) return b;
    if (!b) return a;
    const ra = RANK[a.status] || 0;
    const rb = RANK[b.status] || 0;
    const clock = (o) => [o.updatedAt, o.statusAt, o.invoicedAt, o.paidAt, o.deliveredAt, o.receivedAt, o.createdAt]
      .filter(Boolean).sort().slice(-1)[0] || "";
    const aNewer = clock(a) >= clock(b);
    const base = aNewer ? { ...b, ...a } : { ...a, ...b };
    // Never let an old device move an order backwards or erase a payment.
    base.status = ra >= rb ? a.status : b.status;
    if (a.pointsGranted || b.pointsGranted) base.pointsGranted = true;
    base.invoiced = a.invoiced === true || b.invoiced === true;
    ["paidAt", "paidBy", "invoicedAt", "invoicedBy", "deliveredAt", "receivedAt", "receivedBy", "cashierRequestedAt", "cashierRequestedBy", "shiftId"].forEach((k) => {
      base[k] = (aNewer ? a[k] : b[k]) || (aNewer ? b[k] : a[k]) || "";
    });
    base.updatedAt = clock(a) >= clock(b) ? clock(a) : clock(b);
    if ((a.items || []).length >= (b.items || []).length) base.items = a.items || b.items;
    else base.items = b.items || a.items;
    return base;
  }

  function merge(local, remote) {
    const map = new Map();
    if (!remote.orders) (local.orders || []).forEach(o=>o?.id && map.set(o.id,o));
    const newOnes = (remote.orders || []).filter(o=>!(local.orders || []).some(x=>x.id===o.id));
    (remote.orders || []).forEach(o=>o?.id && map.set(o.id,o));
    const users = new Map();
    (remote.users || local.users || []).forEach(u=>u?.id && users.set(u.id,u));
    const settings = { ...(local.settings || {}) };
    if (remote.settings) {
      if (remote.settings.weeklyHours) settings.weeklyHours = remote.settings.weeklyHours;
      for(const k of ['taxRate','deliveryFee','minOrder','restaurantLat','restaurantLng','deliveryCustomerFee1','deliveryCustomerFee3','deliveryCustomerFee65','deliveryCustomerFee8','deliveryCustomerMaxKm'])if(remote.settings[k]!=null)settings[k]=Number(remote.settings[k]);
      if (remote.settings.open !== undefined) settings.open = remote.settings.open === true;
      if (remote.settings.opensAt) settings.opensAt = remote.settings.opensAt;
      if (remote.settings.closeWeek) settings.closeWeek = remote.settings.closeWeek;
      if (remote.settings.closeSun) settings.closeSun = remote.settings.closeSun;
      if (remote.settings.waitMin) settings.waitMin = Number(remote.settings.waitMin);
      if (remote.settings.soundOn !== undefined) settings.soundOn = remote.settings.soundOn;
      if (remote.settings.promos) settings.promos = remote.settings.promos;
      if (remote.settings.blasts) settings.blasts = remote.settings.blasts;
      if (remote.settings.doublePoints !== undefined) settings.doublePoints = remote.settings.doublePoints === true;
      if (remote.settings.welcomeBonus != null) settings.welcomeBonus = Number(remote.settings.welcomeBonus);
      if (remote.settings.deliveryEnabled !== undefined) settings.deliveryEnabled = remote.settings.deliveryEnabled !== false;
      if (remote.settings.shiftReportEmail) settings.shiftReportEmail = remote.settings.shiftReportEmail;
    }
    if (remote.catalog) {
      const keepData = (localV, remoteV) =>
        (localV || "").startsWith("data:") && !(remoteV || "").startsWith("data:")
          ? localV
          : (remoteV || localV);
      if (remote.catalog.heroImage) settings.heroImage = keepData(settings.heroImage, remote.catalog.heroImage);
      if (remote.catalog.heroTitle) settings.heroTitle = remote.catalog.heroTitle;
      if (remote.catalog.heroSubtitle) settings.heroSubtitle = remote.catalog.heroSubtitle;
      if (remote.catalog.heroHeight) settings.heroHeight = Number(remote.catalog.heroHeight);
      if (remote.catalog.logoImage) settings.logoImage = keepData(settings.logoImage, remote.catalog.logoImage);
      if (remote.catalog.logoSize) settings.logoSize = Number(remote.catalog.logoSize);
    }
    const products = new Map();
    (local.products || []).forEach((p) => p?.id && products.set(p.id, p));
    (remote.products || []).forEach((p) => {
      if (!p?.id) return;
      const cur = products.get(p.id);
      if (!cur) products.set(p.id, p);
      else {
        const remoteNewer = String(p.updatedAt || "") > String(cur.updatedAt || "");
        const keepImg = (cur.image || "").startsWith("idb:") && p.image
          ? p.image
          : (cur.image || "").startsWith("data:") && !(p.image || "").startsWith("data:")
          ? cur.image
          : (remoteNewer ? (p.image || cur.image) : (cur.image || p.image));
        const merged = remoteNewer ? { ...cur, ...p, image: keepImg } : { ...p, ...cur, image: keepImg };
        products.set(p.id, merged);
      }
    });
    const shifts = new Map();
    (remote.shifts ? [] : local.shifts || []).forEach((s) => s?.id && shifts.set(s.id, s));
    (remote.shifts || []).forEach((s) => {
      if (!s?.id) return;
      const cur = shifts.get(s.id);
      if (!cur) shifts.set(s.id, s);
      else shifts.set(s.id, { ...cur, ...s, closedAt: cur.closedAt || s.closedAt });
    });
    const cats = new Map();
    (local.categories || []).forEach((c) => c?.id && cats.set(c.id, c));
    (remote.categories || []).forEach((c) => { if (c?.id && !cats.has(c.id)) cats.set(c.id, c); });
    const next = {
      ...local,
      orders: [...map.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      users: [...users.values()],
      products: [...products.values()],
      categories: [...cats.values()],
      shifts: [...shifts.values()].sort((a, b) => String(b.openedAt || "").localeCompare(String(a.openedAt || ""))),
      settings,
      session: local.session
    };
    const media = remote.media || {};
    if ((next.settings.coverVer || 0) < 4) {
      if (media.hero && !(next.settings.heroImage || "").startsWith("data:")) next.settings.heroImage = media.hero;
      if (media.logo && !(next.settings.logoImage || "").startsWith("data:")) next.settings.logoImage = media.logo;
    }
    next.products = next.products.map((p) => {
      if (!p) return p;
      if ((p.image || "").startsWith("data:")) return p;
      const remoteImg = media[p.id];
      if (typeof remoteImg === "string" && remoteImg.startsWith("data:")) return { ...p, image: remoteImg };
      if ((p.image || "").startsWith("assets/") || (p.image || "").startsWith("media:")) return p;
      return p;
    });
    return {
      changed: JSON.stringify(local.settings) !== JSON.stringify(next.settings) || JSON.stringify(local.users) !== JSON.stringify(next.users) || JSON.stringify(local.shifts) !== JSON.stringify(next.shifts) || JSON.stringify(local.orders || []) !== JSON.stringify(next.orders)
        || Number(local.settings?.waitMin) !== Number(next.settings?.waitMin)
        || Boolean(local.settings?.open) !== Boolean(next.settings?.open)
        || (local.settings?.heroImage || "") !== (next.settings?.heroImage || "")
        || JSON.stringify((local.users || []).map((u) => u.id + ":" + (u.points || 0) + ":" + (u.pointsUpdatedAt || "") + ":" + (u.pendingSync || false))) !== JSON.stringify((next.users || []).map((u) => u.id + ":" + (u.points || 0) + ":" + (u.pointsUpdatedAt || "") + ":" + (u.pendingSync || false)))
        || (local.products || []).length !== (next.products || []).length
        || JSON.stringify((local.products || []).map((p) => p.id + "|" + p.name + "|" + p.category + "|" + p.price + "|" + p.available + "|" + p.image + "|" + (p.updatedAt || ""))) !== JSON.stringify((next.products || []).map((p) => p.id + "|" + p.name + "|" + p.category + "|" + p.price + "|" + p.available + "|" + p.image + "|" + (p.updatedAt || "")))
        || JSON.stringify((local.categories || []).map((c) => c.id + "|" + c.name + "|" + (c.icon || ""))) !== JSON.stringify((next.categories || []).map((c) => c.id + "|" + c.name + "|" + (c.icon || ""))),
      newOnes,
      next
    };
  }

  async function sync() {
    if (globalThis.CHINGADAZO_CONFIG?.configured === false) { status = 'en preparación'; return { changed: false, newOnes: [] }; }
    const epoch=++orderEpoch;
    const generation=window.PrivateSession?.generation();
    try {
      const remote = await pull();
      if(epoch!==orderEpoch)delete remote.orders;
      if(generation!==window.PrivateSession?.generation())return {changed:false,newOnes:[]};
      status = "en vivo";
      const m = merge(Store.get(), remote);
      if (m.changed) {
        if (window.__chingadazoEditLock) {
          const cur = Store.get();
          cur.orders = m.next.orders;
          Store.save(cur);
        } else {
          window.__chingadazoSyncing = true;
          Store.save(m.next);
          window.__chingadazoSyncing = false;
        }
      }
      return m;
    } catch {
      status = "sin red";
      return { changed: false, newOnes: [] };
    }
  }

  async function syncOrders() {
    if (globalThis.CHINGADAZO_CONFIG?.configured === false) return { changed: false, newOnes: [] };
    const epoch=++orderEpoch;
    const generation=window.PrivateSession?.generation();
    try {
      const orders = await pullOrders();
      if(epoch!==orderEpoch)return {changed:false,newOnes:[]};
      if(generation!==window.PrivateSession?.generation())return {changed:false,newOnes:[]};
      status = "en vivo";
      const m = merge(Store.get(), { orders });
      if (m.changed) {
        window.__chingadazoSyncing = true;
        Store.save(m.next);
        window.__chingadazoSyncing = false;
      }
      window.dispatchEvent(new CustomEvent("chingadazo:orders-live", { detail: m }));
      return m;
    } catch {
      status = "reconectando";
      return { changed: false, newOnes: [] };
    }
  }

  return { pull, push, pushOrder, pushStatus, mutateOrder, invoiceOrder, pushSettings, pushUser, deleteUser, pushCatalog, pushProduct, pushCategories, pullMedia, sync, syncOrders, getStatus: () => status };
})();
window.Cloud = Cloud;
