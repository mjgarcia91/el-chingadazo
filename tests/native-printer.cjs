const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const bridge=fs.readFileSync('js/native-bridge.js','utf8'),printer=fs.readFileSync('js/printer.js','utf8');
function setup(native=true){const w=new JSDOM('<body></body>',{url:'https://el-chingadazo.magaa1825.workers.dev/personal',runScripts:'outside-only'}).window;w.TextEncoder=TextEncoder;Object.defineProperty(w.navigator,'userAgent',{value:native?'Android Chrome/106 ChingadazoPOS/1':'Firefox Android'});w.eval(bridge);w.eval(printer);return w;}
(async()=>{
 const w=setup(),p=w.ChingadazoPrinter,n=w.ChingadazoNative;w.localStorage.setItem('chingadazo_printer_transport_v1','rawbt');
 assert.equal(p.transport(),'native');assert.equal(p.supported(),true);
 await assert.rejects(p.status(),/iniciando/);assert.throws(()=>p.setTransport('rawbt'),/APK/);
 const requests=[],port={start(){},close(){},postMessage(raw){const msg=JSON.parse(raw);requests.push(msg);queueMicrotask(()=>port.onmessage({data:JSON.stringify({id:msg.id,result:msg.action==='status'?{configured:true,connected:true,transport:'native'}:{accepted:true}})}));}};
 let stolen=0;const evil={start(){},postMessage(){stolen++;}};
 w.dispatchEvent(new w.MessageEvent('message',{data:'chingadazo-native-v1',origin:'https://evil.test',ports:[evil]}));
 await assert.rejects(p.status(),/iniciando/);assert.equal(stolen,0);
 const nonce='0123456789abcdef0123456789abcdef';assert.equal(n.prepare(nonce),true);
 w.dispatchEvent(new w.MessageEvent('message',{data:'chingadazo-native-v1:bad',ports:[evil]}));
 w.dispatchEvent(new w.MessageEvent('message',{data:'chingadazo-native-v1:'+nonce,ports:[port]}));
 assert.equal((await p.status()).configured,true);await p.connect();
 await p.print({items:[{name:'Taco\x1bp',qty:1,unit:10}],total:10},'client',{});await p.drawer();
 assert.deepEqual(requests.map(r=>r.action),['status','connect','print','drawer']);assert(!requests[2].text.includes('\x1b'));assert(!w.document.getElementById('rawbt-jobs'));
 await p.summary({items:[{name:'Taco',qty:2,unit:10}],total:20},'Mesa 1');assert.equal(requests.at(-1).action,'print');assert.match(requests.at(-1).text,/NO ES COMPROBANTE DE PAGO/);assert.match(requests.at(-1).text,/Mesa 1/);assert.equal(requests.filter(r=>r.action==='drawer').length,1);
 port.postMessage=raw=>{const m=JSON.parse(raw);queueMicrotask(()=>port.onmessage({data:JSON.stringify({id:m.id,error:'USB desconectado'})}));};await assert.rejects(p.drawer(),/USB desconectado/);
 const original=port.onmessage;w.dispatchEvent(new w.MessageEvent('message',{data:'chingadazo-native-v1',ports:[{start(){},postMessage(){}}]}));assert.equal(port.onmessage,original);
 const browser=setup(false);assert.equal(browser.ChingadazoNative.isApp,false);browser.ChingadazoPrinter.setTransport('rawbt');assert.equal(browser.ChingadazoPrinter.transport(),'rawbt');
 const app=fs.readFileSync('js/app.js','utf8');const fn=app.slice(app.indexOf('async function printTicket('),app.indexOf('function sendWhatsApp('));
 const vm=require('node:vm');let fallback=0,alerts=[];
 const ctx={window:{ChingadazoNative:{isApp:true},ChingadazoPrinter:{status:async()=>{throw Error('USB failure');}}},reportClientIncident(){},alert:t=>alerts.push(t),legacyPrintTicket(){fallback++;},Store:{get:()=>({settings:{}})}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.printTicket({id:'already-paid'},'client');assert.equal(fallback,0);assert.match(alerts[0],/No vuelvas a cobrar/);
 w.close();browser.close();console.log('Native bridge priority, no fallback, sanitization, errors PASS');
})().catch(e=>{console.error(e);process.exit(1);});
