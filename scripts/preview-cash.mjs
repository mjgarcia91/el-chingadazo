// No Firebase, secrets or external mutations: the actual services run in memory.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createDining} from '../server/dining.js';
import {createDiningCheckout} from '../server/dining-checkout.js';
import {createAccess} from '../server/access.js';
import {createManager} from '../server/manager.js';
const user={id:'synthetic-cash',role:'admin',name:'PRUEBA AISLADA'},shift={id:'synthetic-shift',userId:user.id,openedAt:new Date().toISOString(),fondo:0};
const categories=['Prueba','Birria','Entradas','Gringas','Tacos','Burritos','Tostadas','Tortas','Micheladas','Menú catracho','Sodas','Naturales','Cervezas nacionales','Cervezas internacionales','Tequila','Vodka'].map((name,i)=>({id:i?'cat-'+i:'prueba',name}));
const products=[{id:'taco',category:'prueba',name:'Taco de prueba',price:50,available:true},{id:'agua',category:'prueba',name:'Agua de prueba',price:25,available:true},...Array.from({length:24},(_,i)=>({id:'fixture-'+i,category:'prueba',name:'Producto de prueba '+(i+1),price:179,available:true}))];
let root={products,shifts:{[shift.id]:shift}},queue=Promise.resolve();
const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],root);
const set=(p,v)=>{const keys=p.split('/').filter(Boolean),last=keys.pop();let n=root;for(const k of keys)n=n[k]||={};n[last]=v;return structuredClone(v)};
const db=async(_,p,opts)=>opts?set(p,JSON.parse(opts.body)):structuredClone(get(p)||null);
const mutateDb=(_,p,fn)=>{const run=queue.then(()=>set(p,fn(structuredClone(get(p)||null))));queue=run.catch(()=>{});return run};
const checkout=createDiningCheckout({db,mutateDb,isShiftExpired:()=>false,recordSale:createManager({db,mutateDb}).recordSale});
const dining=createDining({db,mutateDb,identity:async()=>user,json:x=>new Response(JSON.stringify(x)),quoteItems:createAccess({db}).quoteItems,checkout,consumptionsEnabled:true});
await dining.handle(new Request('http://localhost/api/dining',{method:'POST',body:JSON.stringify({action:'initialize',operationId:'fixture-init',expectedRevision:0})}),{});
const bootstrap=`window.Cloud={sync:async()=>({changed:false})};AuthBridge.current=async()=>null;AuthBridge.idToken=async()=>'synthetic';setTimeout(()=>{window.__verifiedProfile=${JSON.stringify(user)};Store.patch(d=>{d.users=[window.__verifiedProfile];d.session=window.__verifiedProfile.id;d.products=${JSON.stringify(products)};d.categories=${JSON.stringify(categories)};d.orders=[];d.shifts=[${JSON.stringify(shift)}];d.settings.open=false;d.settings.deliveryEnabled=false});STATE.posCat='prueba';go('caja');},100);`;
http.createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://localhost').pathname;
 let text,type='application/json';
 if(p==='/api/dining'||p==='/api/dining/kitchen'){
  let body='';for await(const c of req){body+=c;if(body.length>12000)throw Error('too large')}
  text=await (await dining.handle(new Request('http://localhost'+p,{method:req.method,...(req.method==='POST'?{body}:{})}),{})).text();
 }else if(p==='/fixture.js'){text=bootstrap+"Cloud.getStatus=()=> 'Prueba aislada';";type='application/javascript';}
 else if(p==='/js/auth.js'){text='window.AuthBridge={current:async()=>null,idToken:async()=>"synthetic"};';type='application/javascript';}
 else if(p==='/js/sync.js'){text='window.Cloud={sync:async()=>({changed:false})};';type='application/javascript';}
 else if(p==='/sw.js'){text='';type='application/javascript';}
 else if(p==='/api/settings')text=JSON.stringify({open:false,deliveryEnabled:false});
 else if(p.startsWith('/api/'))text='{}';
 else{
  const file=path.resolve('public',p==='/personal'?'personal.html':'.'+p);
  if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
  text=fs.readFileSync(file);type=p==='/personal'?'text/html':p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'application/octet-stream';
  if(p==='/personal')text=text.toString().replace('</body>','<script src="/fixture.js"></script></body>');
 }
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(text);
}catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}}).listen(4175,'127.0.0.1',()=>console.log('Isolated actual Caja: http://127.0.0.1:4175/personal'));
