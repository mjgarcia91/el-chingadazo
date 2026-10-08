const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dir=path.join(__dirname,'../android/gecko/extension');
const id='123e4567-e89b-42d3-a456-426614174000';
const origin='https://el-chingadazo.magaa1825.workers.dev';
const sender={id:'pos.print@coresystem',url:origin+'/personal',frameId:0,tab:{id:1}};
let handler;const sent=[];
const context={URL,TextEncoder,Map,Set,Promise,browser:{runtime:{id:sender.id,onMessage:{addListener:f=>handler=f},sendNativeMessage:async(app,msg)=>{sent.push({app,msg});return {id:msg.id,error:'SIMULADO: no se envió al USB.'};}}}};
Object.assign(context,{setTimeout,clearTimeout});
context.GeckoNativePort={request:msg=>context.browser.runtime.sendNativeMessage('coresystem',msg)};
vm.runInNewContext(fs.readFileSync(path.join(dir,'background.js'),'utf8'),context);
(async()=>{
 const msg={v:1,id,action:'print',text:'PRUEBA\n'};
 await handler(msg,sender);assert.equal(sent.length,1);assert.equal(sent[0].app,'coresystem');assert.equal(sent[0].msg.text,'PRUEBA\n');
 for(const bad of [{...sender,frameId:1},{...sender,tab:null},{...sender,id:'other'}, {...sender,url:'https://evil.test/personal'}, {...sender,url:origin+'/other'},{...sender,url:'http://el-chingadazo.magaa1825.workers.dev/personal'}]){
  await assert.rejects(()=>handler({...msg,id:'123e4567-e89b-42d3-a456-426614174001'},bad));
 }
 for(const bad of [{...msg,drawer:true},{...msg,text:'\x1b\x70'},{...msg,text:'a'.repeat(49153)},{...msg,action:'raw'},{...msg,id:'job_1'},{...msg,v:2},{...msg,text:'á'}, {...msg,action:'drawer'}])await assert.rejects(()=>handler(bad,sender));
 await assert.rejects(()=>handler(msg,sender));assert.equal(sent.length,1,'invalid or duplicate jobs never reach native');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert(!manifest.permissions.includes('nativeMessagingFromContent'));
 assert.equal(manifest.content_scripts[0].all_frames,false);
 console.log('Gecko extension: trusted sender, payload, duplicate and permission checks pass');
})().catch(e=>{console.error(e);process.exitCode=1;});
