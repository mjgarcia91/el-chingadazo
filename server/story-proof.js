const PREFIX='instagram-proofs/',AGE=7*86400000,MAX=4*1024*1024;
const fail=(m,status=400)=>Object.assign(new Error(m),{status});
const validKey=k=>/^instagram-proofs\/[A-Za-z0-9_-]{1,150}\/[A-Za-z0-9_-]{1,150}\/[a-f0-9-]{36}$/.test(k||'');
export function createStoryProof({db,mutateDb,identity}){
 async function info(env,key,userId,orderId){
  if(!validKey(key))throw fail('Carga una captura de pantalla válida.');
  const o=await env.DRIVER_DOCS.head(key),m=o?.customMetadata;
  if(!o||m?.kind!=='instagram-promotion-proof'||m.owner!==userId||m.order!==orderId)throw fail('Comprobante no autorizado.',403);
  if(Date.now()>=Number(m.expiresAt))throw fail('La captura venció y ya no está disponible.',410);
  return {key,uploadedAt:o.uploaded.toISOString(),expiresAt:new Date(Number(m.expiresAt)).toISOString()};
 }
 return {info,async handle(request,env){
  const a=await identity(request,env);if(!a||!['customer','admin'].includes(a.role))throw fail('Acceso no autorizado.',403);
  const url=new URL(request.url);
  if(request.method==='GET'){
   const key=url.searchParams.get('key');if(!validKey(key))throw fail('Comprobante inválido.');
   const meta=await env.DRIVER_DOCS.head(key);if(!meta)throw fail('Captura eliminada o no disponible.',410);
   if(a.role!=='admin'&&meta.customMetadata?.owner!==a.id)throw fail('Acceso no autorizado.',403);
   await info(env,key,meta.customMetadata?.owner,meta.customMetadata?.order);
   const obj=await env.DRIVER_DOCS.get(key);if(!obj)throw fail('Captura eliminada.',410);
   return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(request.method!=='POST')throw fail('Método no permitido.',405);
  if(a.role!=='customer'||!a.user?.emailVerified)throw fail('Usa tu cuenta de cliente con correo verificado.',403);
  const orderId=url.searchParams.get('orderId');if(!/^[A-Za-z0-9_-]{1,150}$/.test(orderId||''))throw fail('Pedido inválido.');
  const order=await db(env,'/orders/'+orderId);
  if(!order||order.userId!==a.id||order.status!=='entregado'||!order.paidAt||!order.invoiced||!(order.total>0))throw fail('Selecciona un pedido tuyo pagado y entregado.',409);
  if(Number(request.headers.get('Content-Length'))>MAX)throw fail('La captura supera 4 MB.',413);
  const reader=request.body?.getReader();if(!reader)throw fail('Selecciona una captura.');
  const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();throw fail('La captura supera 4 MB.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const mime=request.headers.get('Content-Type');
  const png=bytes.length>24&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
  const jpeg=bytes.length>10&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.length>16&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!((mime==='image/png'&&png)||(mime==='image/jpeg'&&jpeg)||(mime==='image/webp'&&webp)))throw fail('Sube una captura JPG, PNG o WebP; no videos ni documentos.',415);
  const day=new Date().toISOString().slice(0,10);
  await mutateDb(env,'/instagramProofQuota/'+a.id,current=>{
    const count=current?.day===day?Number(current.count||0):0;if(count>=5)throw fail('Alcanzaste el límite de 5 cargas de comprobantes por día.',429);
    return {day,count:count+1};
  },5,true);
  const key=PREFIX+a.id+'/'+orderId+'/'+crypto.randomUUID(),expiresAt=Date.now()+AGE;
  await env.DRIVER_DOCS.put(key,bytes,{httpMetadata:{contentType:mime},customMetadata:{kind:'instagram-promotion-proof',owner:a.id,order:orderId,expiresAt:String(expiresAt)}});
  return Response.json({proof:{key,expiresAt:new Date(expiresAt).toISOString()}},{headers:{'Cache-Control':'no-store'}});
 }};
}
export async function cleanupStoryProofs(env,now=Date.now()){
 let cursor,deleted=0;
 do{
  const page=await env.DRIVER_DOCS.list({prefix:PREFIX,limit:500,include:['customMetadata'],...(cursor?{cursor}:{})});
  const keys=page.objects.filter(o=>validKey(o.key)&&o.customMetadata?.kind==='instagram-promotion-proof'&&o.uploaded.getTime()+AGE<=now).map(o=>o.key);
  if(keys.length){await env.DRIVER_DOCS.delete(keys);deleted+=keys.length;}
  cursor=page.truncated?page.cursor:undefined;
 }while(cursor);
 return {deleted};
}
