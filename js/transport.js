// Route legacy database calls through the authenticated, allowlisted server.
// Firebase itself denies all browser access in v72.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const host = 'chingadazo-api.invalid';
  let generation = 0;
  window.PrivateSession = {
    generation: () => generation,
    clear() {
      generation += 1;
      window.__verifiedProfile = null;
      try {
        Store.patch(d => { d.users=[]; d.orders=[]; d.shifts=[]; d.session=null; });
        for (const k of ['chingadazo_session_id','chingadazo_orders_backup','chingadazo_pos_holds']) localStorage.removeItem(k);
        sessionStorage.removeItem('chingadazo_session_id');
      } catch {}
    }
  };
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (globalThis.CHINGADAZO_CONFIG?.configured === false && (url.hostname === host || (url.origin === location.origin && url.pathname.startsWith('/api/')))) {
      return new Response(JSON.stringify({error:'El Chingadazo está en preparación.'}), {status:503,headers:{'Content-Type':'application/json'}});
    }
    if (url.hostname !== host) return nativeFetch(input, init);
    if (!url.pathname.startsWith('/app/') || !url.pathname.endsWith('.json')) return new Response('{}', {status:403});
    const token = await AuthBridge.idToken();
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const target = '/api/data/' + url.pathname.slice(5, -5);
    return nativeFetch(target, {...init, headers, cache:'no-store'});
  };
})();
