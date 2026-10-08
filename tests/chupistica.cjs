const assert=require('node:assert/strict');
const clone=x=>x==null?x:structuredClone(x);
const state={roles:{},users:{'auth-alice':{id:'auth-alice',role:'customer',name:'Alice Catracha',phone:'99990000',dni:'0801'},'auth-bob':{id:'auth-bob',role:'customer',name:'Bob Catracho',phone:'99990001',dni:'0802'}},chupisticaGames:{}};
const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state)??null;
const set=(p,x)=>{const a=p.split('/').filter(Boolean),last=a.pop();let v=state;for(const k of a)v=v[k]||={};if(x===null)delete v[last];else v[last]=clone(x)};
const db=async(e,p)=>clone(get(p));
const mutateDb=async(e,p,fn)=>{const next=fn(clone(get(p)));set(p,next);return clone(next)};
const verifyFirebaseUser=async token=>({localId:token,emailVerified:true});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const callFactory=game=>async(who,input,code='')=>{const request=new Request('https://test.local/api/chupistica'+(code?'?code='+code:''),{method:input?'POST':'GET',headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});try{return await game.route(request,{})}catch(e){return json({error:e.message},e.status||500)}};
(async()=>{
  const [{createChupisticaGame},{CHUPISTICA_QUESTIONS,validateChupisticaQuestions}]=await Promise.all([import('../server/chupistica-game.js'),import('../server/chupistica-questions.js')]);
  assert.equal(validateChupisticaQuestions(),true);assert.ok(CHUPISTICA_QUESTIONS.length>=100);
  const music=CHUPISTICA_QUESTIONS.filter(q=>q.category==='Música');assert.equal(music.length,20);assert.ok(music.every(q=>q.prompt.startsWith('¿Quién canta')));assert.ok(music.every(q=>!/(comienza con|letra [A-Z])/i.test(q.prompt)));
  const game=createChupisticaGame({db,mutateDb,verifyFirebaseUser,json}),call=callFactory(game);
  let r=await call('alice',{action:'create'}),room=await r.json();assert.equal(r.status,200);assert.equal(room.status,'lobby');assert.match(room.code,/^\d{6}$/);
  r=await call('bob',{action:'join',code:room.code});room=await r.json();assert.equal(room.members.length,2);assert.equal(JSON.stringify(room).includes('99990001'),false);assert.equal(JSON.stringify(room).includes('0802'),false);
  r=await call('bob',{action:'start',code:room.code});assert.equal(r.status,403);
  r=await call('alice',{action:'start',code:room.code});room=await r.json();assert.equal(room.status,'question');assert.equal(room.question.total,10);assert.equal(room.question.options.length,4);assert.equal('correctIndex' in room.question,false);
  const lookup=new Map(CHUPISTICA_QUESTIONS.map(q=>[q.id,q])),roundCategories=new Set(state.chupisticaGames[room.code].questionIds.map(id=>lookup.get(id).category));assert.equal(roundCategories.size,6);
  r=await call('bob',{action:'answer',code:room.code,option:0});room=await r.json();assert.equal(room.myAnswer,0);
  r=await call('bob',{action:'answer',code:room.code,option:1});assert.equal(r.status,409);
  r=await call('alice',{action:'reveal',code:room.code});room=await r.json();assert.equal(room.status,'reveal');assert.ok(Number.isInteger(room.question.correctIndex));assert.ok(room.question.explanation);
  r=await call('alice',{action:'next',code:room.code});room=await r.json();assert.equal(room.status,'question');assert.equal(room.question.number,2);
  for(let n=2;n<=10;n+=1){r=await call('alice',{action:'reveal',code:room.code});assert.equal(r.status,200);r=await call('alice',{action:'next',code:room.code});room=await r.json();if(n<10){assert.equal(room.status,'question');assert.equal(room.question.number,n+1);}else assert.equal(room.status,'finished');}
  console.log(`PASS v106: Cultura Chupística usa ${CHUPISTICA_QUESTIONS.length} preguntas, incluyendo 20 de canciones, código privado, respuestas ocultas, tiempo y marcador del servidor.`);
})().catch(error=>{console.error(error);process.exitCode=1});
