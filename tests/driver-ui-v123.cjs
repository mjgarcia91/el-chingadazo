const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../delivery/app.js'),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function boot(profile=null){
 const dom=new JSDOM('<div id="deliveryApp"></div>',{url:'https://example.test/delivery/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,alerts=[],uploads=[],posts=[],timers=[];
 let current=profile;
 w.alert=x=>alerts.push(x); w.scrollTo=()=>{};w.setInterval=fn=>(timers.push(fn),timers.length);w.clearInterval=()=>{};
 w.AuthBridge={ready:Promise.resolve(),current:async()=>({uid:'test',email:'personal-address@example.test'}),idToken:async()=>'token',message:e=>e.message};
 w.fetch=async(url,options={})=>{
  if(url.startsWith('/api/delivery/avatar'))return new Response('',{status:404});
  let data={};
  if(url==='/api/delivery/profile'){
   if(options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);current={...current,...body,status:'pending'};}
   data={profile:current};
  } else if(url.startsWith('/api/delivery/document?')){const kind=new URL(url,w.location.origin).searchParams.get('kind');uploads.push(kind);data={objectName:`drivers/test/${kind}-1.jpg`};}
  else if(url==='/api/delivery/push-config')data={enabled:false};
  else if(url==='/api/delivery/orders')data={available:[],mine:[],history:[],profile:current};
  else throw Error('Unexpected request '+url);
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 w.eval(source);await tick();await tick();return {w,dom,alerts,uploads,posts,timers,setProfile:p=>current=p};
}
(async()=>{
 const c=await boot();let f=c.w.document.querySelector('#registerForm');
 assert(f);assert(!f.textContent.includes('personal-address@'));assert(!f.textContent.includes('documentos son privados'));
 assert(f.textContent.includes('Una vez registrado recibirás confirmación dentro de la app sobre tu aprobación.'));
 for(const type of ['Bicicleta','Automóvil','Moto']){
  f.elements.vehicleType.value=type;f.elements.vehicleType.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  const bike=type==='Bicicleta';assert.equal(f.elements.vehicleVin.disabled,bike);assert.equal(f.elements.vehicleVin.required,!bike);
  assert.equal(f.elements.licenseNumber.disabled,bike);assert.equal(f.querySelector('#doc-vehicle').required,bike);
  for(const kind of ['vehicle-right','vehicle-left','vin','license'])assert.equal(f.querySelector('#doc-'+kind).required,!bike);
 }
 c.dom.window.close();
 for(const type of ['Bicicleta','Moto','Automóvil']){
  const p={name:'Driver',dni:'0801199912345',phone:'99991111',residenceAddress:'Casa',residenceReference:'Portón',status:'pending',vehicleType:type,hasSelfie:true,emailVerified:true};
  const c=await boot(p);c.w.document.querySelector('[data-action="edit-application"]').click();const f=c.w.document.querySelector('#registerForm');
  if(type!=='Bicicleta'){f.elements.vehiclePlate.value='ABC123';f.elements.vehicleVin.value='1HGCM82633A004352';f.elements.licenseNumber.value='LIC1';f.elements.licenseExpires.value='2099-01-01';}
  f.elements.consent.checked=true;
  for(const el of f.querySelectorAll('input[type="file"]:not(:disabled)'))Object.defineProperty(el,'files',{value:[new c.w.File(['photo'],'photo.jpg',{type:'image/jpeg'})]});
  // jsdom does not connect an injected FileList to native file-input validity.
  f.reportValidity=()=>[...f.elements].filter(e=>e.type!=="file").every(e=>e.checkValidity());
  assert(f.reportValidity());f.dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();await tick();
  assert.equal(c.posts.length,1,c.alerts.join(' / '));
  assert.deepEqual(c.uploads,type==='Bicicleta'?['vehicle']:['license','vehicle-right','vehicle-left','vin']);
  if(type==='Bicicleta'){assert.equal(c.posts[0].vehicleVin,undefined);assert.equal(c.posts[0].licenseNumber,undefined);}
  assert(c.w.document.querySelector('[data-action="approval-push"]'));
  c.setProfile({...p,status:'approved',approvalNotice:{title:'Solicitud aprobada',body:'Puedes recibir entregas'}});await c.timers[0]();await tick();
  assert.match(c.w.document.body.textContent,/Solicitud aprobada/);assert.match(c.w.document.body.textContent,/Entregas disponibles/);
  c.dom.window.close();
 }
 console.log('PASS V123 UI: moto/car/bicycle fields, image uploads, removed account email, submit and live approval notice');
})().catch(e=>{console.error(e);process.exitCode=1});
