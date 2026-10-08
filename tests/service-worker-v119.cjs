const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const listeners={},fetched=[],cached=[];
const ctx={URL,Response,console,self:{location:{origin:'https://el-chingadazo.invalid'},addEventListener:(n,f)=>listeners[n]=f},fetch:async(req)=>{fetched.push(req.url||req);return new Response('ok')},caches:{open:async()=>({put:async(req)=>cached.push(req.url)}),match:async()=>undefined}};
vm.runInNewContext(fs.readFileSync(process.argv[2] || 'sw.js','utf8'),ctx);
async function request(url){let response,handled=false;const work=[];listeners.fetch({request:{url,method:'GET'},respondWith:p=>{handled=true;response=p},waitUntil:p=>work.push(p)});if(response)await response;await Promise.all(work);return handled;}
(async()=>{
 for(const url of ['https://apis.google.com/js/api.js?onload=callback','https://fonts.gstatic.com/s/font.woff2','https://fonts.googleapis.com/css?family=Roboto','https://el-chingadazo-pendiente.firebaseapp.com/__/auth/iframe','https://identitytoolkit.googleapis.com/v1/accounts:lookup']) assert.equal(await request(url),false,'must use native browser loading: '+url);
 assert.equal(fetched.length,0);assert.equal(cached.length,0);
 assert.equal(await request('https://el-chingadazo.invalid/js/app.js?v=118'),true);
 assert.equal(await request('https://el-chingadazo.invalid/api/data/users'),true);
 assert.equal(await request('https://el-chingadazo.invalid/assets/logo.jpg'),true);
 assert.equal(fetched.length,3);assert.deepEqual(cached,['https://el-chingadazo.invalid/assets/logo.jpg']);
 console.log('External auth scripts/fonts bypass SW; local app/API/assets keep their existing handling.');
})().catch(e=>{console.error(e);process.exitCode=1});
