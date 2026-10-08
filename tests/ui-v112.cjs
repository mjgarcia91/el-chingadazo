// DOM simulation only: no real Firebase, payment, printer or browser connection.
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dom=new JSDOM('<!doctype html><div id="app"></div><audio id="kitchenAlarm"></audio>',{url:'https://test.local/personal',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,ctx=dom.getInternalVMContext(),calls=[],alerts=[];
Object.assign(w,{structuredClone,Response,Headers,Request,TextEncoder,TextDecoder,fetch:async(url,init={})=>{
 calls.push({url:String(url),data:init.body?JSON.parse(init.body):null});
 if(String(url)==='/api/staff-manage')return new Response(JSON.stringify({profile:{id:'auth-cash',role:'cashier',name:JSON.parse(init.body).name}}));
 return new Response(JSON.stringify(String(url)==='/api/instagram-stories'?{requests:[]} : {}));
},alert:x=>alerts.push(x),confirm:()=>true,scrollTo:()=>{},matchMedia:()=>({matches:false,addEventListener:()=>{}}),setInterval:()=>0,setTimeout:()=>0,AuthBridge:{idToken:async()=> 'test-token',current:async()=>null},Cloud:{sync:async()=>({}),getStatus:()=> 'test'},PrivateSession:{clear:()=>{},generation:()=>0}});
w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
const run=s=>vm.runInContext(s,ctx);
// Follow the actual entrypoint instead of inventing a dependency list.
for(const tag of read('personal.html').matchAll(/<script src="([^"]+)"/g)){const p=tag[1].split('?')[0].replace(/^\//,'');if(['js/auth.js','js/transport.js','js/sync.js','js/printer.js'].includes(p))continue;run(read(p));}
const settle=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
function submit(f,button){f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button||f.querySelector('button[type="submit"]')}));}
(async()=>{
 await settle();
 assert(!run("appBooting"), "staff boot must finish without manually clearing appBooting");
 assert(w.document.querySelector(".page"), "staff entrypoint must render");
 run(`appBooting=false;STATE.installPromptVisible=false;Store.patch(d=>{d.users=[{id:'auth-admin',name:'Admin Prueba',role:'admin',active:true},{id:'auth-cash',name:'Caja Prueba',role:'cashier',active:true},{id:'auth-customer',name:'Cliente Prueba',role:'customer',points:0}];d.session='auth-admin';d.orders=[];});window.__verifiedProfile=Store.get().users[0];`);
 run("go('admin-crm')");
 assert(w.document.querySelector('#salesRangeForm'));
 let f=w.document.querySelector('#salesRangeForm');f.elements.from.value='2026-09-01';f.elements.to.value='2026-09-15';submit(f);await settle();
 assert(w.document.body.textContent.includes('Del 2026-09-01 al 2026-09-15'));
 w.document.querySelector('[data-cal-day="2026-09-04"]').click();assert(w.document.body.textContent.includes('Día 2026-09-04'));
 f=w.document.querySelector('#salesRangeForm');f.elements.from.value='2026-09-15';f.elements.to.value='2026-09-01';submit(f);await settle();assert(alerts.some(x=>x.includes('fecha inicial')));
 run("go('admin-users')");f=w.document.querySelector('[data-staff-name-form="auth-cash"]');assert(f);f.elements.name.value='Caja Renombrada';submit(f);await settle();
 assert.equal(run("Store.get().users.find(u=>u.id==='auth-cash').name"),'Caja Renombrada');assert(calls.some(x=>x.data?.action==='rename'));
 assert(!w.document.querySelector('[data-staff-remove="auth-admin"]'));assert(w.document.querySelector('[data-staff-remove="auth-cash"]'));
 run("go('caja')");const invoice=[...w.document.querySelectorAll('#posSell,#posSellAlternate')].find(b=>b.textContent==='Cobrar e imprimir');assert(invoice?.classList.contains('green'));assert(invoice.closest('[data-cash-screen="payment"]'));
 run("window.__verifiedProfile=Store.get().users.find(u=>u.id==='auth-customer');Store.patch(d=>d.session='auth-customer');go('account')");assert(w.document.querySelector('[data-go="stories"]'));
 w.document.querySelector('[data-go="stories"]').click();assert(w.document.querySelector('#storyForm'));assert(w.document.body.textContent.includes('500 seguidores'));assert(w.document.body.textContent.includes('24 horas'));assert(w.document.body.textContent.includes('23 horas'));assert(w.document.querySelector('#storyForm input[name=proof][type=file]').required);assert(w.document.querySelector('#storyForm input[name=publishedAt]').required);
 assert(w.document.querySelector('#storyForm button').disabled);
 const info=new JSDOM(read('informacion.html'));for(const a of info.window.document.querySelectorAll('a[href^="#"]'))assert(info.window.document.querySelector(a.getAttribute('href')));
 assert.equal(info.window.document.querySelectorAll('input[type="password"],input[name="cardNumber"]').length,0);assert(info.window.document.querySelector('#privacidad').textContent.includes('política de privacidad de El Chingadazo'));assert(info.window.document.querySelector('#terminos').textContent.includes('antes de habilitar los pedidos'));
 console.log('PASS DOM simulado: navegación, formulario de rango, día único, rango inválido, edición de personal, botón verde y promoción en Cuenta.');
 run("window.__verifiedProfile=Store.get().users.find(u=>u.id==='auth-admin');Store.patch(d=>d.session='auth-admin');go('admin-settings')");
 const settingsForm=w.document.querySelector('#settingsForm');assert(settingsForm);
 assert.equal(settingsForm.querySelectorAll('input[type=time]').length,14);
 assert(settingsForm.elements.dayClosed1.checked);
 settingsForm.elements.dayClose5.value='01:30';
 let savedSettings;w.Cloud.pushSettings=async settings=>{savedSettings=settings;return true;};
 submit(settingsForm);await settle();
 assert.equal(savedSettings.weeklyHours[5].close,'01:30');assert.equal(savedSettings.weeklyHours[1].closed,true);
 console.log('PASS schedule editor saves all seven days and the event extension.');
 dom.window.close();info.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
