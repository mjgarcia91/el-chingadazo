/* Bridge v1: Android delivers this port to the trusted top-level HTTPS document.
   No external intents, raw bytes, timers that retry, or persisted print jobs. */
(() => {
 const isApp=/\bChingadazoPOS\/1\b/.test(navigator.userAgent);
 let port=null,sequence=0,expectedNonce=null;const pending=new Map();
 // Called only by native evaluateJavascript in the top document, not by postMessage.
 // Cross-origin child frames cannot read this closure or call prepare().
 function prepare(nonce){if(!isApp||port||expectedNonce||!/^[a-f0-9]{32}$/.test(nonce))return false;expectedNonce=nonce;return true;}
 function request(action,text){
  if(!port)return Promise.reject(new Error('La conexión nativa está iniciando o no está disponible. Vuelve a intentar cuando termine de cargar la página.'));
  if(!['status','connect','print','drawer'].includes(action))return Promise.reject(new Error('Acción nativa desconocida.'));
  if(pending.size>=8)return Promise.reject(new Error('Hay demasiados envíos pendientes. Espera antes de reintentar.'));
  return new Promise((resolve,reject)=>{
   const id='job_'+(++sequence),timer=setTimeout(()=>{pending.delete(id);reject(new Error('No llegó confirmación USB. Comprueba papel y gaveta antes de reintentar. No vuelvas a cobrar.'));},40000);
   pending.set(id,{resolve,reject,timer});
   try{port.postMessage(JSON.stringify({id,action,...(text===undefined?{}:{text})}));}
   catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
  });
 }
 window.addEventListener('message',event=>{
  if(!isApp||window!==window.top||port||!expectedNonce||event.data!=='chingadazo-native-v1:'+expectedNonce||!event.ports?.[0])return;
  if(event.source!==null&&event.source!==window)return;
  expectedNonce=null;
  port=event.ports[0];
  port.onmessage=event=>{
   let reply;try{reply=JSON.parse(event.data);}catch{return;}
   const job=pending.get(reply.id);if(!job)return;
   pending.delete(reply.id);clearTimeout(job.timer);
   if(reply.error)job.reject(new Error(String(reply.error)));else job.resolve(reply.result);
  };
  port.start();window.dispatchEvent(new Event('chingadazo-native-ready'));
 });
 window.addEventListener('pagehide',()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('Página cerrada. Comprueba el resultado del último envío antes de repetirlo.'));}pending.clear();port?.close();port=null;});
 window.ChingadazoNative=Object.freeze({isApp,request,prepare});
})();
