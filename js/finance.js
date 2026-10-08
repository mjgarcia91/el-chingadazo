/* Administrative finance UI. No bank credentials or card data are stored here. */
const FinanceUI = (() => {
  let cached=null,cacheKey='',pendingKey='',error='',errorKey='',chart='donut',dimension='payments',page=0,channel='all',serial=0;
  const palette=['#f4cf39','#38d6a4','#66b8ff','#f18ba9','#bdabff','#f4a65c'];
  const esc=x=>escapeHtml(String(x??''));
  const cash=n=>money(Number(n||0)/100);
  const keyFor=(from,to)=>[currentUser()?.id,from,to].join('|');
  const range=()=>{const from=STATE.salesFrom||STATE.calDay||hnYmd();return {from,to:STATE.salesTo||from};};
  async function load(from,to,force=false) {
    const key=keyFor(from,to);
    if(!force && (cacheKey===key || pendingKey===key))return;
    const ticket=++serial;pendingKey=key;error='';
    try {
      const data=await updatesApi('/api/finance?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to));
      if(ticket!==serial || keyFor(from,to)!==key || !canAdmin())return;
      cached=data;cacheKey=key;page=0;
    } catch(e){if(ticket===serial){error=e.message;errorKey=key;}}
    finally{if(ticket===serial){pendingKey='';if(STATE.view==='admin-crm')render();}}
  }
  function tabular(rows) {
    return `<div class="finance-table-scroll"><table class="table"><thead><tr><th>Detalle</th><th>Importe</th><th>Participación</th><th>Cobros / unidades</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.label)}</td><td>${cash(x.amount)}</td><td>${percent(x.amount,rows)}%</td><td>${x.qty||x.count}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function percent(n,rows){const total=rows.reduce((a,x)=>a+x.amount,0);return total?(n/total*100).toFixed(1):'0.0';}
  function plot(rows,type=chart) {
    if(!rows.length || !rows.some(x=>x.amount))return '<p class="finance-empty">Sin ventas registradas en este período.</p>';
    if(type==='table')return tabular(rows);
    const shown=rows.slice(0,8);if(rows.length>8)shown.push({label:'Otros',amount:rows.slice(8).reduce((a,x)=>a+x.amount,0),count:rows.slice(8).reduce((a,x)=>a+x.count,0)});
    const max=Math.max(1,...shown.map(x=>x.amount)),sum=shown.reduce((a,x)=>a+x.amount,0);
    let offset=0;
    const rings=shown.map((x,i)=>{const size=x.amount/sum*100;const svg=`<circle cx="70" cy="70" r="${type==='pie'?26:52}" fill="none" stroke="${palette[i%palette.length]}" stroke-width="${type==='pie'?52:22}" pathLength="100" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"><title>${esc(x.label)}: ${cash(x.amount)} (${percent(x.amount,shown)}%)</title></circle>`;offset+=size;return svg;}).join('');
    const legend=`<ul class="finance-legend">${shown.map((x,i)=>`<li><span class="finance-dot" style="background:${palette[i%palette.length]}"></span><span>${esc(x.label)}<small>${x.qty?x.qty+' unidades':x.count+' cobros'} · ${percent(x.amount,shown)}%</small></span><b>${cash(x.amount)}</b></li>`).join('')}</ul>`;
    if(type==='donut'||type==='pie')return `<div class="finance-donut-wrap"><svg class="finance-donut" viewBox="0 0 140 140" role="img" aria-label="Distribución de importes; valores en la leyenda">${rings}${type==='donut'?'<text x="70" y="68" text-anchor="middle" class="finance-svg-label">TOTAL</text><text x="70" y="83" text-anchor="middle" class="finance-svg-value">'+esc(cash(sum))+'</text>':''}</svg>${legend}</div>`;
    return `<div class="finance-bars ${type==='vertical'?'finance-vertical':''}">${shown.map((x,i)=>`<div class="finance-bar"><span>${esc(x.label)}</span><div><i style="--bar:${x.amount/max*100}%;background:${palette[i%palette.length]}"></i></div><b>${cash(x.amount)}</b><small>${x.count} registros</small></div>`).join('')}</div>`;
  }
  function trend(rows) {
    if(!rows.some(x=>x.amount))return '<p class="finance-empty">La tendencia aparecerá al registrar ventas.</p>';
    const max=Math.max(1,...rows.map(x=>x.amount));
    const points=rows.map((x,i)=>({x:36+i*628/Math.max(1,rows.length-1),y:155-x.amount/max*125,...x}));
    return `<svg viewBox="0 0 700 190" class="finance-trend" role="img" aria-label="Tendencia por fecha, disponible también como tabla"><line x1="36" y1="155" x2="670" y2="155" stroke="#687482"/><polyline points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="#38d6a4" stroke-width="3"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#f4cf39"><title>${esc(p.label)}: ${cash(p.amount)} · ${p.count} cobros</title></circle>`).join('')}<text x="36" y="18" class="finance-svg-label">${esc(cash(max))}</text><text x="36" y="180" class="finance-svg-label">${esc(rows[0].label)}</text><text x="664" y="180" text-anchor="end" class="finance-svg-label">${esc(rows.at(-1).label)}</text></svg><details><summary>Ver cifras por fecha</summary>${tabular(rows)}</details>`;
  }
  function paymentCard(title,x) {
    return `<article class="finance-payment"><h4>${title}</h4><p>${x.count} cobros registrados</p><dl><div><dt>Total antes de comisiones</dt><dd>${cash(x.gross)}</dd></div><div><dt>Comisión porcentual</dt><dd>− ${cash(x.commission)}</dd></div><div><dt>Cargos por transacción</dt><dd>− ${cash(x.transactionFees)}</dd></div><div class="finance-net"><dt>A acreditar estimado*</dt><dd>${cash(x.net)}</dd></div><div><dt>Mensualidad asignada al período</dt><dd>− ${cash(x.monthly)}</dd></div><div><dt>Después de todos estos costos</dt><dd>${cash(x.net-x.monthly)}</dd></div></dl></article>`;
  }
  function configForm(cfg) {
    return `<details class="card-block finance-config"><summary>Configurar tarifas bancarias</summary><p>Estas tarifas actuales se aplican como estimación a todo el rango consultado. No reconstruyen cambios históricos ni sustituyen el estado de cuenta.</p><form id="financeConfigForm" class="form"><div class="finance-config-grid"><label>Lempiras por US$1<input name="fx" type="number" step="0.0001" min="0.0001" max="1000" required value="${cfg.fx}"></label><label class="choice-row"><input name="fxConfirmed" type="checkbox" ${cfg.fxConfirmed?'checked':''}> Confirmé este tipo de cambio para la estimación</label></div>${['pos','app'].map(k=>`<fieldset><legend>${k==='pos'?'POS físico':'Tarjetas dentro de la app'}</legend><div class="finance-config-grid"><label>Comisión (%)<input name="${k}_percent" type="number" step="0.0001" min="0" max="100" required value="${cfg[k].percent}"></label><label>Cargo por transacción (US$)<input name="${k}_perTransactionUsd" type="number" step="0.0001" min="0" max="1000" required value="${cfg[k].perTransactionUsd}"></label><label>Mensualidad<input name="${k}_monthly" type="number" step="0.01" min="0" max="1000000" required value="${cfg[k].monthly}"></label><label>Moneda<select name="${k}_currency"><option ${cfg[k].currency==='HNL'?'selected':''}>HNL</option><option ${cfg[k].currency==='USD'?'selected':''}>USD</option></select></label><label>Inicio de mensualidad<input name="${k}_start" type="date" value="${cfg[k].start}"></label></div></fieldset>`).join('')}<p class="hint">Sin fecha de inicio no se calcula mensualidad. Se prorratea por los días del período: un mes completo carga una mensualidad, un trimestre tres. La app debe activarse aquí al empezar a pagar el servicio. La afiliación no se incluye.</p><button class="btn gold" type="submit">Guardar tarifas</button><p data-finance-save-status role="status"></p></form></details>`;
  }
  function transactions(r) {
    const rows=r.transactions.filter(x=>channel==='all'||x.channel===channel),pages=Math.max(1,Math.ceil(rows.length/25));page=Math.min(page,pages-1);
    return `<section class="card-block"><div class="section-h"><h3>Detalle de tarjetas</h3><button class="btn ghost" data-finance-export>Descargar CSV</button></div><label>Procesamiento <select data-finance-channel><option value="all" ${channel==='all'?'selected':''}>Todos</option><option value="pos" ${channel==='pos'?'selected':''}>POS físico</option><option value="app" ${channel==='app'?'selected':''}>Dentro de la app</option><option value="unknown" ${channel==='unknown'?'selected':''}>Sin identificar</option></select></label><div class="finance-table-scroll"><table class="table"><thead><tr><th>Pedido / fecha de cobro</th><th>Procesamiento</th><th>Cobrado</th><th>Comisión + cargo</th><th>Neto estimado</th></tr></thead><tbody>${rows.slice(page*25,page*25+25).map(x=>`<tr><td>${esc(x.code)}<small>${esc(fmtHn(x.paidAt))}</small></td><td>${{pos:'POS físico',app:'App',unknown:'Sin identificar'}[x.channel]}<small>Pedido: ${esc(x.orderChannel)}</small></td><td>${cash(x.gross)}</td><td>${x.net===null?'—':cash(x.commission+x.fee)}</td><td>${x.net===null?'Pendiente de clasificar':cash(x.net)}</td></tr>`).join('')||'<tr><td colspan="5">No hay cobros con tarjeta en este período.</td></tr>'}</tbody></table></div><div class="finance-pages"><button class="btn ghost" data-finance-page="-1" ${page===0?'disabled':''}>Anterior</button><span>Página ${page+1} de ${pages} · ${rows.length} cobros</span><button class="btn ghost" data-finance-page="1" ${page+1>=pages?'disabled':''}>Siguiente</button></div></section>`;
  }
  function view(from,to) {
    const key=keyFor(from,to);
    if(errorKey!==key)error='';
    if(cacheKey!==key && pendingKey!==key && !error)setTimeout(()=>load(from,to),0);
    const header=`<section class="finance-panel"><div class="finance-heading"><div><span class="finance-eyebrow">CONTROL FINANCIERO</span><h3>Entiende tus ventas</h3><p>${esc(from)} — ${esc(to)} · fecha de cobro · Honduras</p></div><button class="btn ghost" data-finance-refresh ${pendingKey?'disabled':''}>Actualizar cifras</button></div><div class="finance-presets">${[['today','Hoy'],['yesterday','Ayer'],['week','Esta semana'],['month','Este mes'],['lastmonth','Mes anterior'],['quarter','Este trimestre'],['year','Este año']].map(([k,l])=>`<button class="btn ghost" data-finance-period="${k}">${l}</button>`).join('')}</div>`;
    if(error)return header+`<p role="alert">${esc(error)}. Usa Actualizar cifras para reintentar.</p></section>`;
    if(cacheKey!==key||!cached)return header+'<p role="status" aria-busy="true">Preparando cifras del período…</p></section>';
    const r=cached.report,cfg=cached.config;
    const rows=r[dimension]||r.payments;
    return header+`<p class="hint">Actualizado ${esc(fmtHn(cached.generatedAt))}. Solo pedidos facturados y cobrados; cancelados excluidos.</p><div class="finance-kpis">${[['Total cobrado',cash(r.gross)],['Cobros',r.count],['Ticket promedio cobrado',cash(r.average)],['Venta sin impuesto, envío ni propina',cash(r.base)],['Impuesto registrado',cash(r.tax)],['Delivery',cash(r.delivery)],['Propinas',cash(r.tips)],['Canjes aplicados',cash(r.rewards)]].map(([l,v])=>`<article><span>${l}</span><b>${v}</b></article>`).join('')}</div>
      ${r.cancelledPaid.count?`<p class="finance-warning">Revisar ${r.cancelledPaid.count} pedidos cobrados y cancelados (${cash(r.cancelledPaid.gross)}): excluidos del total, sin asumir reembolso bancario.</p>`:''}${r.invalid?`<p class="finance-warning">${r.invalid} registros tienen fecha o importe inválido y requieren revisión.</p>`:''}
      <div class="finance-chart-grid"><section class="card-block"><div class="finance-selectors"><label>Analizar<select data-finance-dimension>${[['payments','Forma de pago'],['channels','Origen del pedido'],['products','Productos'],['categories','Categorías'],['hours','Horas'],['cashiers','Cajeros'],['customers','Clientes']].map(([k,l])=>`<option value="${k}" ${dimension===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Visualización<select data-finance-chart>${[['donut','Dona'],['pie','Tarta'],['bars','Barras horizontales'],['vertical','Columnas'],['table','Tabla']].map(([k,l])=>`<option value="${k}" ${chart===k?'selected':''}>${l}</option>`).join('')}</select></label></div>${plot(rows)}<p class="hint">${['products','categories'].includes(dimension)?'Importes de productos antes de canjes, impuesto, envío y propina. Categoría histórica si existe; de lo contrario, catálogo actual.':'Importes cobrados. Los registros son pedidos, no comprobantes del banco.'}</p></section><section class="card-block"><h3>Evolución de ventas</h3>${trend(r.dates)}<p class="hint">${r.dates[0]?.label.length===7?'Agrupado por mes':'Agrupado por día'} · mismo rango seleccionado</p></section></div>
      <section class="card-block"><h3>Tarjetas y comisiones</h3><p>Separadas por dónde se procesó el pago, independientemente de dónde se hizo el pedido.</p>${!cfg.fxConfirmed?`<p class="finance-warning">Tipo de cambio sin confirmar: L${esc(cfg.fx)} por US$1. Confirma o actualiza el valor en Tarifas.</p>`:''}<div class="finance-chart-grid">${paymentCard('POS físico · caja',r.cards.pos)}${paymentCard('Pago dentro de la app',r.cards.app)}</div><p class="hint">* Neto después de comisión y cargo por transacción; no confirma un depósito. No incluye retenciones, impuestos sobre cargos, contracargos ni ajustes no registrados. Las mensualidades se muestran aparte y no se descuentan automáticamente de la liquidación. Este neto no es utilidad del restaurante.</p>${!cfg.app.start?'<p class="hint">Mensualidad de la app inactiva. La integración bancaria todavía requiere conexión y validación; este panel no cobra tarjetas.</p>':''}${r.cards.unknown.count?`<p class="finance-warning">${r.cards.unknown.count} cobros con tarjeta (${cash(r.cards.unknown.gross)}) sin evidencia del canal: no les asignamos comisiones ni neto.</p>`:''}</section>${transactions(r)}${configForm(cfg)}</section>`;
  }
  function preset(type) {
    const today=hnYmd(),d=new Date(today+'T12:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();
    let a=d,b=d;
    if(type==='yesterday')a=b=new Date(+d-86400000);
    if(type==='week')a=new Date(+d-((d.getUTCDay()+6)%7)*86400000);
    if(type==='month')a=new Date(Date.UTC(y,m,1,12));
    if(type==='lastmonth'){a=new Date(Date.UTC(y,m-1,1,12));b=new Date(Date.UTC(y,m,0,12));}
    if(type==='quarter')a=new Date(Date.UTC(y,Math.floor(m/3)*3,1,12));
    if(type==='year')a=new Date(Date.UTC(y,0,1,12));
    STATE.salesFrom=a.toISOString().slice(0,10);STATE.salesTo=b.toISOString().slice(0,10);STATE.calDay=STATE.salesFrom;STATE.calY=a.getUTCFullYear();STATE.calM=a.getUTCMonth();error='';page=0;render();
  }
  function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function csv(rows){return '\uFEFF'+[['Pedido','Fecha cobro Honduras','Canal cobro','Origen pedido','Cobrado HNL','Comisión HNL','Cargo HNL','Neto estimado HNL'],...rows.map(x=>[x.code,fmtHn(x.paidAt),x.channel,x.orderChannel,(x.gross/100).toFixed(2),x.net===null?'':(x.commission/100).toFixed(2),x.net===null?'':(x.fee/100).toFixed(2),x.net===null?'':(x.net/100).toFixed(2)])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
  document.addEventListener('click',e=>{
    if(!canAdmin())return;
    const period=e.target.closest('[data-finance-period]');if(period){preset(period.dataset.financePeriod);return;}
    if(e.target.closest('[data-finance-refresh]')){const {from,to}=range();load(from,to,true);render();return;}
    const pg=e.target.closest('[data-finance-page]');if(pg){page=Math.max(0,page+Number(pg.dataset.financePage));render();return;}
    if(e.target.closest('[data-finance-export]') && cached && cacheKey===keyFor(range().from,range().to)){
      const rows=cached.report.transactions.filter(x=>channel==='all'||channel===x.channel),url=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='tarjetas-'+cached.report.from+'-'+cached.report.to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    if(e.target.closest('[data-cal-day],[data-sales-today]'))error='';
  });
  document.addEventListener('change',e=>{
    if(!canAdmin())return;
    if(e.target.matches('[data-finance-chart]')){chart=e.target.value;render();}
    if(e.target.matches('[data-finance-dimension]')){dimension=e.target.value;render();}
    if(e.target.matches('[data-finance-channel]')){channel=e.target.value;page=0;render();}
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id==='salesRangeForm'){error='';return;}
    if(e.target.id!=='financeConfigForm')return;e.preventDefault();if(!canAdmin())return;
    const f=e.target,b=f.querySelector('button'),status=f.querySelector('[data-finance-save-status]');b.disabled=true;
    try {
      const cfg={fx:Number(f.elements.fx.value),fxConfirmed:f.elements.fxConfirmed.checked};
      for(const k of ['pos','app']){cfg[k]={};for(const name of ['percent','perTransactionUsd','monthly'])cfg[k][name]=Number(f.elements[k+'_'+name].value);cfg[k].currency=f.elements[k+'_currency'].value;cfg[k].start=f.elements[k+'_start'].value;}
      await updatesApi('/api/finance',cfg);cacheKey='';const {from,to}=range();await load(from,to,true);
    }catch(e){status.textContent=e.message;}finally{b.disabled=false;}
  });
  return {view,csv,preset};
})();
