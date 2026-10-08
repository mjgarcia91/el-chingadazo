// Published HTML execution; authentication and network are simulated.
const {JSDOM,requestInterceptor,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../public');
const resources={interceptors:[requestInterceptor(request=>{
 const u=new URL(request.url);
 if(u.origin!=='https://test.local')return new Response('',{headers:{'Content-Type':'text/css'}});
 const type=u.pathname.endsWith('.css')?'text/css':'application/javascript';
 if(u.pathname==='/js/auth.js')return new Response('window.AuthBridge={current:async()=>null,idToken:async()=>null};',{headers:{'Content-Type':type}});
 const p=path.join(root,u.pathname);assert(fs.existsSync(p),'Missing dependency: '+u.pathname);
 return new Response(fs.readFileSync(p),{headers:{'Content-Type':type}});
})]};
async function check(entry,route,known){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
 const dom=new JSDOM(fs.readFileSync(path.join(root,entry),'utf8'),{url:'https://test.local'+route,resources,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 Object.assign(w,{Response,Headers,Request,TextEncoder,TextDecoder,structuredClone,fetch:async()=>new Response('{}'),scrollTo:()=>{},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:()=>0});
 w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.play=async()=>{};
 if(known)w.localStorage.setItem('chingadazo_staff_authorized','1');
 }});
 try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('HTML load timed out')),5000);dom.window.addEventListener('load',()=>{clearTimeout(t);resolve()},{once:true});});
 await new Promise(r=>setTimeout(r,100));
 const w=dom.window;assert.equal(w.eval('appBooting'),false);assert(w.document.querySelector('main.page'),route+' must leave startup');assert(!w.document.querySelector('.app-startup'));assert(!w.document.querySelector('.commerce-footer'));assert.deepEqual(errors,[]);
 if(route.startsWith('/personal'))assert(w.document.querySelector(known?'#staffPinArea':'#staffAuthorizeForm'));
 else{assert(w.document.querySelector('.chingadazo-welcome'));w.eval("go('account')");assert(w.document.querySelector('a[href="/informacion.html"]'),'guest policies accessible');}
 }finally{dom.window.close();}
}
(async()=>{await check('index.html','/',false);await check('personal.html','/personal',false);await check('personal.html','/personal/',true);console.log('PASS published HTML boot: client, new staff device, authorized staff device; no startup hang. Authentication/network mocked.');})().catch(e=>{console.error(e);process.exitCode=1;});
