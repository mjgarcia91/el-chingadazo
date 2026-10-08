const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
assert.match(fs.readFileSync('js/app.js','utf8'), /<section class="chingadazo-welcome">/, 'Independent home must not inherit fixed-height hero-visual mobile clipping');
const ctx={};vm.runInNewContext(fs.readFileSync('js/data.js','utf8')+';globalThis.catalog=SEED_PRODUCTS;globalThis.categories=SEED_CATEGORIES;',ctx);
// Independent transcription of the price column in the supplied PDF, in menu order.
assert.deepEqual(Array.from(ctx.catalog,p=>p.price),[189,379,199,199,379,199,199,999,210,189,179,115,145,165,159,699,189,189,169,130,130,130,189,169,189,55]);
assert.equal(new Set(ctx.catalog.map(p=>p.id)).size,26);
assert.equal(new Set(ctx.catalog.map(p=>p.category)).size,8);
for(const p of ctx.catalog) { assert(ctx.categories.some(c=>c.id===p.category));if(p.image)assert(fs.existsSync('public/'+p.image),p.image); }
assert.match(ctx.catalog.at(-1).description,/cerveza se cobra por separado/);
for(const name of fs.readdirSync('public/js')) {
  const text=fs.readFileSync('public/js/'+name,'utf8');
  assert(!/app-tipicos-el-trapiche|tipicoseltrapiche\.com|9631.?7574|190442308153/.test(text),name+' must not contain original service identifiers');
}
assert.deepEqual(fs.readdirSync('public/assets').filter(f=>f.endsWith('.jpg')),['logo.jpg']);
console.log('PASS supplied menu: 26 exact prices, 8 categories, image assets, separate beer price and no original service connections.');
