/* Background-only transport. New requests may reconnect; existing jobs never replay. */
globalThis.GeckoNativePort=(() => {
 let port=null;
 const pending=new Map();
 function connect(){
  const opened=browser.runtime.connectNative('coresystem');port=opened;
  opened.onMessage.addListener(raw=>{
   if(port!==opened)return;
   let reply;
   try{
    if(typeof raw==='string'&&raw.length>4096)return;
    reply=typeof raw==='string'?JSON.parse(raw):raw;
    if(!reply||Array.isArray(reply)||typeof reply.id!=='string'||JSON.stringify(reply).length>4096)return;
   }catch{return;}
   const job=pending.get(reply.id);if(!job)return;
   pending.delete(reply.id);clearTimeout(job.timer);job.resolve(reply);
  });
  opened.onDisconnect.addListener(()=>{
   if(port!==opened)return;
   port=null;
   for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('port-disconnected'));}
   pending.clear();
  });
  return opened;
 }
 function request(msg){
  if(pending.size>=8||pending.has(msg.id))return Promise.reject(Error('port-busy'));
  let current;try{current=port||connect();}catch{return Promise.reject(Error('port-unavailable'));}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(msg.id);reject(Error('sin-respuesta'));},8000);
   pending.set(msg.id,{resolve,reject,timer});
   try{current.postMessage(msg);}catch{clearTimeout(timer);pending.delete(msg.id);reject(Error('port-send-failed'));}
  });
 }
 // Java may not have registered its delegate yet; reconnect only on a future request.
 try{connect();}catch{}
 return Object.freeze({request});
})();
