const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const {MessageChannel}=require('node:worker_threads');
(async()=>{
 const w=new JSDOM('<body></body>',{url:'https://el-chingadazo.magaa1825.workers.dev/personal',runScripts:'outside-only'}).window;
 const sent=[];let simulated=true;Object.defineProperty(w.navigator,'userAgent',{value:'Firefox ChingadazoPOS/1'});
 w.MessageChannel=MessageChannel;w.wrappedJSObject=w;
 let diagnostic,background;const extensionId='pos.print@coresystem';
 const context={URL,TextEncoder,setTimeout,clearTimeout,console:{info(){}},browser:{
  tabs:{sendMessage:async(tab,msg)=>diagnostic?.(msg,{id:extensionId})},
  runtime:{id:extensionId,onMessage:{addListener:f=>background=f},connectNative:()=>{
   let receive;return {onMessage:{addListener:f=>receive=f},onDisconnect:{addListener(){}},postMessage:msg=>{sent.push(msg);receive(simulated?{id:msg.id,error:'SIMULADO: no se envió al USB.'}:{id:msg.id,result:{accepted:true,physicalConfirmed:false,transport:'usb'}});}};
  }}
 }};
 vm.createContext(context);
 for(const file of ['native-port.js','background.js'])vm.runInContext(fs.readFileSync('android/gecko/extension/'+file,'utf8'),context);
 w.browser={runtime:{id:extensionId,onMessage:{addListener:f=>diagnostic=f},sendMessage:msg=>background(msg,{id:extensionId,frameId:0,tab:{id:1},url:w.location.href})}};
 w.postMessage=(data,origin,ports)=>w.dispatchEvent(new w.MessageEvent('message',{data,origin,source:w,ports:ports||[]}));
 w.eval(fs.readFileSync('js/native-bridge.js','utf8'));
 w.eval(fs.readFileSync('android/gecko/extension/content.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await assert.rejects(w.ChingadazoNative.request('print','TACO\n'),/SIMULADO/);
 assert.match(w.document.querySelector('[data-gecko-diagnostics]')?.textContent||'',/content_posted/,'show postMessage outcome without claiming page receipt');
 assert.equal(sent.length,1);assert.equal(sent[0].text,'TACO\n');assert.match(sent[0].id,/^[a-f0-9-]{36}$/);
 const panel=w.document.querySelector('[data-gecko-diagnostics]');
 assert.equal(panel.hidden,true,'operational build must not cover the cash register with diagnostics');
 const before=panel.textContent;
 diagnostic({type:'gecko-diagnostic',id:sent[0].id,stage:'background_received'},{id:'other'});
 assert.equal(panel.textContent,before,'ignore diagnostics from another extension');
 diagnostic({type:'gecko-diagnostic',id:sent[0].id,stage:'background_received'},{id:w.browser.runtime.id,tab:{id:1}});
 assert.equal(panel.textContent,before,'ignore content-script senders');
 diagnostic({type:'gecko-diagnostic',id:sent[0].id,stage:'background_received'},{id:w.browser.runtime.id});
 assert.match(panel.textContent,/background_received/,'late observation is visible');
 assert(!panel.textContent.includes('TACO'),'never display ticket payload in diagnostics');
 // Exercise the real receipt formatter through page -> content -> background -> native port.
 // The native endpoint is fake: no production order or hardware command is executed.
 simulated=false;w.TextEncoder=TextEncoder;w.eval(fs.readFileSync('js/printer.js','utf8'));
 const result=await w.ChingadazoPrinter.print({code:'VENTA-FIXTURE',items:[{name:'Tacos',qty:1,unit:189}],total:189,payment:'Efectivo'},'client',{});
 assert.equal(result.accepted,true);assert.equal(result.physicalConfirmed,false);
 assert.equal(sent.length,2);assert.equal(sent[1].action,'print');
 assert.match(sent[1].text,/VENTA-FIXTURE/);assert(!sent[1].text.includes('PRUEBA-IMPRESORA'));
 assert(!sent.some(m=>m.action==='drawer'),'printing a real receipt never issues a drawer command');
 w.dispatchEvent(new w.Event('pagehide'));
 await assert.rejects(w.ChingadazoNative.request('drawer'),/iniciando/);
 w.close();console.log('Gecko content: existing web contract, UUID translation and page close pass');
})().catch(e=>{console.error(e);process.exit(1);});
