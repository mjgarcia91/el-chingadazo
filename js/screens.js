/* Display-only layout. Never changes orders, payments or permissions. */
window.ScreenLayout = (() => {
  let page = 0, orderCount = 0, pages = [], frame = 0, source = null, signature = '', observer;
  const preference = () => { try { return localStorage.getItem('chingadazo_kds_tv'); } catch { return null; } };
  const tv = () => typeof STATE !== 'undefined' && STATE.view === 'cocina' && currentUser()?.role === 'kitchen' && (preference() === '1' || (preference() !== '0' && innerWidth >= 900));
  function before() {
    if(typeof STATE === 'undefined')return;
    const changed=document.body.classList.contains('kitchen-display')!==tv();
    if(changed){source=null;signature='';if(typeof lastRenderedMarkup!=='undefined')lastRenderedMarkup='';window.scrollTo(0,0);}
    document.body.classList.toggle('kitchen-display', tv());
    document.body.classList.toggle('cash-screen', STATE.view === 'caja' && canCash() && innerWidth >= 1000 && innerHeight >= 650);
    document.body.classList.toggle('cash-workspace', STATE.view === 'caja' && canCash());
    if(STATE.view!=='caja')document.body.classList.remove('cash-subscreen');
  }
  function show() {
    if (!pages.length) return;
    page = (page + pages.length) % pages.length;
    pages.forEach((p,i)=>{p.hidden=i!==page;});
    const label=document.querySelector('[data-kds-count]');
    if(label)label.textContent=` ${orderCount} órdenes · Página ${page+1} de ${pages.length} · rotación cada 12 s`;
  }
  function fit() {
    frame=0;
    if(!tv()){observer?.disconnect();pages=[];source=null;signature='';return;}
    const board=document.querySelector('.kds-board');
    if(!board)return;
    const width=board.clientWidth,height=board.clientHeight;
    // DOM simulators have no layout; never interpret zero as a real viewport.
    if(width<200||height<160)return;
    const key=width+'x'+height;
    if(source===board && signature===key)return;
    if(source!==board)board._tickets=[...board.children].map(n=>n.cloneNode(true));
    source=board;signature=key;pages=[];
    const originals=board._tickets;orderCount=originals.filter(n=>n.classList.contains('kds-ticket')).length;
    board.replaceChildren();
    if(originals.some(n=>n.classList.contains('kds-empty'))){board.append(originals[0].cloneNode(true));return;}
    const columns=Math.max(1,Math.min(5,Math.floor(width/310)));
    const rows=height>=740 && originals.length>columns ? 2 : 1;
    const slotHeight=Math.floor((height-12*(rows-1))/rows);
    const slotWidth=(width-12*(columns-1))/columns;
    const measure=document.createElement('div');measure.className='kds-measure';measure.style.width=slotWidth+'px';board.append(measure);
    const fragments=[];
    for(const original of originals){
      const blocks=[];
      original.querySelectorAll('.kds-item').forEach(item=>{
        [...item.children].forEach(el=>blocks.push(el.cloneNode(true)));
      });
      const note=original.querySelector('.kds-note.general');if(note)blocks.push(note.cloneNode(true));
      let parts=[],card,body;
      function newCard(){
        card=document.createElement('article');card.className=original.className+' kds-fragment';card.style.height=slotHeight+'px';
        card.append(original.querySelector('.kds-ticket-head').cloneNode(true),original.querySelector('.kds-meta').cloneNode(true));
        const state=document.createElement('div');state.className='kds-part';state.textContent=original.querySelector('.receive')?'NUEVA':original.querySelector('.ready')?'EN PREPARACIÓN':'LISTA';card.append(state);
        body=document.createElement('div');body.className='kds-fragment-body';card.append(body);measure.replaceChildren(card);parts.push(card);
      }
      newCard();
      for(const block of blocks){
        let text=block.textContent;
        while(text.length){
          const el=block.cloneNode(false);el.textContent=text;body.append(el);
          if(card.scrollHeight<=card.clientHeight+1)break;
          el.remove();
          if(body.children.length){newCard();continue;}
          // A single long item/note is continued in another card, never clipped.
          body.append(el);let low=0,high=text.length;
          while(low<high){const mid=Math.ceil((low+high)/2);el.textContent=text.slice(0,mid);if(card.scrollHeight<=card.clientHeight+1)low=mid;else high=mid-1;}
          if(!low){
            // Extremely small viewport: retain every character in an automatically
            // scrolling card instead of silently dropping content.
            el.textContent=text;card.classList.add('kds-auto-scroll');break;
          }
          let cut=low;const space=text.lastIndexOf(' ',low-1);if(space>low/2)cut=space+1;
          el.textContent=text.slice(0,cut);text=text.slice(cut);if(text)newCard();
        }
      }
      parts.forEach((part,i)=>{if(parts.length>1)part.querySelector('.kds-part').textContent+=` · Parte ${i+1}/${parts.length}${i?' · continuación':''}`;});
      fragments.push(...parts);
    }
    measure.remove();
    const capacity=columns*rows;
    for(let i=0;i<fragments.length;i+=capacity){const p=document.createElement('div');p.className='kds-page';p.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;p.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;p.append(...fragments.slice(i,i+capacity));board.append(p);pages.push(p);}
    show();
    if(window.ResizeObserver){observer?.disconnect();observer=new ResizeObserver(after);observer.observe(board);}
  }
  function after(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);}
  addEventListener('resize',()=>{before();signature='';if(typeof render==='function')render();after();});
  document.fonts?.ready.then(()=>{signature='';after();});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-kds-mode]')){try{localStorage.setItem('chingadazo_kds_tv',tv()?'0':'1');}catch{}signature='';source=null;lastRenderedMarkup='';render();}
    const step=e.target.closest('[data-kds-page]');if(step){page+=Number(step.dataset.kdsPage);show();}
  });
  setInterval(()=>{if(tv()&&pages.length>1&&!document.hidden){page++;show();}},12000);
  setInterval(()=>{if(!tv())return;document.querySelectorAll('.kds-page:not([hidden]) .kds-auto-scroll').forEach(c=>{c.scrollTop=c.scrollTop>=c.scrollHeight-c.clientHeight-1?0:c.scrollTop+24;});},1500);
  return {before,after,tv};
})();
