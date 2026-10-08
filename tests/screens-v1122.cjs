// Algorithm test with synthetic geometry, not a real-browser visual test.
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dom=new JSDOM('<body><div class="kds-shell"><span data-kds-count></span><div class="kds-board"></div></div></body>',{url:'https://test.local/personal',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
let frame,intervals=[],width=1000,height=580;Object.assign(w,{scrollTo:()=>{},STATE:{view:'cocina'},currentUser:()=>({role:'kitchen'}),canCash:()=>false,requestAnimationFrame:f=>{frame=f;return 1},cancelAnimationFrame:()=>{},setInterval:f=>{intervals.push(f);return intervals.length}});
Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{get(){return this.classList.contains('kds-board')?width:310}},clientHeight:{get(){return this.classList.contains('kds-board')?height:parseInt(this.style.height)||100}},scrollHeight:{get(){if(!this.classList.contains('kds-fragment'))return 0;return 170+[...this.querySelectorAll('.kds-fragment-body>*')].reduce((sum,n)=>sum+Math.ceil(n.textContent.length/24)*25+12,0)}}});
const board=w.document.querySelector('.kds-board');
const note='Sin cebolla y sin picante. '.repeat(100)+'FINAL DE NOTA';
for(let i=0;i<9;i++){const card=w.document.createElement('article');card.className='kds-ticket';card.innerHTML='<header class="kds-ticket-head">TT-'+i+'</header><div class="kds-meta">PARA LLEVAR</div><div class="kds-items"><section class="kds-item"><b>2× Tortas '+i+'</b><p>Carne pollo</p><div class="kds-note"></div></section></div><button class="ready">MARCAR LISTA</button>';card.querySelector('.kds-note').textContent=i===0?note:'Nota '+i;board.append(card);}
w.eval(fs.readFileSync(path.join(__dirname,'../js/screens.js'),'utf8'));w.ScreenLayout.before();w.ScreenLayout.after();frame();
assert(w.document.body.classList.contains('kitchen-display'));assert(board.querySelectorAll('.kds-page').length>1);assert.equal([...board.querySelectorAll('.kds-note')].map(n=>n.textContent).join(''),note+Array.from({length:8},(_,i)=>'Nota '+(i+1)).join(''));
assert(!board.querySelector('button'));assert(board.textContent.includes('Parte 2/'));assert.equal(board.querySelectorAll('.kds-page:not([hidden])').length,1);
for(const c of board.querySelectorAll('.kds-fragment'))assert(c.scrollHeight<=parseInt(c.style.height)+1);
const old=w.document.querySelector('[data-kds-count]').textContent;intervals[0]();assert.notEqual(w.document.querySelector('[data-kds-count]').textContent,old);
width=1500;height=900;w.dispatchEvent(new w.Event('resize'));frame();assert(board.textContent.includes('FINAL DE NOTA'));assert.equal([...board.querySelectorAll('.kds-note')].map(n=>n.textContent).join(''),note+Array.from({length:8},(_,i)=>'Nota '+(i+1)).join(''));
w.STATE.view='account';w.ScreenLayout.before();assert(!w.document.body.classList.contains('kitchen-display'));
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');assert(!app.includes('checkout-trust'));assert(app.includes('class="account-info"'));
console.log('PASS display algorithm: long notes retained, numbered continuations, page rotation, resize, readonly TV, exit and removed checkout notices. Synthetic geometry only.');dom.window.close();
