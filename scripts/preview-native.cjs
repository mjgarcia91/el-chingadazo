// Local isolated harness: never expose the project, credentials or production APIs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const routes={'/':'tests/native-browser.html','/js/native-bridge.js':'js/native-bridge.js','/js/printer.js':'js/printer.js'};
http.createServer((req,res)=>{const p=routes[new URL(req.url,'http://localhost').pathname];if(!p){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(path.join(__dirname,'..',p)));}).listen(4181,'127.0.0.1',()=>console.log('APK test: http://127.0.0.1:4181'));
