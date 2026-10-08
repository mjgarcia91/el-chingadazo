/* Content process has no native messaging permission. Only the background does. */
(() => {
 const origin='https://el-chingadazo.magaa1825.workers.dev';
 if(window!==window.top||location.origin!==origin||!['/personal','/personal.html'].includes(location.pathname))return;
 let closed=false,inFlight=0,port=null;
 const active=new Set(),lines=[];
 let panel=null;
 const labels={background_wait:'background espera a Java',background_pending:'background sin respuesta tras 10 s (sigue esperando)',background_received:'background recibió respuesta',background_invalid:'background recibió ID inválido',background_rejected:'background recibió rechazo',content_received:'content recibió respuesta del background',content_rejected:'content recibió rechazo o respuesta inválida',content_posting:'content va a devolver a la página',content_posted:'content devolvió a la página (envío, no acuse)',content_post_failed:'content no pudo enviar a la página'};
 function mark(id,stage){
  if(closed)return;
  console.info(JSON.stringify({entryPoint:'content',id,stage}));
  lines.push(id.slice(0,8)+' '+stage+': '+labels[stage]);if(lines.length>8)lines.shift();
  if(!panel){panel=document.createElement('pre');panel.setAttribute('data-gecko-diagnostics','');panel.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#fff4bc;color:#111;font:14px monospace;white-space:pre-wrap;margin:0;padding:6px;pointer-events:none;';document.documentElement.appendChild(panel);}
  panel.hidden=true;
  panel.textContent='DIAGNÓSTICO USB\n'+lines.join('\n');
 }
 browser.runtime.onMessage?.addListener((msg,sender)=>{
  if(closed||sender.id!==browser.runtime.id||sender.tab||msg?.type!=='gecko-diagnostic'||!active.has(msg.id)||!Object.hasOwn(labels,msg.stage)||!msg.stage.startsWith('background_'))return;
  mark(msg.id,msg.stage);
 });
 window.addEventListener('pagehide',()=>{closed=true;port?.close();port=null;active.clear();});
 function bind(){
  if(closed||port)return;
  const nonce=crypto.randomUUID().replaceAll('-','');
  // Call the existing page bootstrap with a primitive only. Never expose browser APIs.
  const page=window.wrappedJSObject;
  if(page.ChingadazoNative?.prepare(nonce)!==true)return;
  const pair=new MessageChannel();port=pair.port1;
  port.onmessage=async event=>{
   if(closed||typeof event.data!=='string'||event.data.length>65536)return;
   let msg;try{msg=JSON.parse(event.data);}catch{return;}
   if(!msg||typeof msg.id!=='string'||!/^job_[0-9]{1,12}$/.test(msg.id))return;
   const pageId=msg.id,current=port;
   if(inFlight>=8){current.postMessage(JSON.stringify({id:pageId,error:'Puente ocupado.'}));return;}
   inFlight++;let reply;const nativeId=crypto.randomUUID();active.add(nativeId);
   if(active.size>32)active.delete(active.values().next().value);
   try{
    reply=await browser.runtime.sendMessage({...msg,v:1,id:nativeId});
    mark(nativeId,'content_received');
    if(!reply||reply.id!==nativeId)throw Error('invalid-response');
    reply={...reply,id:pageId};
   }catch{mark(nativeId,'content_rejected');reply={id:pageId,error:'Puente no disponible o solicitud rechazada. No se reintenta automáticamente.'};}
   finally{inFlight--;}
   if(!closed&&port===current){
    mark(nativeId,'content_posting');
    try{current.postMessage(JSON.stringify(reply));mark(nativeId,'content_posted');}
    catch{mark(nativeId,'content_post_failed');}
   }
   // Retain bounded IDs so independent diagnostics arriving after the reply remain visible.
  };
  port.start();window.postMessage('chingadazo-native-v1:'+nonce,origin,[pair.port2]);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
