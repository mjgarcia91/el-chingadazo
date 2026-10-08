/* Local operational data only. This store never grants authentication or roles. */
globalThis.ChingadazoContinuity = (() => {
  const VERSION = 1;
  function draft(value = {}) {
    const items = value.posTicket || [];
    if (!Array.isArray(items) || items.length > 500) throw Error('Cuenta local inválida.');
    const posTicket = items.map(item => {
      if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.qty) || item.qty < 1 || !Number.isFinite(item.unit) || item.unit < 0) throw Error('Consumo local inválido.');
      return { key: String(item.key || ''), productId: item.productId, name: String(item.name || ''), qty: item.qty, unit: item.unit, mods: structuredClone(item.mods || {}), modsText: String(item.modsText || ''), note: String(item.note || '') };
    });
    return { posTicket, posName: String(value.posName || ''), posPay: String(value.posPay || 'Efectivo'), posPayWith: String(value.posPayWith || ''), posChannel: String(value.posChannel || 'mostrador'),posDiningAccountId:String(value.posDiningAccountId||''),posDiningTableId:String(value.posDiningTableId||''),posDiningConfirmedOp:String(value.posDiningConfirmedOp||'') };
  }

  function indexedStorage(indexedDB) {
    let connection;
    function connect() {
      if (!indexedDB) return Promise.reject(Error('Este navegador no permite guardar consumos.'));
      if (!connection) connection = new Promise((resolve,reject) => {
        let cancelled = false;
        const request = indexedDB.open('chingadazo-continuity-v1', VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore('accounts');
        request.onerror = () => reject(Error('No se pudo abrir el guardado local.'));
        request.onblocked = () => { cancelled = true; reject(Error('Cierra las otras pestañas para actualizar el guardado local.')); };
        request.onsuccess = () => {
          if (cancelled) { request.result.close(); return; }
          request.result.onversionchange = () => { request.result.close(); connection = null; };
          resolve(request.result);
        };
      }).catch(error => { connection = null; throw error; });
      return connection;
    }
    async function transact(key, value, write) {
      const db = await connect();
      return new Promise((resolve,reject) => {
        const tx = db.transaction('accounts', write ? 'readwrite' : 'readonly', write ? { durability: 'strict' } : undefined);
        const request = write ? tx.objectStore('accounts').put(value,key) : tx.objectStore('accounts').get(key);
        // Request success is not durable success: wait for transaction completion.
        tx.oncomplete = () => resolve(write ? undefined : request.result || null);
        tx.onabort = tx.onerror = () => reject(Error('No se pudo guardar en este equipo. Revisa espacio y permisos.'));
      });
    }
    return { read: key => transact(key,null,false), write: (key,value) => transact(key,value,true) };
  }

  function create({ storage = indexedStorage(globalThis.indexedDB), locks = globalThis.navigator?.locks } = {}) {
    let owner = '', record = null, release, lockTask, tail = Promise.resolve();
    function enqueue(operation) {
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    }
    async function close() {
      await tail;
      if (release) release();
      if (lockTask) await lockTask;
      owner = ''; record = null; release = null; lockTask = null;
    }
    async function open(operatorId) {
      if (!operatorId || typeof operatorId !== 'string') throw Error('Falta el usuario autorizado.');
      await close();
      if (!locks?.request) throw Error('Este navegador no permite proteger la cuenta entre pestañas.');
      const key = 'el-chingadazo-cfe45:' + operatorId;
      await new Promise((resolve,reject) => {
        lockTask = locks.request('chingadazo-account:' + key, { mode: 'exclusive', ifAvailable: true }, async lock => {
          if (!lock) { reject(Error('Esta cuenta está abierta en otra pestaña. Cierra esa pestaña y vuelve a entrar.')); return; }
          owner = key;
          await new Promise(done => { release = done; resolve(); });
        }).catch(reject);
      });
      try {
        record = await storage.read(owner);
        if (record && (record.version !== VERSION || record.owner !== owner)) throw Error('La cuenta guardada necesita revisión; no se sobrescribirá.');
        if (record) draft(record);
        return record ? structuredClone(record) : null;
      } catch(error) { await close(); throw error; }
    }
    async function persist(next) {
      if (!owner) throw Error('La cuenta local no está disponible.');
      const value = { ...next, owner, version: VERSION, updatedAt: new Date().toISOString() };
      if (JSON.stringify(value).length > 1024 * 1024) throw Error('La cuenta supera el límite de guardado local.');
      await storage.write(owner,value);
      record = value;
      return structuredClone(value);
    }
    function save(value) {
      const next = draft(value);
      return enqueue(() => {
        if (record?.pendingPosOrder) throw Error('Hay un cobro sin confirmar; conserva la cuenta hasta revisarlo.');
        return persist(next);
      });
    }
    function prepare(order) {
      const input = structuredClone(order);
      return enqueue(() => {
        if (!record || !input?.id || !Array.isArray(input.items)) throw Error('Guarda los consumos antes de enviar.');
        if (record.pendingPosOrder && JSON.stringify(record.pendingPosOrder) !== JSON.stringify(input)) throw Error('No cambies un cobro sin confirmar.');
        return persist({ ...record, pendingPosId: input.id, pendingPosOrder: input });
      });
    }
    function confirm(id) {
      return enqueue(() => {
        if (record?.pendingPosOrder?.id !== id) throw Error('El identificador confirmado no coincide.');
        return persist(draft());
      });
    }
    return { open, close, save, prepare, confirm };
  }
  return { create, indexedStorage, draft };
})();
