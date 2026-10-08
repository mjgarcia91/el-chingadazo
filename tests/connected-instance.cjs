const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ctx={};
vm.runInNewContext(read('js/instance-config.js'),ctx);
assert.equal(ctx.CHINGADAZO_CONFIG.configured,true);
assert.equal(ctx.CHINGADAZO_CONFIG.publicOrigin,'https://el-chingadazo.magaa1825.workers.dev');
assert.equal(ctx.CHINGADAZO_CONFIG.firebase.projectId,'el-chingadazo-cfe45');
assert.equal(ctx.CHINGADAZO_CONFIG.googleSignInEnabled,false);
vm.runInNewContext(read('js/data.js')+';globalThis.db={settings:SEED_SETTINGS,products:SEED_PRODUCTS,categories:SEED_CATEGORIES,users:[]};',ctx);
Object.assign(ctx,{Store:{get:()=>ctx.db},STATE:{cart:[]},cartCount:()=>0,escapeHtml:s=>s,productCard:()=>'',bestSellers:()=>[],isStoreOpen:()=>false,openLabel:()=>'',cartAttentionHtml:()=>''});
const app=read('js/app.js');
for(const [start,end] of [['function viewHome()','function viewMenu()'],['function viewLogin()','function viewStaffAccess()'],['function viewRegister()','function viewAccount()']]) {
  assert(app.indexOf(end)>app.indexOf(start));
  vm.runInNewContext(app.slice(app.indexOf(start),app.indexOf(end)),ctx);
}
assert.match(ctx.viewHome(),/chingadazo-welcome/);
assert.doesNotMatch(ctx.viewHome(),/PEDIDO LISTO|Puntos Chingadazo|Pedidos para las/);
for(const view of [ctx.viewLogin,ctx.viewRegister]) {
  assert.doesNotMatch(view(),/id="google(Login|Register)"|TRAPIPUNTOS|500|GRATIS|AL CONFIRMAR/);
}
ctx.CHINGADAZO_CONFIG.googleSignInEnabled=true;
assert.match(ctx.viewLogin(),/id="googleLogin"/);
assert.match(ctx.viewRegister(),/id="googleRegister"/);
ctx.db.settings.welcomeBonus=100;
assert.match(ctx.viewRegister(),/100 PUNTOS CHINGADAZO/);
console.log('PASS connected configuration: own origin, closed ordering, no unavailable Google or inherited welcome promotion.');
