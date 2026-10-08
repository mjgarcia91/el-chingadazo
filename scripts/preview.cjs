// Local-only preview of the public build. Never exposes project or server files.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../public');
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.wav':'audio/wav'};
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'El Chingadazo está en preparación.'})); }
  const aliases = {'/':'/index.html','/personal':'/personal.html','/personal/':'/personal.html','/delivery':'/delivery/index.html','/delivery/':'/delivery/index.html'};
  let name; try { name = decodeURIComponent(aliases[url.pathname] || url.pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('El Chingadazo: http://127.0.0.1:4173'));
