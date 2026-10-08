const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const {JSDOM}=await import('jsdom');
 const app=fs.readFileSync('js/app.js','utf8');
 const ctx=vm.createContext({canAdmin:()=>true,Store:{get:()=>({users:[]})},STATE:{fold:{}},currentUser:()=>null});
 vm.runInContext(app.slice(app.indexOf('function viewTeam()'),app.indexOf('function staffAvatarFile(')),ctx);
 const dom=new JSDOM(ctx.viewTeam()),f=dom.window.document.querySelector('#staffForm');
 assert.equal(f.querySelector('[name="authUid"]'),null,'No Firebase code required in UI');
 for(const name of ['email','password','passwordConfirm'])assert.equal(f.elements.namedItem(name),null);
 f.elements.role.value='admin';assert.equal(f.elements.role.value,'admin');
 assert.equal(f.elements.pin.type,'password');assert.equal(f.elements.pin.minLength,6);
 assert.equal(f.querySelectorAll('[required]').length,3,'Only name, role and PIN are required');
 assert.doesNotMatch(app.slice(app.indexOf('if (e.target.id === "staffForm")'),app.indexOf('if (e.target.matches("[data-staff-pin-form]"))')),/createEmail|signInEmail|localStorage|sessionStorage|authUid/);
 console.log('PASS admin form: only name/role/PIN, optional photo, masked PIN, no UID/email/password or session switching.');
})().catch(e=>{console.error(e);process.exitCode=1;});
