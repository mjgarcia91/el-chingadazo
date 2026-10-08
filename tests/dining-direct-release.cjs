const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
(async()=>{
 for(const status of ['open','checkout','paid']){
  const dom=new JSDOM('<main></main>',{url:'https://test.local',runScripts:'outside-only'}),w=dom.window;
  w.navigator.locks={request:async(name,options,fn)=>fn({})};w.confirm=()=>true;
  w.eval(fs.readFileSync('js/dining.js','utf8'));
  const state={initialized:true,layoutVersion:2,consumptionsEnabled:true,revision:1,tables:{t:{id:'t',number:21,row:1,column:1,active:true,accountId:'a'}},accounts:{a:{id:'a',tableId:'t',status,total:433,items:[{name:'Comida',qty:1,unit:433}],openedAt:new Date().toISOString()}}};
  let command;
  w.DiningUI.mount(w.document.querySelector('main'),{user:{id:'admin',role:'admin'},isActive:()=>true,api:async(path,options)=>{if(options)command=JSON.parse(options.body);return {...structuredClone(state),operationId:command?.operationId};}});
  await new Promise(r=>setTimeout(r,10));w.document.querySelector('[data-dining-table="t"]').click();
  const release=w.document.querySelector('[data-dining-action="release"]');
  assert.equal(!!release,status==='paid','Only confirmed paid accounts can be released');
  if(release){release.click();await new Promise(r=>setTimeout(r,10));assert.equal(command.action,'release');assert.equal(command.accountId,'a');}
  w.DiningUI.stop();w.close();
 }
 console.log('PASS direct release: paid only, existing audited API, no checkout');
})().catch(e=>{console.error(e);process.exitCode=1});
