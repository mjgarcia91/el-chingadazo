// Private, read-only financial estimates. Money is aggregated in integer centavos.
const DAY = 86400000;
const cents = n => Math.round((Number(n) || 0) * 100 + 1e-8);
const values = obj => Object.values(obj || {}).filter(Boolean);
const fail = (message, status=400) => Object.assign(new Error(message), {status});
export function defaultFinanceConfig() {
  return {fx:26.5, fxConfirmed:false, pos:{percent:2.25,perTransactionUsd:0,monthly:950,currency:'HNL',start:'2000-01-01'},app:{percent:2.05,perTransactionUsd:0.15,monthly:45,currency:'USD',start:''}};
}
function dateMs(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw fail('Selecciona fechas válidas.');
  const t=Date.parse(day+'T00:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10)!==day) throw fail('Fecha inválida.');
  return t;
}
export function validateConfig(input) {
  if (!input || !Number.isFinite(input.fx) || input.fx<=0 || input.fx>1000) throw fail('Tipo de cambio inválido.');
  const cfg={fx:input.fx,fxConfirmed:input.fxConfirmed===true};
  for(const key of ['pos','app']) {
    const p=input[key];
    if (!p || !['HNL','USD'].includes(p.currency)) throw fail('Moneda inválida.');
    for(const [field,max] of [['percent',100],['perTransactionUsd',1000],['monthly',1000000]]) {
      if(!Number.isFinite(p[field]) || p[field]<0 || p[field]>max) throw fail('Tarifa inválida: '+field);
    }
    if(p.start) dateMs(p.start);
    cfg[key]={percent:p.percent,perTransactionUsd:p.perTransactionUsd,monthly:p.monthly,currency:p.currency,start:p.start||''};
  }
  return cfg;
}
function monthlyCost(p,fx,from,to) {
  if(!p.start) return 0;
  const start=Math.max(dateMs(from),dateMs(p.start)),end=dateMs(to);
  let total=0;
  for(let t=start;t<=end;) {
    const d=new Date(t),next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
    const first=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
    const days=(Math.min(end+DAY,next)-t)/DAY;
    total+=cents(p.monthly*(p.currency==='USD'?fx:1))*days/((next-first)/DAY);
    t=next;
  }
  return Math.round(total);
}
function hnDate(iso) {
  const ms=Date.parse(iso);
  // Honduras UTC-06 year-round. Invalid dates never become today's sales.
  return Number.isFinite(ms)?new Date(ms-6*3600000).toISOString():'';
}
function cardChannel(o) {
  if(o.paymentChannel==='online') return o.gatewayPayment?.verified===true && o.gatewayPayment?.status==='captured' && o.gatewayPayment?.transactionId ? 'app':'unknown';
  if(o.paymentChannel==='pos' || o.paidBy || o.invoicedBy || o.source==='caja') return 'pos';
  return 'unknown';
}
function add(map,label,amount,count=1,qty=0) {
  const x=map.get(label)||{label,amount:0,count:0,qty:0};x.amount+=amount;x.count+=count;x.qty+=qty;map.set(label,x);
}
const sorted = map => [...map.values()].sort((a,b)=>b.amount-a.amount || a.label.localeCompare(b.label));
export function financeReport(db,config,from,to) {
  const start=dateMs(from),end=dateMs(to);
  if(start>end || end-start>3660*DAY) throw fail('Usa un rango ordenado de hasta 10 años.');
  const cfg=validateConfig(config),buckets={};
  for(const key of ['pos','app','unknown']) buckets[key]={count:0,gross:0,commission:0,transactionFees:0,net:0,monthly:key==='unknown'?0:monthlyCost(cfg[key],cfg.fx,from,to)};
  const report={from,to,count:0,gross:0,tax:0,delivery:0,tips:0,rewards:0,base:0,average:0,cards:buckets,cancelledPaid:{count:0,gross:0},invalid:0,transactions:[]};
  const maps=Object.fromEntries(['payments','channels','hours','products','categories','customers','cashiers','dates'].map(k=>[k,new Map()]));
  const products=new Map(values(db.products).map(p=>[p.id,p]));
  const categories=new Map(values(db.categories).map(c=>[c.id,c.name]));
  const users=new Map(values(db.users).map(u=>[u.id,u.name]));
  for(const o of values(db.orders)) {
    if(!o.paidAt || !o.invoiced)continue;
    const local=hnDate(o.paidAt),day=local.slice(0,10);
    if(!local){report.invalid++;continue;}
    if(day<from || day>to)continue;
    if(!Number.isFinite(Number(o.total)) || Number(o.total)<0){report.invalid++;continue;}
    const gross=cents(o.total);
    if(o.status==='cancelado' || o.cancelledAt){report.cancelledPaid.count++;report.cancelledPaid.gross+=gross;continue;}
    report.count++;report.gross+=gross;report.tax+=cents(o.tax);report.delivery+=cents(o.deliveryFee);report.tips+=cents(o.tip);report.rewards+=cents(o.redeemValue);
    const payment=['Efectivo','Tarjeta','Transferencia'].includes(o.payment)?o.payment:'Sin identificar';
    const channel=o.channel==='whatsapp'||o.posChannel==='whatsapp'?'WhatsApp':o.source==='caja'||o.channel==='mostrador'?'Caja':'App';
    const group=(end-start)/DAY>92?day.slice(0,7):day;
    add(maps.payments,payment,gross);add(maps.channels,channel,gross);add(maps.hours,local.slice(11,13)+':00',gross);add(maps.dates,group,gross);
    add(maps.customers,o.customerName||users.get(o.userId)||'Sin nombre',gross);
    add(maps.cashiers,users.get(o.paidBy||o.invoicedBy)||(o.paymentChannel==='online'?'Pago en línea':'Sin identificar'),gross);
    for(const item of o.items||[]) {
      const qty=Number(item.qty)||0,amount=cents(item.unit)*qty,p=products.get(item.productId);
      if(qty<=0 || !Number.isFinite(amount))continue;
      add(maps.products,item.name||p?.name||'Sin nombre',amount,1,qty);
      const category=item.categoryName||categories.get(item.categoryId||p?.category||p?.categoryId)||p?.category||'Sin categoría';
      add(maps.categories,category,amount,1,qty);
    }
    if(payment==='Tarjeta') {
      const key=cardChannel(o),b=buckets[key],rate=cfg[key];
      const commission=rate?Math.round(gross*rate.percent/100):0;
      const fee=rate?cents(rate.perTransactionUsd*cfg.fx):0;
      b.count++;b.gross+=gross;b.commission+=commission;b.transactionFees+=fee;b.net+=gross-commission-fee;
      report.transactions.push({id:o.id,code:o.code||o.id,paidAt:o.paidAt,customer:o.customerName||'',channel:key,orderChannel:channel,gross,commission:key==='unknown'?null:commission,fee:key==='unknown'?null:fee,net:key==='unknown'?null:gross-commission-fee});
    }
  }
  report.base=report.gross-report.tax-report.delivery-report.tips;
  report.average=report.count?Math.round(report.gross/report.count):0;
  for(const [k,m]of Object.entries(maps)) report[k]=k==='dates'||k==='hours'?[...m.values()].sort((a,b)=>a.label.localeCompare(b.label)):sorted(m);
  // Include zero-sale days/months: trend must not connect gaps as if sales occurred.
  const trend=new Map(report.dates.map(x=>[x.label,x]));
  for(let t=start;t<=end;){const d=new Date(t),label=d.toISOString().slice(0,(end-start)/DAY>92?7:10);if(!trend.has(label))trend.set(label,{label,amount:0,count:0});t=(end-start)/DAY>92?Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1):t+DAY;}
  report.dates=[...trend.values()].sort((a,b)=>a.label.localeCompare(b.label));
  report.transactions.sort((a,b)=>b.paidAt.localeCompare(a.paidAt));
  return report;
}
export function createFinance({db,identity,json}) {
  async function handle(request,env) {
    const actor=await identity(request,env);
    if(!actor)throw fail('Inicia sesión.',401);
    if(actor.role!=='admin')throw fail('Solo administración puede consultar finanzas.',403);
    if(request.method==='POST') {
      if(Number(request.headers.get('content-length')||0)>12000)throw fail('Solicitud demasiado grande.',413);
      const config=validateConfig(await request.json());
      await db(env,'/financeConfig',{method:'PUT',body:JSON.stringify({...config,updatedBy:actor.id,updatedAt:new Date().toISOString()})});
      return json({config});
    }
    if(request.method!=='GET')throw fail('Método no permitido.',405);
    const url=new URL(request.url),from=url.searchParams.get('from'),to=url.searchParams.get('to');
    const start=dateMs(from),end=dateMs(to);if(start>end||end-start>3660*DAY)throw fail('Usa un rango ordenado de hasta 10 años.');
    const [orders,products,categories,users,saved]=await Promise.all(['orders','products','categories','users','financeConfig'].map(p=>db(env,'/'+p)));
    const config=saved?validateConfig(saved):defaultFinanceConfig();
    return json({config,report:financeReport({orders,products,categories,users},config,from,to),generatedAt:new Date().toISOString()});
  }
  return {handle};
}
