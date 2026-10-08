const fs=require('node:fs');
const crypto=require('node:crypto').webcrypto;
const assert=require('node:assert/strict');

(async()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'../server/push.js'),'utf8');
  await require('./fixtures/configure-instance.cjs')('chingadazo-test');
  const {createPush}=await import('../server/push.js');
  const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:1024,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
  const env={FIREBASE_WEB_VAPID_KEY:'vapid',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'push@example.test',project_id:'chingadazo-test',private_key:`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n`})};
  const removed=[];
  const db=async(_env,path,init)=>{
    if(init?.method==='DELETE'){removed.push(path);return null;}
    if(path==='/roles/uid')return 'driver';
    if(path==='/users/auth-uid')return {active:true};
    if(path==='/drivers/auth-uid')return {status:'approved'};
    if(path==='/pushTokens/drivers')return {'auth-uid':{good:{token:'x'.repeat(80)},old:{token:'y'.repeat(80)}}};
    return null;
  };
  let fcm=0;
  global.fetch=async (url,options={})=>{
    if(String(url).includes('oauth2.googleapis.com')){
      assert.equal(options.body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
      assert.ok(options.body.get('assertion'));
      return new Response(JSON.stringify({access_token:'oauth'}),{status:200});
    }
    fcm++;
    return fcm===1?new Response(JSON.stringify({name:'ok'}),{status:200}):new Response(JSON.stringify({error:{status:'UNREGISTERED',message:'Requested entity was not found.'}}),{status:404});
  };
  const push=createPush({db,verifyFirebaseUser:async()=>({localId:'uid'}),json:(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})});
  const response=await push.test(new Request('https://example.test/api/delivery/push-test',{method:'POST',headers:{Authorization:'Bearer valid'}}),env);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.result.sent,1);
  assert.equal(body.result.failed,1);
  assert.equal(body.result.removed,1);
  assert.equal(removed.length,1);
  console.log('PASS push: OAuth correcto, envío simulado, diagnóstico y eliminación de token vencido.');
})().catch(error=>{console.error(error);process.exitCode=1});
