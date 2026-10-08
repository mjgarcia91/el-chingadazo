const Store = (() => {
  const KEY = "chingadazo_db_v4";
  let mem = null;

  const empty = () => ({
    settings: structuredClone(SEED_SETTINGS),
    categories: structuredClone(SEED_CATEGORIES),
    products: structuredClone(SEED_PRODUCTS),
    users: [],
    orders: [],
    shifts: [],
    session: null,
    seenOrderIds: []
  });

  function hydrate(db) {
    if (!db.products?.length) db.products = structuredClone(SEED_PRODUCTS);
    if (!db.users) db.users = [];
    if (!db.settings) db.settings = structuredClone(SEED_SETTINGS);
    if (db.settings.businessInfoVersion !== 112) {
      db.settings.name = SEED_SETTINGS.name;
      db.settings.address = SEED_SETTINGS.address;
      db.settings.email = SEED_SETTINGS.email;
      db.settings.businessInfoVersion = 112;
    }
    if (!db.categories) db.categories = structuredClone(SEED_CATEGORIES);
    SEED_CATEGORIES.forEach((c) => {
      if (!(db.categories || []).some((x) => x.id === c.id)) db.categories.push(structuredClone(c));
    });
    SEED_PRODUCTS.forEach((p) => {
      if (!(db.products || []).some((x) => x.id === p.id)) db.products.push(structuredClone(p));
    });
    if (!db.orders) db.orders = [];
    if (!db.shifts) db.shifts = [];
    if (!db.seenOrderIds) db.seenOrderIds = [];
    (db.users || []).forEach((u) => { if (u.points == null) u.points = 0; });
    // Preserve packaged asset paths and Firebase media references. The view
    // resolves `media:id` through the Worker without downloading every photo.
    if (!db.settings.waitMin) db.settings.waitMin = 25;
    if (db.settings.welcomeBonus == null) db.settings.welcomeBonus = 500;
    if (db.settings.doublePoints == null) db.settings.doublePoints = false;
    if (!db.settings.heroTitle) db.settings.heroTitle = SEED_SETTINGS.heroTitle;
    if (!db.settings.coverVer || db.settings.coverVer < 4) {
      db.settings.heroImage = "assets/logo.jpg";
      db.settings.logoImage = "assets/logo.jpg";
      db.settings.heroHeight = 220;
      db.settings.coverVer = 4;
    }
    return db;
  }

  function load() {
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(KEY);
      mem = raw ? hydrate(JSON.parse(raw)) : hydrate(empty());
      mem.users=[];mem.orders=[];mem.shifts=[];mem.session=null;
    } catch {
      mem = hydrate(empty());
    }
    return mem;
  }

  const bus = ("BroadcastChannel" in window) ? new BroadcastChannel("chingadazo_live") : null;

  function save(db) {
    mem = db;
    const publicCopy={...db,users:[],orders:[],shifts:[],session:null};
    try {
      localStorage.setItem(KEY, JSON.stringify(publicCopy));
    } catch {
      try {
        const slim = JSON.parse(JSON.stringify(publicCopy));
        (slim.products || []).forEach((p) => {
          if ((p.image || "").startsWith("data:")) p.image = p.id ? ("idb:" + p.id) : "";
        });
        if ((slim.settings?.heroImage || "").startsWith("data:")) slim.settings.heroImage = "idb:hero";
        if ((slim.settings?.logoImage || "").startsWith("data:")) slim.settings.logoImage = "idb:logo";
        localStorage.setItem(KEY, JSON.stringify(slim));
      } catch {}
    }
    try { localStorage.removeItem("chingadazo_orders_backup"); } catch {}
    if (db.session) localStorage.setItem("chingadazo_session_id", db.session);
    else localStorage.removeItem("chingadazo_session_id");
    window.dispatchEvent(new CustomEvent("chingadazo:db", { detail: db }));
    try { bus && bus.postMessage({ type: "db", n: (db.orders || []).length }); } catch {}
  }

  function get() { return load(); }

  function patch(mutator) {
    const db = load();
    mutator(db);
    save(db);
    return db;
  }

  function reset() {
    mem = hydrate(empty());
    save(mem);
    return mem;
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  return { load, save, get, patch, reset, uid };
})();
