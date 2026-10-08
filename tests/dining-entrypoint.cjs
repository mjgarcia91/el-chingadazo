const {JSDOM,requestInterceptor,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const resources={interceptors:[requestInterceptor(request=>{const url=new URL(request.url);if(url.origin!=='https://test.local')return new Response('');
 if(url.pathname==='/js/auth.js')return new Response('window.AuthBridge={current:async()=>null,idToken:async()=>"synthetic"};',{headers:{'Content-Type':'application/javascript'}});
 return new Response(fs.readFileSync(path.join('public',url.pathname)),{headers:{'Content-Type':url.pathname.endsWith('.css')?'text/css':'application/javascript'}});
 })]};
 const dom=new JSDOM(fs.readFileSync('public/personal.html','utf8'),{url:'https://test.local/personal',runScripts:'dangerously',resources,pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){Object.assign(w,{Response,Headers,Request,structuredClone,TextEncoder,TextDecoder,fetch:async()=>new Response('{}'),scrollTo:()=>{},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:()=>0});w.HTMLMediaElement.prototype.pause=()=>{};}});
 try{
  await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));await new Promise(r=>setTimeout(r,50));
  const w=dom.window;
  w.eval(`window.__verifiedProfile={id:'auth-test',name:'Synthetic',role:'admin'};Store.patch(d=>{d.users=[window.__verifiedProfile];d.session='auth-test'});managerApi=async()=>({initialized:true,revision:1,zones:{first:{id:'first',name:'Primer nivel'}},tables:{t:{id:'t',number:1,kind:'table',active:true,zoneId:'first',row:1,column:1}},accounts:{}});go('mesas');`);
  await new Promise(r=>setTimeout(r,20));assert(w.document.querySelector('#diningRoot [data-dining-table="t"]'));assert(w.document.querySelector('[data-go="mesas"]'));
  w.eval(`go('caja')`);assert(w.document.querySelector('#posSell'));
  w.eval(`window.__verifiedProfile=null;Store.patch(d=>{d.session=null});go('mesas')`);assert(!w.document.querySelector('#diningRoot'));
  assert.deepEqual(errors,[]);console.log('PASS complete Personal entrypoint: staff Mesas view, return to Caja, unauthenticated denial; identity/network simulated.');
 }finally{dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
