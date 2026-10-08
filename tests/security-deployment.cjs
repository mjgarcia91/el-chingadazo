const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(root,path.join(dir,e.name)).replaceAll('\\','/')]);
const wrangler=read('wrangler.jsonc');
assert.match(wrangler,/"directory"\s*:\s*"\.\/public"/);
assert.doesNotMatch(wrangler,/"directory"\s*:\s*"\."/);
assert.match(wrangler,/"html_handling"\s*:\s*"none"/);
assert.match(wrangler,/"\/delivery\/"/);
const worker=read('_worker.js');
assert.match(worker,/new URL\("\/index\.html",url\.origin\)/);
assert.match(worker,/new URL\("\/personal\.html",url\.origin\)/);
assert.match(worker,/new URL\("\/delivery\/index\.html",url\.origin\)/);
const publicFiles=walk(path.join(root,'public'));
for(const file of publicFiles){
  assert(!/(^|\/)(server|tests|scripts)(\/|$)/.test(file),file);
  assert(!/\.(?:md|bat)$/i.test(file),file);
  assert(!/(?:wrangler\.jsonc|firebase-rules\.production\.json|_worker\.js)$/.test(file),file);
}
assert(!publicFiles.some(file=>read(file).includes('inverman25@gmail.com')));
assert.match(read('public/robots.txt'),/Disallow:\s*\//);
assert.match(read('public/_headers'),/X-Robots-Tag:\s*noindex/);
assert.match(read('public/js/auth.js'),/const SDK = "\/vendor\/"/);
for(const file of ['firebase-app.js','firebase-auth.js','firebase-messaging.js'])assert(publicFiles.includes('public/vendor/'+file),file);
assert(!read('public/vendor/firebase-auth.js').includes('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'));
console.log('PASS seguridad de despliegue: solo frontend necesario, internos excluidos, correo personal retirado y no indexación activa.');
