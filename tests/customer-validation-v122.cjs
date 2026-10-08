const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.js','utf8'),access=fs.readFileSync('server/access.js','utf8');
const ui={};vm.createContext(ui);vm.runInContext(app.slice(app.indexOf('function customerDni('),app.indexOf('async function finishAuthLogin(')),ui);
const backend={};vm.createContext(backend);vm.runInContext(access.slice(access.indexOf('function customerDni('),access.indexOf('  async function profileSave(')),backend);
for(const ctx of [ui,backend]){
 for(const value of ['080119901234','08011990123456','A801199012345','0801199012345A',''])assert.equal(ctx.customerDni(value),'');
 assert.equal(ctx.customerDni('0801-1990-12345'),'0801199012345');
 for(const value of ['9999000','999900000','99990000A','+199990000',''])assert.equal(ctx.customerPhone(value),'');
 for(const value of ['99990000','9999-0000','+504 9999-0000','50499990000'])assert.equal(ctx.customerPhone(value),'99990000');
}
assert(ui.customerProfileComplete({name:'Ana',phone:'99990000',dni:'0801199012345',addresses:[{line:'Calle'}]}));
assert(!ui.customerProfileComplete({name:'Ana',phone:'99990000',dni:'080119901234',addresses:[{line:'Calle'}]}));
(async()=>{
 const old={id:'auth-u1',name:'Ana',role:'customer',phone:'99990000',dni:'123456',points:900,welcomeBonus:500,createdAt:'2020-01-01',addresses:[{id:'ad1',line:'Antigua'},{id:'ad2',line:'Otra'}]};
 const db={users:[old],settings:{welcomeBonus:500}},cart=[{productId:'p',qty:2}];let route;
 const ctx={...ui,window:{Cloud:true},STATE:{googleAuth:{uid:'u1',emailVerified:true,email:'a@test'},afterLogin:'checkout',cart},Store:{get:()=>db,uid:()=> 'ad3',patch:f=>f(db)},AuthBridge:{},normalizeEmail:v=>v.toLowerCase(),persistUser:async()=>true,Cloud:{sync:async()=>{}},trackFunnel:()=>{},alert:()=>{},go:v=>route=v,Date};
 vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('async function register(data)'),app.indexOf('document.addEventListener("toggle"')),ctx);
 await ctx.register({name:'Ana',address:'Nueva',email:'a@test',phone:'+504 99990000',dni:'0801199012345'});
 assert.equal(db.users.length,1);assert.equal(db.users[0].points,900);assert.equal(db.users[0].welcomeBonus,500);assert.equal(db.users[0].createdAt,'2020-01-01');assert.equal(db.users[0].addresses[1].line,'Otra');assert.equal(route,'checkout');assert.equal(ctx.STATE.cart,cart);
 console.log('DNI/phone parity, profile completion, existing rewards and checkout continuation PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
