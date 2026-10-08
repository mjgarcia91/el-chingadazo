// Isolated local fixture: real dining service, synthetic identity, in-memory data.
import http from 'node:http';
import fs from 'node:fs';
import {createDining} from '../server/dining.js';
import {createAccess} from '../server/access.js';
let state=null,queue=Promise.resolve();
const products=[{id:'taco',name:'Tacos de prueba',price:50,available:true,modifiers:[{id:'salsa',name:'Salsa',required:true,options:[{id:'roja',name:'Roja',price:5},{id:'verde',name:'Verde',price:0}]}]},{id:'agua',name:'Agua de prueba',price:25,available:true}];
const db=async(_,path)=>structuredClone(path==='/products'?products:state);
const service=createDining({db,quoteItems:createAccess({db}).quoteItems,consumptionsEnabled:true,mutateDb:async(_,path,fn)=>{
 const task=queue.then(()=>{state=fn(structuredClone(state));return structuredClone(state)});queue=task.catch(()=>{});return task;
},identity:async()=>({id:'synthetic-admin',role:'admin'}),json:(value,status=200)=>new Response(JSON.stringify(value),{status})});
const files={'/':'tests/dining-browser.html','/fixture.js':'tests/dining-fixture.js','/js/dining.js':'js/dining.js','/js/dining-composer.js':'js/dining-composer.js','/js/dining-kitchen.js':'js/dining-kitchen.js','/css/dining.css':'css/dining.css','/css/styles.css':'css/styles.css'};
http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1:4174').pathname;
  if(path==='/api/data/products'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(products));return;}
  if(['/api/dining','/api/dining/kitchen'].includes(path)){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)throw Error('Too large')}
   const response=await service.handle(new Request('http://127.0.0.1:4174'+path,{method:req.method,...(req.method==='POST'?{body}:{})}),{});
   res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());return;
  }
  if(!files[path]){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(fs.readFileSync(files[path]));
 }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
}).listen(4174,'127.0.0.1',()=>console.log('Isolated dining fixture: http://127.0.0.1:4174'));
