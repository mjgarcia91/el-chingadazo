const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
(async()=>{
 const {financeReport,defaultFinanceConfig}=await import('../server/finance.js');
 const config=defaultFinanceConfig();
 const orders=Array.from({length:31},(_,i)=>({id:'o'+i,code:i===0?'=HYPERLINK("bad")':'TT-'+i,source:'app',paidBy:'cash',customerName:'<img src=x onerror=alert(1)>',invoiced:true,paidAt:'2026-09-10T18:00:00Z',status:'entregado',total:100,payment:'Tarjeta',items:[{name:'Torta <script>',unit:100,qty:1}]}));
 const dom=new JSDOM('<main id="root"></main>',{runScripts:'outside-only',url:'https://test.local'}),w=dom.window;
 w.STATE={view:'admin-crm',salesFrom:'2026-09-01',salesTo:'2026-09-30'};w.currentUser=()=>({id:'admin',role:'admin'});w.canAdmin=()=>true;
 w.escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.money=x=>'L. '+Number(x).toFixed(2);w.fmtHn=x=>x;w.hnYmd=()=> '2026-09-24';
 let calls=0,fail=false;
 w.updatesApi=async()=>{calls++;if(fail)throw Error('Sin conexión');return{config,report:financeReport({orders},config,w.STATE.salesFrom,w.STATE.salesTo),generatedAt:'2026-09-24T18:00:00Z'}};
 w.eval(fs.readFileSync('js/finance.js','utf8')+'\nwindow.testUI=FinanceUI;');
 w.render=()=>{w.document.getElementById('root').innerHTML=w.testUI.view(w.STATE.salesFrom,w.STATE.salesTo)};
 const tick=()=>new Promise(r=>setTimeout(r,20));w.render();await tick();
 assert.equal(calls,1);assert(w.document.querySelector('.finance-donut'));assert.equal(w.document.querySelectorAll('.finance-payment').length,2);assert.equal(w.document.querySelectorAll('.finance-table-scroll tbody tr').length>=25,true);
 const change=(selector,value)=>{const el=w.document.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 for(const type of ['bars','vertical','pie','table','donut']){change('[data-finance-chart]',type);assert(w.document.querySelector('.finance-panel'));}
 for(const dim of ['products','categories','hours','cashiers','customers','channels','payments'])change('[data-finance-dimension]',dim);
 assert(!w.document.querySelector('img'));assert(!w.document.querySelector('script'));
 w.document.querySelector('[data-finance-page="1"]').click();assert(w.document.body.textContent.includes('Página 2 de 2'));
 change('[data-finance-channel]','app');assert(w.document.body.textContent.includes('No hay cobros con tarjeta'));
 const csv=w.testUI.csv([{code:'=SUM(1)',paidAt:'x',channel:'pos',orderChannel:'app',gross:100,commission:2,fee:0,net:98}]);assert(csv.includes("\"'=SUM(1)\""));
 w.testUI.preset('quarter');await tick();assert.equal(w.STATE.salesFrom,'2026-07-01');assert.equal(w.STATE.salesTo,'2026-09-24');
 fail=true;w.document.querySelector('[data-finance-refresh]').click();await tick();assert(w.document.querySelector('[role="alert"]'));
 fail=false;w.document.querySelector('[data-finance-refresh]').click();await tick();assert(!w.document.querySelector('[role="alert"]'));
 for(const file of ['index.html','personal.html']){const s=fs.readFileSync(file,'utf8');assert(s.indexOf('js/finance.js')<s.indexOf('js/app.js'));assert(s.includes('css/finance.css'));}
 const sw=fs.readFileSync('sw.js','utf8');assert(sw.includes('chingadazo-v131'));assert(sw.includes('/js/finance.js?v=114'));assert(sw.includes('/css/finance.css?v=114'));
 dom.window.close();console.log('PASS finance UI: carga, 5 gráficos, dimensiones, páginas, filtro tarjetas, CSV seguro, trimestre, error/reintento, entradas y caché.');
})().catch(e=>{console.error(e);process.exitCode=1});
