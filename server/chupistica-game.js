import { CHUPISTICA_QUESTIONS } from './chupistica-questions.js';

// Trivia privada y temporal. El servidor elige preguntas, baraja respuestas,
// controla el reloj y calcula el puntaje para que todos compartan una sola partida.
export function createChupisticaGame({ db, mutateDb, verifyFirebaseUser, json }) {
  const error=(message,status=403)=>Object.assign(new Error(message),{status});
  const values=value=>value?Object.values(value).filter(Boolean):[];
  const byId=new Map(CHUPISTICA_QUESTIONS.map(q=>[q.id,q]));
  const clean=(value,max=100)=>{const out=String(value||'').trim();if(!out||out.length>max||/[<>"`]/.test(out))throw error('Nombre inválido.',400);return out;};
  const auth=async(request,env)=>{
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    if(!token)throw error('Inicia sesión para jugar.',401);
    let firebase;try{firebase=await verifyFirebaseUser(token);}catch{throw error('Vuelve a iniciar sesión.',401);}
    const id='auth-'+firebase.localId;
    const [role,profile]=await Promise.all([db(env,'/roles/'+firebase.localId),db(env,'/users/'+id)]);
    if(role&&['admin','cashier','kitchen'].includes(role))throw error('Usa una cuenta de cliente.',403);
    if(!firebase.emailVerified||!profile||profile.role!=='customer'||!profile.name||!profile.phone||!profile.dni)throw error('Completa y verifica tu perfil antes de jugar.',409);
    return{id,name:clean(profile.name)};
  };
  const randomIndex=length=>{
    if(length<1)throw error('No hay opciones disponibles.',409);
    const range=0x100000000,limit=Math.floor(range/length)*length,bytes=new Uint32Array(1);
    do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
    return bytes[0]%length;
  };
  const shuffle=input=>{const out=[...input];for(let i=out.length-1;i>0;i-=1){const j=randomIndex(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;};
  const code=()=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return String(100000+(bytes[0]%900000));};
  const assertGame=(game,actor)=>{
    if(!game)throw error('Ese código no existe o ya venció.',404);
    if(Date.parse(game.expiresAt||0)<=Date.now())throw error('El código temporal venció. Crea otra partida.',410);
    if(game.status==='cancelled')throw error('Esta partida fue cerrada.',409);
    if(!game.members?.[actor.id])throw error('Primero debes unirte a la partida.',403);
  };
  const publicId=member=>member?.publicId||'';
  const questionView=game=>{
    const q=byId.get(game.questionIds?.[Number(game.questionIndex||0)]);if(!q)return null;
    const order=game.optionOrders?.[Number(game.questionIndex||0)]||[0,1,2,3];
    return{id:q.id,category:q.category,prompt:q.prompt,options:order.map(i=>q.options[i]),number:Number(game.questionIndex||0)+1,total:game.questionIds.length,endsAt:game.questionEndsAt};
  };
  const publicGame=(game,actor)=>{
    const members=values(game.members).map(m=>({id:publicId(m),name:m.name,score:Number(m.score||0),joinedAt:m.joinedAt})).sort((a,b)=>b.score-a.score||a.joinedAt.localeCompare(b.joinedAt));
    const q=questionView(game),roundKey=q?.id||'',answer=game.answers?.[roundKey]?.[actor.id];
    const out={id:game.id,code:game.code,status:game.status,hostId:publicId(game.members?.[game.hostId]),isHost:game.hostId===actor.id,meId:publicId(game.members?.[actor.id]),createdAt:game.createdAt,expiresAt:game.expiresAt,serverNow:new Date().toISOString(),revision:game.revision||'',members};
    if(['question','reveal'].includes(game.status)&&q){
      out.question=q;out.answeredCount=values(game.answers?.[roundKey]).length;out.myAnswer=answer?Number(answer.option):-1;
      if(game.status==='reveal'){
        const raw=byId.get(q.id),order=game.optionOrders[Number(game.questionIndex||0)];
        out.question.correctIndex=order.indexOf(raw.correct);out.question.explanation=raw.explanation;out.myCorrect=Boolean(answer?.correct);out.myPoints=Number(answer?.points||0);
      }
    }
    return out;
  };
  async function create(env,actor){
    for(let attempt=0;attempt<8;attempt+=1){
      const roomCode=code(),now=new Date(),expires=new Date(now.getTime()+2*60*60*1000);let created=false;
      const game=await mutateDb(env,'/chupisticaGames/'+roomCode,old=>{
        if(old&&Date.parse(old.expiresAt||0)>Date.now())return old;
        created=true;return{id:roomCode,code:roomCode,status:'lobby',hostId:actor.id,createdAt:now.toISOString(),expiresAt:expires.toISOString(),questionIds:[],optionOrders:[],questionIndex:0,answers:{},members:{[actor.id]:{id:actor.id,publicId:crypto.randomUUID(),name:actor.name,score:0,joinedAt:now.toISOString()}},revision:crypto.randomUUID()};
      },5,true);
      if(created)return game;
    }
    throw error('No se pudo crear el código. Inténtalo nuevamente.',503);
  }
  const beginQuestion=game=>{
    const now=Date.now();game.status='question';game.questionStartedAt=new Date(now).toISOString();game.questionEndsAt=new Date(now+15000).toISOString();game.revealedAt='';
  };
  async function route(request,env){
    const actor=await auth(request,env),url=new URL(request.url);
    if(request.method==='GET'){
      const roomCode=String(url.searchParams.get('code')||'').replace(/\D/g,'');if(!/^\d{6}$/.test(roomCode))throw error('Escribe el código de 6 números.',400);
      const game=await db(env,'/chupisticaGames/'+roomCode);assertGame(game,actor);return json(publicGame(game,actor));
    }
    const input=await request.json().catch(()=>({})),action=String(input.action||'');
    if(action==='create')return json(publicGame(await create(env,actor),actor));
    const roomCode=String(input.code||'').replace(/\D/g,'');if(!/^\d{6}$/.test(roomCode))throw error('Escribe el código de 6 números.',400);
    if(action==='join'){
      const game=await mutateDb(env,'/chupisticaGames/'+roomCode,current=>{
        if(!current||Date.parse(current.expiresAt||0)<=Date.now()||current.status==='cancelled')throw error('Ese código no existe o ya venció.',404);
        if(current.status!=='lobby')throw error('La partida ya comenzó. Espera el próximo código.',409);
        current.members=current.members||{};if(!current.members[actor.id]&&values(current.members).length>=20)throw error('La sala ya tiene 20 jugadores.',409);
        current.members[actor.id]=current.members[actor.id]||{id:actor.id,publicId:crypto.randomUUID(),name:actor.name,score:0,joinedAt:new Date().toISOString()};current.revision=crypto.randomUUID();return current;
      });
      return json(publicGame(game,actor));
    }
    const game=await mutateDb(env,'/chupisticaGames/'+roomCode,current=>{
      assertGame(current,actor);current.members=current.members||{};
      if(action==='start'){
        if(current.hostId!==actor.id)throw error('Solo el anfitrión puede comenzar.',403);
        if(current.status!=='lobby')throw error('La partida ya comenzó.',409);
        if(values(current.members).length<2)throw error('Invita al menos a otra persona.',409);
        const categories=[...new Set(CHUPISTICA_QUESTIONS.map(q=>q.category))],firstPass=shuffle(categories).map(category=>{const pool=CHUPISTICA_QUESTIONS.filter(q=>q.category===category);return pool[randomIndex(pool.length)].id;}),rest=shuffle(CHUPISTICA_QUESTIONS.map(q=>q.id).filter(id=>!firstPass.includes(id)));
        const picked=shuffle([...firstPass,...rest.slice(0,10-firstPass.length)]);current.questionIds=picked;current.optionOrders=picked.map(()=>shuffle([0,1,2,3]));current.questionIndex=0;current.answers={};values(current.members).forEach(m=>{m.score=0;});beginQuestion(current);
      }else if(action==='answer'){
        if(current.status!=='question')throw error('Ahora no hay una pregunta abierta.',409);
        if(Date.now()>Date.parse(current.questionEndsAt||0))throw error('Se terminó el tiempo de esta pregunta.',409);
        const option=Number(input.option);if(!Number.isInteger(option)||option<0||option>3)throw error('Respuesta inválida.',400);
        const qid=current.questionIds[current.questionIndex];current.answers=current.answers||{};current.answers[qid]=current.answers[qid]||{};
        if(current.answers[qid][actor.id])throw error('Ya respondiste esta pregunta.',409);
        current.answers[qid][actor.id]={option,answeredAt:new Date().toISOString()};
      }else if(action==='reveal'){
        if(current.hostId!==actor.id)throw error('Solo el anfitrión puede revelar la respuesta.',403);
        if(current.status!=='question')throw error('La respuesta ya fue revelada.',409);
        const qid=current.questionIds[current.questionIndex],q=byId.get(qid),order=current.optionOrders[current.questionIndex],correctIndex=order.indexOf(q.correct),started=Date.parse(current.questionStartedAt),duration=Math.max(1,Date.parse(current.questionEndsAt)-started);
        const roundAnswers=current.answers?.[qid]||{};
        values(current.members).forEach(member=>{const answer=roundAnswers[member.id];if(!answer)return;const correct=Number(answer.option)===correctIndex,remaining=Math.max(0,Date.parse(current.questionEndsAt)-Date.parse(answer.answeredAt));answer.correct=correct;answer.points=correct?600+Math.round(400*remaining/duration):0;member.score=Number(member.score||0)+answer.points;});
        current.status='reveal';current.revealedAt=new Date().toISOString();
      }else if(action==='next'){
        if(current.hostId!==actor.id)throw error('Solo el anfitrión puede continuar.',403);
        if(current.status!=='reveal')throw error('Primero revela la respuesta.',409);
        if(Number(current.questionIndex)+1>=current.questionIds.length){current.status='finished';current.finishedAt=new Date().toISOString();}
        else{current.questionIndex=Number(current.questionIndex)+1;beginQuestion(current);}
      }else if(action==='leave'){
        if(current.hostId===actor.id)throw error('El anfitrión debe cerrar la partida.',409);
        if(current.status!=='lobby')throw error('No puedes salir después de comenzar.',409);delete current.members[actor.id];
      }else if(action==='cancel'){
        if(current.hostId!==actor.id)throw error('Solo el anfitrión puede cerrar la partida.',403);current.status='cancelled';current.cancelledAt=new Date().toISOString();
      }else throw error('Acción inválida.',400);
      current.revision=crypto.randomUUID();return current;
    });
    return json(publicGame(game,actor));
  }
  return{route};
}
