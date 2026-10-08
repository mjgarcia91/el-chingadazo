const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const ports=[],timers=new Map();let clock=0;
 const context={setTimeout:(f,ms)=>{const id=++clock;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),browser:{runtime:{connectNative:name=>{
  const p={name,sent:[],onMessage:{addListener:f=>p.receive=f},onDisconnect:{addListener:f=>p.drop=f},postMessage:m=>p.sent.push(m),disconnect:()=>{p.disconnected=true;p.drop();}};
  ports.push(p);return p;
 }}}};
 vm.runInNewContext(fs.readFileSync('android/gecko/extension/native-port.js','utf8'),context);
 return {context,ports,timers};
}
(async()=>{
 const s=setup();assert.equal(s.ports[0].name,'coresystem');
 const p=s.context.GeckoNativePort.request({id:'one',action:'connect'});
 s.ports[0].receive({id:'unknown',error:'ignore'});assert.equal(s.timers.size,1);
 s.ports[0].receive({id:'one',error:'SIMULADO'});
 assert.equal((await p).error,'SIMULADO');assert.equal(s.timers.size,0);
 const a=s.context.GeckoNativePort.request({id:'a'}),b=s.context.GeckoNativePort.request({id:'b'});
 const rejects=[assert.rejects(a,/disconnected/),assert.rejects(b,/disconnected/)];
 s.ports[0].drop();await Promise.all(rejects);assert.equal(s.timers.size,0);
 const next=s.context.GeckoNativePort.request({id:'next'});assert.equal(s.ports.length,2);
 s.ports[0].receive({id:'next',error:'stale'});assert.equal(s.timers.size,1);
 const expired=assert.rejects(next,/sin-respuesta/);
 const timer=[...s.timers.values()][0];assert.equal(timer.ms,8000);timer.f();await expired;
 assert.equal(s.ports[1].sent.length,1,'timeout must not replay');
 const final=s.context.GeckoNativePort.request({id:'final'});
 s.ports[1].receive('invalid json');s.ports[1].receive({id:'final',result:{simulated:true}});
 assert.equal((await final).result.simulated,true);
 const throwing=setup();throwing.ports[0].postMessage=()=>{throw Error('transport');};
 await assert.rejects(throwing.context.GeckoNativePort.request({id:'bad'}),/port-send-failed/);
 assert.equal(throwing.timers.size,0);
 console.log('Gecko port: response correlation, disconnect, stale reply, timeout, no replay and send failure pass');
})().catch(e=>{console.error(e);process.exitCode=1;});
