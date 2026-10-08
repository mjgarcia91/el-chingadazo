// Secure, short-lived shared orders. Every participant must be an authenticated
// customer with a complete Típicos profile; no phone, DNI or address is exposed.
export function createFamily({ db, mutateDb, verifyFirebaseUser, json }) {
  const error = (message, status = 403) => Object.assign(new Error(message), { status });
  const values = value => value ? Object.values(value).filter(Boolean) : [];
  const safeKey = value => /^[A-Za-z0-9_-]{1,150}$/.test(String(value || ''));
  const clean = (value, max = 300) => {
    const out = String(value || '').trim();
    if (out.length > max || /[<>"`]/.test(out)) throw error('Texto inválido.', 400);
    return out;
  };
  const auth = async (request, env) => {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw error('Inicia sesión para usar el pedido familiar.', 401);
    let user;
    try { user = await verifyFirebaseUser(token); } catch { throw error('Vuelve a iniciar sesión.', 401); }
    const id = 'auth-' + user.localId;
    const [role, profile] = await Promise.all([db(env, '/roles/' + user.localId), db(env, '/users/' + id)]);
    if (role && ['admin', 'cashier', 'kitchen'].includes(role)) throw error('Usa una cuenta de cliente.', 403);
    if (!user.emailVerified || !profile || profile.role !== 'customer' || !profile.name || !profile.phone || !profile.dni) {
      throw error('Completa y verifica tu perfil antes de participar.', 409);
    }
    return { id, name: clean(profile.name, 100), profile };
  };
  const roomCode = () => {
    const bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
    return String(100000 + (bytes[0] % 900000));
  };
  const assertRoom = (room, actor) => {
    if (!room) throw error('Ese código no existe o ya venció.', 404);
    if (Date.parse(room.expiresAt || 0) <= Date.now()) throw error('El código temporal venció. Crea uno nuevo.', 410);
    if (room.status !== 'open') throw error('Este pedido familiar ya fue cerrado.', 409);
    if (!room.members?.[actor.id]) throw error('Primero debes unirte al círculo.', 403);
  };
  const publicRoom = (room, actor) => ({
    id: room.id, code: room.code, name: room.name, status: room.status,
    organizerId: room.organizerId, isOrganizer: room.organizerId === actor.id,
    meId: actor.id, createdAt: room.createdAt, expiresAt: room.expiresAt,
    members: values(room.members).map(m => ({ id: m.id, name: m.name, ready: !!m.ready, joinedAt: m.joinedAt })),
    items: values(room.items).map(i => ({ id: i.id, ownerId: i.ownerId, ownerName: i.ownerName, productId: i.productId,
      name: i.name, image: i.image || '', qty: i.qty, unit: i.unit, mods: i.mods || {}, modsText: i.modsText || '', note: i.note || '' })),
    revision: room.revision || ''
  });
  async function pricedItem(env, actor, input) {
    if (!safeKey(input.productId)) throw error('Producto inválido.', 400);
    const product = await db(env, '/products/' + input.productId);
    const qty = Number(input.qty || 1);
    if (!product || product.available === false || !Number.isInteger(qty) || qty < 1 || qty > 20) throw error('Producto no disponible.', 409);
    const selected = input.mods && typeof input.mods === 'object' ? input.mods : {};
    let unit = Number(product.price || 0); const labels = []; const mods = {};
    for (const group of product.modifiers || []) {
      const raw = selected[group.id]; const ids = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
      if ((group.required && !ids.length) || (!group.multi && ids.length > 1) || new Set(ids).size !== ids.length) throw error('Revisa las opciones del producto.', 400);
      const names = [];
      for (const id of ids) {
        const option = (group.options || []).find(o => o.id === id);
        if (!option) throw error('Opción de producto inválida.', 400);
        unit += Number(option.price || 0); names.push(option.name);
      }
      mods[group.id] = raw || []; if (names.length) labels.push(group.name + ': ' + names.join(', '));
    }
    if (!Number.isFinite(unit) || unit < 0) throw error('Precio sin configurar.', 409);
    const image = String(product.image || '').startsWith('media:') ? '/api/media/' + encodeURIComponent(product.id) : String(product.image || '');
    return { id: crypto.randomUUID(), ownerId: actor.id, ownerName: actor.name, productId: product.id, name: product.name,
      image, qty, unit, mods, modsText: labels.join(' · '), note: clean(input.note, 300), addedAt: new Date().toISOString() };
  }
  async function create(env, actor) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = roomCode(), now = new Date(), expires = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      let created = false;
      const room = await mutateDb(env, '/familyRooms/' + code, old => {
        if (old && Date.parse(old.expiresAt || 0) > Date.now()) return old;
        created = true;
        return { id: code, code, name: 'Pedido en grupo', organizerId: actor.id, status: 'open', createdAt: now.toISOString(),
          expiresAt: expires.toISOString(), members: { [actor.id]: { id: actor.id, name: actor.name, ready: false, joinedAt: now.toISOString() } },
          items: {}, revision: crypto.randomUUID() };
      }, 5, true);
      if (created) return room;
    }
    throw error('No se pudo crear un código temporal. Inténtalo nuevamente.', 503);
  }
  async function route(request, env) {
    const actor = await auth(request, env);
    const settings = await db(env, '/settings') || {};
    if (settings.familyOrderEnabled === false) throw error('El pedido familiar está desactivado temporalmente.', 409);
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const code = String(url.searchParams.get('code') || '').replace(/\D/g, '');
      if (!/^\d{6}$/.test(code)) throw error('Escribe el código de 6 números.', 400);
      const room = await db(env, '/familyRooms/' + code); assertRoom(room, actor);
      return json(publicRoom(room, actor));
    }
    const input = await request.json().catch(() => ({}));
    const action = String(input.action || '');
    if (action === 'create') return json(publicRoom(await create(env, actor), actor));
    const code = String(input.code || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) throw error('Escribe el código de 6 números.', 400);
    if (action === 'join') {
      const room = await mutateDb(env, '/familyRooms/' + code, current => {
        if (!current || Date.parse(current.expiresAt || 0) <= Date.now() || current.status !== 'open') throw error('Ese código no existe o ya venció.', 404);
        current.members = current.members || {};
        if (!current.members[actor.id] && values(current.members).length >= 8) throw error('Este círculo ya tiene 8 participantes.', 409);
        current.members[actor.id] = current.members[actor.id] || { id: actor.id, name: actor.name, ready: false, joinedAt: new Date().toISOString() };
        current.revision = crypto.randomUUID(); return current;
      });
      return json(publicRoom(room, actor));
    }
    let pendingItem = null;
    if (action === 'add') pendingItem = await pricedItem(env, actor, input);
    const room = await mutateDb(env, '/familyRooms/' + code, current => {
      assertRoom(current, actor); current.members = current.members || {}; current.items = current.items || {};
      if (action === 'add') {
        if (values(current.items).reduce((sum, item) => sum + Number(item.qty || 0), 0) + pendingItem.qty > 50) throw error('El pedido familiar alcanzó el máximo de 50 productos.', 409);
        current.items[pendingItem.id] = pendingItem; current.members[actor.id].ready = false;
      } else if (action === 'remove') {
        const item = current.items[input.itemId]; if (!item) throw error('Producto inexistente.', 404);
        if (item.ownerId !== actor.id && current.organizerId !== actor.id) throw error('Solo puedes quitar tus productos.', 403);
        delete current.items[input.itemId];
      } else if (action === 'quantity') {
        const item = current.items[input.itemId]; if (!item) throw error('Producto inexistente.', 404);
        if (item.ownerId !== actor.id && current.organizerId !== actor.id) throw error('Solo puedes cambiar tus productos.', 403);
        const qty = Number(input.qty); if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw error('Cantidad inválida.', 400);
        item.qty = qty; current.members[item.ownerId].ready = false;
      } else if (action === 'ready') {
        current.members[actor.id].ready = input.ready !== false;
      } else if (action === 'cancel') {
        if (current.organizerId !== actor.id) throw error('Solo el organizador puede cancelar.', 403);
        current.status = 'cancelled'; current.cancelledAt = new Date().toISOString();
      } else if (action === 'prepare') {
        if (current.organizerId !== actor.id) throw error('Solo el organizador puede confirmar.', 403);
        if (!values(current.items).length) throw error('El pedido familiar está vacío.', 409);
      } else throw error('Acción inválida.', 400);
      current.revision = crypto.randomUUID(); return current;
    });
    return json(publicRoom(room, actor));
  }
  return { route };
}
