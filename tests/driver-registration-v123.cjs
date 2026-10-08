const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const state={roles:{admin:'admin'},drivers:{}};const copy=x=>x==null?x:structuredClone(x);
const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state)??null;
const set=(p,x)=>{const a=p.split('/').filter(Boolean),k=a.pop();let v=state;for(const s of a)v=v[s]||={};if(x==null)delete v[k];else v[k]=copy(x)};
const db=async(e,p,i)=>{if(i)set(p,i.method==='DELETE'?null:JSON.parse(i.body));return copy(get(p))};
const mutateDb=async(e,p,fn,attempts=5,allowCreate=false)=>{if(!get(p)&&!allowCreate)throw Error("El registro no existe.");const x=fn(copy(get(p)));set(p,x);return copy(x)};
const docs=new Set(),sent=[];let pushFails=false;
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto,Response,URL,Date,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../server/delivery.js'),'utf8').replace('export function','function')+'\nglobalThis.make=createDelivery',ctx);
const d=ctx.make({db,mutateDb,verifyFirebaseUser:async id=>({localId:id,email:id+'@test',emailVerified:id!=='unverified'}),json:(x,s=200)=>new Response(JSON.stringify(x),{status:s}),readBody:r=>r.json(),documentExists:async(e,k)=>docs.has(k),readDocument:async(e,k)=>new Response(k,{status:docs.has(k)?200:404}),uploadDocument:async(e,k)=>docs.add(k),notifyDriverApproved:async(e,id)=>{if(pushFails)throw Error('offline');sent.push(id);return {sent:1}}});
const req=(who,method='GET',data)=>new Request('https://test/api',{method,headers:{Authorization:'Bearer '+who},body:data===undefined?undefined:JSON.stringify(data)});
const reject=async(p,status)=>{await assert.rejects(p,e=>e.status===status)};
function application(id,type='Moto'){
 const p={name:'Repartidor',dni:'0801199912345',phone:'99991111',residenceAddress:'Casa',residenceReference:'Portón',consent:'on',vehicleType:type,vehiclePlate:'ABC123',licenseNumber:'LIC1',licenseExpires:'2099-01-01',vehicleVin:'1HGCM82633A004352'};
 for(const [field,kind]of Object.entries({selfieObject:'selfie',licenseObject:'license',vehicleRightObject:'vehicle-right',vehicleLeftObject:'vehicle-left',vinObject:'vin',vehicleObject:'vehicle'})){p[field]=`drivers/${id}/${kind}-1.jpg`;docs.add(p[field])}
 return p;
}
(async()=>{
 const motor=application('moto');await reject(d.profile(req('moto','POST',{...motor,licenseExpires:'2099-99-99'}),{}),400);
 for(const kind of ['vehicle-right','vehicle-left','vin','vehicle']){const url=new URL('https://test/api/delivery/document?kind='+kind);const response=await d.documentUpload(new Request(url,{method:'POST',headers:{Authorization:'Bearer moto','Content-Type':'image/png'},body:Uint8Array.from([137,80,78,71,13,10,26,10])}),{},url);const result=await response.json();assert(docs.has(result.objectName));assert(result.objectName.startsWith('drivers/moto/'+kind+'-'));}
await reject(d.profile(req('moto','POST',{...motor,vehicleVin:''}),{}),400);
 await reject(d.profile(req('moto','POST',{...motor,vinObject:'drivers/other/vin-1.jpg'}),{}),403);
 docs.delete(motor.vehicleLeftObject);await reject(d.profile(req('moto','POST',motor),{}),400);docs.add(motor.vehicleLeftObject);
 await d.profile(req('moto','POST',motor),{});assert.equal(state.drivers['auth-moto'].vehicleVin,motor.vehicleVin);
 const bike=application('bike','Bicicleta');for(const k of ['licenseNumber','licenseExpires','vehiclePlate','vehicleVin','licenseObject','vehicleRightObject','vehicleLeftObject','vinObject'])delete bike[k];
 await d.profile(req('bike','POST',bike),{});assert.equal(state.drivers['auth-bike'].vehicleVin,'');
 await reject(d.admin(req('moto','POST',{action:'approve',driverId:'auth-bike'}),{}),403);
 await d.admin(req('admin','POST',{action:'approve',driverId:'auth-moto'}),{});assert.deepEqual(sent,['auth-moto']);
 await d.admin(req('admin','POST',{action:'approve',driverId:'auth-moto'}),{});assert.equal(sent.length,1,'repeated approval must not send again');
 await reject(d.profile(req('moto','POST',{...motor,vehicleVin:'1HGCM82633A004353'}),{}),409);
 await d.profile(req('unverified','POST',application('unverified','Automóvil')),{});await reject(d.admin(req('admin','POST',{action:'approve',driverId:'auth-unverified'}),{}),409);
 const car=application('car','Automóvil');await d.profile(req('car','POST',car),{});docs.delete(car.vinObject);await reject(d.admin(req('admin','POST',{action:'approve',driverId:'auth-car'}),{}),400);assert.equal(sent.length,1);
 await reject(d.documentRead(req('bike'),{},'auth-moto','vin'),403);assert.equal((await d.documentRead(req('admin'),{},'auth-moto','vin')).status,200);
 pushFails=true;await d.admin(req('admin','POST',{action:'approve',driverId:'auth-bike'}),{});assert.equal(state.drivers['auth-bike'].status,'approved');assert.notEqual(state.drivers['auth-bike'].approvalPush.state,'sent');
 pushFails=false;await d.flushApprovalPushes({});assert.deepEqual(sent,['auth-moto','auth-bike']);
 const p=await (await d.profile(req('bike'),{})).json();assert.equal(p.profile.approvalNotice.title,'Solicitud aprobada');assert.equal(p.profile.vehicleObject,undefined,'private object keys not exposed');
 console.log('PASS V123: vehicles, VIN, required stored photos, permissions, repeat approval, targeted push retry and in-app notice');
})().catch(e=>{console.error(e);process.exitCode=1});
