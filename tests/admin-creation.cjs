const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('_worker.js','utf8');
const state={roles:{owner:'admin',cash:'cashier'},users:{'auth-owner':{active:true}},settings:{open:false}};
const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state)??null;
const error=(message,status)=>Object.assign(new Error(message),{status});
let failCommit=false,authorized=true,commits=0;
const ctx=vm.createContext({Response,Date,JSON,crypto:require('node:crypto').webcrypto,
 json:(x,s=200)=>new Response(JSON.stringify(x),{status:s}),body:r=>r.json(),
 verifyFirebaseUser:async token=>{if(!token)throw error('No session',401);return {localId:token};},
 requireStaff:async(r)=>{const id=r.headers.get('Authorization')?.slice(7);if(!id)throw error('No session',401);if(state.roles[id]!=='admin'||state.users['auth-'+id]?.active===false)throw error('Denied',403);},
 db:async(e,p)=>structuredClone(get(p)),pinKey:async(e,p)=>require('node:crypto').createHash('sha256').update(p).digest('hex'),
 firebaseUserByUid:async()=>{throw Error('New PIN users must not require an existing Authentication account');},
 authorizedDevice:async()=>authorized,customToken:async(e,uid,profile)=>{assert.equal(profile.role,'admin');return 'test-custom-token';},
 mutateDb:async(e,p,fn)=>{assert.equal(p,'');if(failCommit)throw error('Simulated database outage',503);const next=fn(structuredClone(state));for(const k of Object.keys(state))delete state[k];Object.assign(state,structuredClone(next));commits++;return state;}
});
vm.runInContext(source.slice(source.indexOf('async function provision('),source.indexOf('async function changeOrderStatus(')),ctx);
const base={name:'Admin Test',role:'admin',pin:'456789'};
const request=(data,who='owner')=>new Request('https://test/api/staff-provision',{method:'POST',headers:who?{Authorization:'Bearer '+who}:{},body:JSON.stringify(data)});
async function call(data,who){try{return await ctx.provision(request(data,who),{});}catch(e){return new Response(JSON.stringify({error:e.message}),{status:e.status||500});}}
(async()=>{
 for(const who of ['cash','customer',''])assert([401,403].includes((await call(base,who)).status));
 state.users['auth-owner'].active=false;assert.equal((await call(base)).status,403);state.users['auth-owner'].active=true;
 for(const patch of [{name:''},{role:'superadmin'},{pin:'123'},{photoURL:'data:text/html,x'}])assert.equal((await call({...base,...patch})).status,400);
 assert.equal(commits,0);
 failCommit=true;assert.equal((await call(base)).status,503);assert.equal(Object.keys(state.users).length,1);failCommit=false;
 const result=await call(base);assert.equal(result.status,200);const {profile}=await result.json();
 assert.equal(profile.authProvider,'custom');assert.equal(profile.email,'');assert.equal(state.roles[profile.authUid],'admin');
 const hash=await ctx.pinKey({},base.pin);assert.equal(state.staffPins[hash].uid,profile.authUid);assert.equal(state.staffPinByUid[profile.authUid],hash);
 assert(!JSON.stringify(state).includes(base.pin));assert.equal(state.settings.open,false);
 assert.equal((await call(base)).status,409);assert.equal(commits,1);
 assert.equal((await call({...base,role:'cashier',pin:'654321'})).status,200);
 assert.equal((await call({...base,role:'kitchen',pin:'765432'})).status,200);
 const login=await ctx.login(request({pin:base.pin}),{});assert.equal(login.status,200);assert.equal((await login.json()).profile.role,'admin');
 authorized=false;assert.equal((await ctx.login(request({pin:base.pin}),{})).status,403);
 console.log('PASS staff PIN creation: admin-only, no UID/email/password, atomic save, unique PIN, all three roles, admin PIN login on authorized devices only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
