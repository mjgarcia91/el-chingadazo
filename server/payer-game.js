// Short-lived, authenticated bill roulette. The server performs and stores the
// random draw so every participant sees the same result and clients cannot pick it.
export function createPayerGame({ db, mutateDb, verifyFirebaseUser, json }) {
  const error = (message, status = 403) => Object.assign(new Error(message), { status });
  const values = value => value ? Object.values(value).filter(Boolean) : [];
  const clean = (value, max = 100) => {
    const out = String(value || '').trim();
    if (!out || out.length > max || /[<>"`]/.test(out)) throw error('Nombre inválido.', 400);
    return out;
  };
  const auth = async (request, env) => {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw error('Inicia sesión para participar.', 401);
    let firebase;
    try { firebase = await verifyFirebaseUser(token); } catch { throw error('Vuelve a iniciar sesión.', 401); }
    const id = 'auth-' + firebase.localId;
    const [role, profile] = await Promise.all([db(env, '/roles/' + firebase.localId), db(env, '/users/' + id)]);
    if (role && ['admin', 'cashier', 'kitchen'].includes(role)) throw error('Usa una cuenta de cliente.', 403);
    if (!firebase.emailVerified || !profile || profile.role !== 'customer' || !profile.name || !profile.phone || !profile.dni) {
      throw error('Completa y verifica tu perfil antes de jugar.', 409);
    }
    return { id, name: clean(profile.name) };
  };
  const code = () => {
    const bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
    return String(100000 + (bytes[0] % 900000));
  };
  const secureIndex = length => {
    if (length < 1) throw error('No hay participantes.', 409);
    const range = 0x100000000, limit = Math.floor(range / length) * length, bytes = new Uint32Array(1);
    do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return bytes[0] % length;
  };
  const assertGame = (game, actor) => {
    if (!game) throw error('Ese código no existe o ya venció.', 404);
    if (Date.parse(game.expiresAt || 0) <= Date.now()) throw error('El código temporal venció. Crea un juego nuevo.', 410);
    if (game.status === 'cancelled') throw error('Este juego fue cerrado.', 409);
    if (!game.members?.[actor.id]) throw error('Primero debes unirte al juego.', 403);
  };
  const publicGame = (game, actor) => {
    const spinDone=game.status==='spinning'&&Date.now()>=Date.parse(game.spinEndsAt||0);
    const effectiveStatus=spinDone?'drawn':game.status;
    const winner = effectiveStatus==='drawn'&&game.winnerId && game.members?.[game.winnerId];
    const publicId=m=>m?.publicId||m?.id||'';
    return { id:game.id, code:game.code, status:effectiveStatus, round:Number(game.round || 1), organizerId:publicId(game.members?.[game.organizerId]),
      isOrganizer:game.organizerId === actor.id, meId:publicId(game.members?.[actor.id]), createdAt:game.createdAt, expiresAt:game.expiresAt,
      members:values(game.members).map(m=>({id:publicId(m),name:m.name,joinedAt:m.joinedAt})),
      winner:winner?{id:publicId(winner),name:winner.name}:null, resultAt:game.resultAt || '', revision:game.revision || '',serverNow:new Date().toISOString(),
      spin:game.spinStartedAt?{startedAt:game.spinStartedAt,endsAt:game.spinEndsAt,durationMs:Number(game.spinDurationMs||6500),rotationDeg:Number(game.spinRotationDeg||0)}:null };
  };
  async function create(env, actor) {
    for (let attempt=0; attempt<8; attempt+=1) {
      const roomCode=code(), now=new Date(), expires=new Date(now.getTime()+2*60*60*1000); let created=false;
      const game=await mutateDb(env,'/payerGames/'+roomCode,old=>{
        if (old && Date.parse(old.expiresAt || 0)>Date.now()) return old;
        created=true;
        return {id:roomCode,code:roomCode,status:'open',round:1,organizerId:actor.id,createdAt:now.toISOString(),expiresAt:expires.toISOString(),
          members:{[actor.id]:{id:actor.id,publicId:crypto.randomUUID(),name:actor.name,joinedAt:now.toISOString()}},winnerId:'',resultAt:'',revision:crypto.randomUUID()};
      },5,true);
      if (created) return game;
    }
    throw error('No se pudo crear el código. Inténtalo nuevamente.',503);
  }
  async function route(request, env) {
    const actor=await auth(request,env), url=new URL(request.url);
    if (request.method==='GET') {
      const roomCode=String(url.searchParams.get('code')||'').replace(/\D/g,'');
      if (!/^\d{6}$/.test(roomCode)) throw error('Escribe el código de 6 números.',400);
      const game=await db(env,'/payerGames/'+roomCode); assertGame(game,actor); return json(publicGame(game,actor));
    }
    const input=await request.json().catch(()=>({})), action=String(input.action||'');
    if (action==='create') return json(publicGame(await create(env,actor),actor));
    const roomCode=String(input.code||'').replace(/\D/g,'');
    if (!/^\d{6}$/.test(roomCode)) throw error('Escribe el código de 6 números.',400);
    if (action==='join') {
      const game=await mutateDb(env,'/payerGames/'+roomCode,current=>{
        if (!current || Date.parse(current.expiresAt||0)<=Date.now() || current.status==='cancelled') throw error('Ese código no existe o ya venció.',404);
        if (current.status!=='open') throw error('La ruleta ya giró. Pídele al organizador iniciar otra ronda.',409);
        current.members=current.members||{};
        if (!current.members[actor.id] && values(current.members).length>=12) throw error('La ruleta ya tiene 12 participantes.',409);
        current.members[actor.id]=current.members[actor.id]||{id:actor.id,publicId:crypto.randomUUID(),name:actor.name,joinedAt:new Date().toISOString()};
        current.revision=crypto.randomUUID(); return current;
      });
      return json(publicGame(game,actor));
    }
    const game=await mutateDb(env,'/payerGames/'+roomCode,current=>{
      assertGame(current,actor); current.members=current.members||{};
      if(current.status==='spinning'&&Date.now()>=Date.parse(current.spinEndsAt||0))current.status='drawn';
      if (action==='draw') {
        if (current.organizerId!==actor.id) throw error('Solo el organizador puede girar la ruleta.',403);
        if (current.status!=='open') throw error('Esta ronda ya tiene resultado.',409);
        const members=values(current.members); if (members.length<2) throw error('Invita al menos a otra persona.',409);
        const winnerIndex=secureIndex(members.length),duration=6500,started=Date.now()+900;
        current.winnerId=members[winnerIndex].id;current.status='spinning';current.spinStartedAt=new Date(started).toISOString();current.spinEndsAt=new Date(started+duration).toISOString();current.spinDurationMs=duration;
        current.spinRotationDeg=6*360+(360-winnerIndex*360/members.length)%360;current.resultAt=new Date(started+duration).toISOString();
      } else if (action==='new_round') {
        if (current.organizerId!==actor.id) throw error('Solo el organizador puede iniciar otra ronda.',403);
        if (current.status!=='drawn') throw error('Primero gira la ruleta.',409);
        current.status='open'; current.round=Number(current.round||1)+1; current.winnerId=''; current.resultAt='';current.spinStartedAt='';current.spinEndsAt='';current.spinDurationMs=0;current.spinRotationDeg=0;
      } else if (action==='leave') {
        if (current.organizerId===actor.id) throw error('El organizador debe cerrar el juego.',409);
        if (current.status!=='open') throw error('No puedes salir después del resultado.',409);
        delete current.members[actor.id];
      } else if (action==='cancel') {
        if (current.organizerId!==actor.id) throw error('Solo el organizador puede cerrar el juego.',403);
        current.status='cancelled'; current.cancelledAt=new Date().toISOString();
      } else throw error('Acción inválida.',400);
      current.revision=crypto.randomUUID(); return current;
    });
    return json(publicGame(game,actor));
  }
  return { route };
}
