// Controlled extension runtime: verifies observations, not GeckoView on Android.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const id='123e4567-e89b-42d3-a456-426614174000';
const sender={id:'pos.print@coresystem',frameId:0,tab:{id:7},url:'https://el-chingadazo.magaa1825.workers.dev/personal'};
function setup(native){
 let handler;const marks=[],timers=new Set();
 vm.runInNewContext(fs.readFileSync('android/gecko/extension/background.js','utf8'),{
  URL,TextEncoder,GeckoNativePort:{request:msg=>native('coresystem',msg)},console:{info(){}},setTimeout:f=>{timers.add(f);return f;},clearTimeout:f=>timers.delete(f),
  browser:{tabs:{sendMessage:async(tab,msg,options)=>{marks.push({tab,msg,options});}},runtime:{id:sender.id,onMessage:{addListener:f=>handler=f},sendNativeMessage:native}}
 });return {get handler(){return handler;},marks,timers};
}
(async()=>{
 assert.equal(JSON.parse(fs.readFileSync('android/gecko/extension/manifest.json','utf8')).version,'1.0.0','embedded extension version must advance with changed scripts');
 const s=setup(async(app,msg)=>({id:msg.id,error:'SIMULADO'}));
 assert.equal((await s.handler({v:1,id,action:'connect'},sender)).error,'SIMULADO');
 assert.deepEqual(s.marks.map(x=>x.msg.stage),['background_wait','background_received']);
 assert(s.marks.every(x=>x.tab===7&&x.options.frameId===0&&x.msg.id===id));
 assert.equal(s.timers.size,0);
 let resolve;const pending=setup(()=>new Promise(r=>resolve=r));
 const response=pending.handler({v:1,id,action:'connect'},sender);
 for(const timer of [...pending.timers])timer();
 assert.equal(pending.marks.at(-1).msg.stage,'background_pending');
 resolve({id,error:'SIMULADO'});await response;
 assert.equal(pending.marks.at(-1).msg.stage,'background_received','observation must not cancel or retry original request');
 const failure=setup(async()=>{throw Error('private payload');});
 await assert.rejects(()=>failure.handler({v:1,id,action:'connect'},sender));
 assert.equal(failure.marks.at(-1).msg.stage,'background_rejected');
 assert(!JSON.stringify(failure.marks).includes('private payload'));
 const invalid=setup(()=>{throw Error('must not run');});
 await assert.rejects(()=>invalid.handler({v:1,id,action:'connect'},{...sender,frameId:1}));
 assert.equal(invalid.marks.length,0);
 console.log('Gecko diagnostics: response, rejection, pending/late response, trusted routing and no payload logging pass');
})().catch(e=>{console.error(e);process.exitCode=1;});
