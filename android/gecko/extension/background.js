/* The browser supplies sender; never accept origin/tab/frame fields from a page. */
(() => {
 const origin='https://el-chingadazo.magaa1825.workers.dev';
 const seen=new Set();
 // Observations use an independent extension channel; never await or retry them.
 function trace(sender,id,stage){
  const event={type:'gecko-diagnostic',id,stage};
  console.info(JSON.stringify({entryPoint:'background',...event}));
  try{browser.tabs.sendMessage(sender.tab.id,event,{frameId:0}).catch(()=>{});}catch{}
 }
 function trusted(raw){
  try{const u=new URL(raw);return u.origin===origin&&!u.username&&!u.password&&['/personal','/personal.html'].includes(u.pathname);}catch{return false;}
 }
 browser.runtime.onMessage.addListener(async (msg,sender)=>{
  if(sender.id!==browser.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||sender.tab.id<0||!trusted(sender.url))throw Error('denied');
  if(!msg||Array.isArray(msg)||typeof msg!=='object'||msg.v!==1||typeof msg.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(msg.id))throw Error('unsupported');
  if(!['status','connect','print','drawer','cut'].includes(msg.action))throw Error('unsupported');
  const keys=msg.action==='print'?['v','id','action','text']:['v','id','action'];
  if(Object.keys(msg).length!==keys.length||Object.keys(msg).some(k=>!keys.includes(k)))throw Error('unsupported');
  if(msg.action==='print'&&(typeof msg.text!=='string'||!msg.text.length||msg.text.length>49152||/[^\x20-\x7e\n]/.test(msg.text)))throw Error('unsupported');
  if(new TextEncoder().encode(JSON.stringify(msg)).length>65536)throw Error('unsupported');
  // Fail closed at the bound; no eviction that would allow a replay within this run.
  if(seen.has(msg.id)||seen.size>=4096)throw Error('duplicate-or-capacity');
  seen.add(msg.id);
  trace(sender,msg.id,'background_wait');
  const timer=setTimeout(()=>trace(sender,msg.id,'background_pending'),10000);
  try{
   const reply=await GeckoNativePort.request(msg);
   trace(sender,msg.id,'background_received');
   if(!reply||reply.id!==msg.id){trace(sender,msg.id,'background_invalid');throw Error('invalid-native-response');}
   return reply;
  }catch(error){trace(sender,msg.id,'background_rejected');throw error;}
  finally{clearTimeout(timer);}
 });
})();
