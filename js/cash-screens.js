/* Presentation only: move the existing controls, never duplicate a payment handler. */
window.CashScreens=(()=>{
 let active;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function open(pane,internal=false){
  const s=active;if(!s||!s.root.isConnected||(!internal&&s.o.busy()&&!['sale','waiting'].includes(pane)))return;
  if(!['sale','waiting','payment','table-payment'].includes(pane))return;
  s.o.setPane(pane);s.root.dataset.cashPane=pane;
  s.sale.hidden=pane!=='sale';s.queues.hidden=pane!=='sale';
  s.waiting.hidden=!['waiting','table-payment'].includes(pane);s.payment.hidden=pane!=='payment';
  const h=s.waiting.querySelector('h2');h.textContent=pane==='table-payment'?'Cobrar cuenta de mesa':'Mesas en espera';
  s.waiting.querySelector('[data-cash-screen-go="sale"]').textContent=pane==='table-payment'?'Volver sin cobrar':'Volver a Caja';
  s.root.closest('body')?.classList.toggle('cash-subscreen',pane!=='sale');
  const title=pane==='sale'?s.root.querySelector('.pos-heading h2'):(pane==='payment'?s.payment:h.parentElement).querySelector('h2');
  if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
 }
 function mount(root,o){
  if(!root||!root.querySelector('.pos-wrap'))return;
  const sale=root.querySelector('.pos-wrap'),queues=root.querySelector('.pos-work-queues');
  const waiting=document.createElement('section');waiting.className='cash-fullscreen';waiting.dataset.cashScreen='waiting';
  waiting.innerHTML='<header class="cash-screen-heading"><h2>Mesas en espera</h2><button class="btn ghost" data-cash-screen-go="sale">Volver a Caja</button></header>';
  waiting.append(root.querySelector('#diningCashRoot'));root.append(waiting);
  const payment=document.createElement('section');payment.className='cash-fullscreen';payment.dataset.cashScreen='payment';
  payment.innerHTML=`<header class="cash-screen-heading"><h2>Cobrar</h2><button class="btn ghost" data-cash-screen-go="sale">Volver sin cobrar</button></header><div class="cash-checkout-layout"><div class="cash-payment-controls"><h3>Total a pagar</h3><p class="cash-amount">L ${Number(o.total()).toFixed(2)}</p><p>Confirma únicamente cuando hayas recibido el pago.</p></div><aside class="cash-receipt"><h3>Resumen del pedido</h3><p>No es comprobante de pago</p><ul>${o.ticket().map(i=>`<li><span>${i.qty} × ${esc(i.name)}</span><b>L ${(i.qty*i.unit).toFixed(2)}</b></li>`).join('')}</ul><strong>Total L ${Number(o.total()).toFixed(2)}</strong></aside></div>`;
  const controls=payment.querySelector('.cash-payment-controls'),fields=root.querySelector('.pos-payment');
  fields.open=true;fields.removeAttribute('data-fold');controls.append(fields,root.querySelector('.pos-sale-buttons'));root.append(payment);
  controls.querySelectorAll('.pos-sale-buttons button').forEach(b=>b.textContent=b.textContent.replace('Facturar','Cobrar'));
  if(o.pending?.()||o.busy()){
   const status=document.createElement('p');status.setAttribute('role','alert');status.textContent=o.pending?.()?'Venta sin confirmar. Consulta el intento pendiente; no vuelvas a cobrar.':'Registrando venta…';controls.prepend(status);
  }
  const waitButton=document.createElement('button');waitButton.className='btn ghost';waitButton.dataset.cashScreenGo='waiting';waitButton.textContent='Mesas en espera';root.querySelector('.cash-toolbar').append(waitButton);
  const payButton=document.createElement('button');payButton.className='btn gold full';payButton.dataset.cashScreenGo='payment';payButton.textContent=o.table()?'Cobrar cuenta de mesa':'Cobrar';payButton.disabled=!o.ready()||(!o.table()&&!o.ticket().length);
  const total=root.querySelector('.pos-total');if(total)total.after(payButton);else root.querySelector('.pos-ticket-actions').prepend(payButton);
  if(o.table()){const context=document.createElement('button');context.className='btn ghost';context.dataset.cashScreenGo='waiting';context.dataset.cashCurrentTable='';context.textContent='Cuenta de mesa seleccionada · ver consumos';root.querySelector('.pos-ticket-body')?.prepend(context);}
  active={root,o,sale,queues,waiting,payment};
  root.addEventListener('click',e=>{
   const b=e.target.closest('[data-cash-screen-go]');if(!b||b.disabled)return;e.preventDefault();
   if(o.busy()&&!['sale','waiting'].includes(b.dataset.cashScreenGo))return;
   if(o.getPane()==='table-payment'&&b.dataset.cashScreenGo==='sale')o.onTableCancel?.();
   if(b.dataset.cashScreenGo==='payment'&&o.table()){o.onTablePay();return;}
   open(b.dataset.cashScreenGo);
  });
  open(o.getPane()==='payment'&&!o.ticket().length&&!o.pending?.()?'sale':o.getPane()||'sale',true);
 }
 function tableSummary(text){const button=active?.root.querySelector('[data-cash-current-table]');if(button?.isConnected)button.textContent=text;}
 return {mount,open,tableSummary};
})();
