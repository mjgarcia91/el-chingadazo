const fs=require('node:fs');
const assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const driver=fs.readFileSync(require('node:path').join(__dirname,'../delivery/app.js'),'utf8');

for(const control of ['data-go','data-product','data-qty','data-rem','data-status','data-accept','data-collect','data-tour-next','data-tour-skip']) {
  assert.match(app,new RegExp(control.replace('-','\\-')));
}
for(const control of ['data-ai-accept','data-ai-change','data-ai-budget','data-ai-people','data-ai-surprise','data-family-create','data-family-refresh','data-family-copy','data-family-add','data-family-back','data-family-qty','data-family-remove','data-family-ready','data-family-checkout','data-family-cancel','data-track-delivery']) {
  assert.match(app,new RegExp(control));
}
for(const control of ['data-payer-create','data-payer-refresh','data-payer-copy','data-payer-draw','data-payer-new','data-payer-leave','data-payer-cancel'])assert.match(app,new RegExp(control));
for(const control of ['data-chupi-create','data-chupi-refresh','data-chupi-copy','data-chupi-start','data-chupi-answer','data-chupi-reveal','data-chupi-next','data-chupi-leave','data-chupi-cancel'])assert.match(app,new RegExp(control));
for(const id of ['notifyYes','installAppNow','clearCart','logout']) assert.match(app,new RegExp(`id === "${id}"|id==='${id}'|id === '${id}'`));
for(const action of ['logout','sound','demo-reset','resend','camera','capture','refresh']) assert.match(driver,new RegExp(`dataset\\.action === "${action}"`));
assert.match(driver,/data-proof-input/);assert.match(driver,/dataset\.proof/);assert.match(driver,/uploadDeliveryProof/);assert.match(driver,/data-delivery-code/);
assert.match(driver,/prepareDeliveryProof/);assert.match(driver,/1600/);
assert.match(app,/data-driver-photo/);assert.match(app,/data-delivery-proof/);assert.match(app,/Efectivo recibido del repartidor/);
assert.match(driver,/data-action="demo-login"/);
assert.match(driver,/closest\('\[data-action="demo-login"\]'\)/);
for(const control of ['data-accept','data-reject','data-status','data-order']) assert.match(driver,new RegExp(control));
assert.match(driver,/addEventListener\("submit"/);
assert.match(driver,/addEventListener\("click"/);
assert.match(app,/addEventListener\("submit"/);
assert.match(app,/addEventListener\("click"/);
console.log('PASS botones: navegación, carrito, caja, cocina, administración, registro y delivery tienen controladores.');
