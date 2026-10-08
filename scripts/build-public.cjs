const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
// Fail before publication if either entrypoint omits a required dependency.
for(const entry of ['index.html','personal.html']){
 const html=fs.readFileSync(path.join(root,entry),'utf8');
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0].replace(/^\//,''));
 const update=scripts.indexOf('js/updates-v112.js'),app=scripts.indexOf('js/app.js');
 if(update<0 || app<=update || scripts.indexOf('js/screens.js')<0 || scripts.indexOf('js/screens.js')>=app)throw new Error(entry+': missing updates dependency before app');
 if(scripts.indexOf('js/finance.js')<0 || scripts.indexOf('js/finance.js')>=app)throw new Error(entry+': missing finance dependency');
 for(const src of scripts)if(!fs.existsSync(path.join(root,src)))throw new Error(entry+': missing '+src);
}
fs.rmSync(path.join(root,'public'),{recursive:true,force:true});
// Explicit allowlist: server, tests, documentation and secrets are never copied.
for(const name of ['vendor','robots.txt','js','css','delivery','index.html','personal.html','manifest.json','personal-manifest.json','sw.js','informacion.html','_headers'])fs.cpSync(path.join(root,name),path.join(root,'public',name),{recursive:true});
// Only the new logo and neutral interface assets are published; no inherited menu photographs.
for(const name of ['logo.jpg','alerta.wav','delivery-moto-3d.webp','lempira-3d.webp'])fs.cpSync(path.join(root,'assets',name),path.join(root,'public/assets',name));
fs.cpSync(path.join(root,'icons/google.svg'),path.join(root,'public/icons/google.svg'));
fs.cpSync(path.join(root,'assets/menu'),path.join(root,'public/assets/menu'),{recursive:true});
// Publish only the signed installer, never the Android project/toolchain/signing folder.
const apk=path.join(root,'releases/El-Chingadazo-1.0.0.apk');
if(fs.existsSync(apk))fs.cpSync(apk,path.join(root,'public/descargas/El-Chingadazo-1.0.0.apk'));
console.log('Archivos públicos sincronizados.');
