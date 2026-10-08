const WAIT_OPTS = [25, 35, 45, 55, 60];
const HN_TZ = "America/Tegucigalpa";

function hnParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HN_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), min: g("minute") };
}
function hnHour(iso) {
  return hnParts(iso ? new Date(iso) : new Date()).h;
}
function hnYmd(iso) {
  const p = hnParts(iso ? new Date(iso) : new Date());
  return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
}
function orderWhen(o) {
  return o && (o.paidAt || o.createdAt || o.statusAt || "");
}
function channelOf(o) {
  if (!o) return "app";
  if (o.channel === "whatsapp" || o.posChannel === "whatsapp") return "whatsapp";
  if (o.source === "caja" || o.channel === "mostrador") return "caja";
  return "app";
}
function isRevenueOrder(o) {
  return !!(o && o.status !== "cancelado" && o.invoiced === true && o.paidAt);
}
function dayOrders(db, ymd) {
  return (db.orders || []).filter((o) => isRevenueOrder(o) && hnYmd(orderWhen(o)) === ymd);
}
function dayShifts(db, ymd) {
  return (db.shifts || []).filter((s) => {
    if (!s) return false;
    const a = hnYmd(s.openedAt);
    const b = s.closedAt ? hnYmd(s.closedAt) : hnYmd();
    return a <= ymd && ymd <= b;
  });
}
function dayReport(db, ymd, end = ymd) {
  const list = (db.orders || []).filter(o => isRevenueOrder(o) && orderWhen(o) && Number.isFinite(Date.parse(orderWhen(o))) && hnYmd(orderWhen(o)) >= ymd && hnYmd(orderWhen(o)) <= end);
  const sum = (arr) => arr.reduce((a, o) => a + Number(o.total || 0), 0);
  const food = (o) => Math.max(0, Number(o.total || 0) - Number(o.deliveryFee || 0) - Number(o.tip || 0));
  const ch = { app: [], caja: [], whatsapp: [] };
  list.forEach((o) => { (ch[channelOf(o)] || ch.app).push(o); });
  const pay = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  list.forEach((o) => {
    const k = o.payment === "Tarjeta" ? "Tarjeta" : o.payment === "Transferencia" ? "Transferencia" : "Efectivo";
    pay[k] += Number(o.total || 0);
  });
  const items = {};
  list.forEach((o) => (o.items || []).forEach((i) => {
    items[i.name] = items[i.name] || { qty: 0, sales: 0 };
    items[i.name].qty += Number(i.qty || 1);
    items[i.name].sales += Number(i.unit || 0) * Number(i.qty || 1);
  }));
  return {
    ymd,
    list,
    n: list.length,
    sales: list.reduce((a,o)=>a+food(o),0),
    collected: sum(list),
    deliveryFees: list.reduce((a,o)=>a+Number(o.deliveryFee || 0),0),
    tips: list.reduce((a,o)=>a+Number(o.tip || 0),0),
    app: { n: ch.app.length, sales: sum(ch.app) },
    caja: { n: ch.caja.length, sales: sum(ch.caja) },
    whatsapp: { n: ch.whatsapp.length, sales: sum(ch.whatsapp) },
    pay,
    items: Object.entries(items).sort((a, b) => b[1].sales - a[1].sales),
    shifts: (db.shifts || []).filter(s => s && s.openedAt && hnYmd(s.openedAt) <= end && (s.closedAt ? hnYmd(s.closedAt) : hnYmd()) >= ymd)
  };
}
function fmtHn(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-HN", { timeZone: HN_TZ, dateStyle: "short", timeStyle: "short" });
}
function parseHM(raw, fallback) {
  const t = String(raw || fallback || "11:00");
  const [hh, mm] = t.split(":").map(Number);
  return { hh: Number.isFinite(hh) ? hh : 11, mm: Number.isFinite(mm) ? mm : 0 };
}
function parseOpensAt(s) { return parseHM(s && s.opensAt, "11:00"); }
function hnWeekday(date = new Date()) {
  const w = date.toLocaleString("en-US", { timeZone: HN_TZ, weekday: "short" });
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[w] ?? 1;
}
function closeHM(settings, date = new Date()) {
  const sun = (settings && settings.closeSun) || "20:00";
  const week = (settings && settings.closeWeek) || "21:00";
  return parseHM(hnWeekday(date) === 0 ? sun : week, "21:00");
}
function hmLabel({ hh, mm }) {
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}
function withinHours(settings, date = new Date()) {
  if (settings?.weeklyHours && globalThis.ChingadazoHours) return !!ChingadazoHours.active(settings,date);
  const p = hnParts(date);
  const nowM = p.h * 60 + p.min;
  const o = parseOpensAt(settings);
  const c = closeHM(settings, date);
  return nowM >= o.hh * 60 + o.mm && nowM < c.hh * 60 + c.mm;
}
function isStoreOpen(settings) {
  const s = settings || Store.get().settings || {};
  return s.open === true && withinHours(s);
}
function nextOpenIso(settings) {
  if (settings?.weeklyHours && globalThis.ChingadazoHours) {
    const next=ChingadazoHours.next(settings);
    return next ? new Date(next).toISOString() : '';
  }
  const s = settings || {};
  const o = parseOpensAt(s);
  const p = hnParts();
  const nowM = p.h * 60 + p.min;
  const openM = o.hh * 60 + o.mm;
  const c = closeHM(s);
  const closeM = c.hh * 60 + c.mm;
  const addDay = nowM >= openM ? 1 : 0;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + addDay, o.hh + 6, o.mm, 0)).toISOString();
}
function openLabel(settings) {
  if (settings?.weeklyHours && globalThis.ChingadazoHours) {
    const next=ChingadazoHours.next(settings);
    return next ? ChingadazoHours.format(next) : 'horario por confirmar';
  }
  return hmLabel(parseOpensAt(settings || {}));
}
function hoursBanner(settings) {
  const s = settings || {};
  if (s.weeklyHours && globalThis.ChingadazoHours) {
    if (s.open !== true) return 'Pedidos pausados temporalmente';
    const active=ChingadazoHours.active(s);
    if(active) return 'Abierto ahora · cierra a las '+ChingadazoHours.format(active.end);
    const next=ChingadazoHours.next(s);
    return next ? 'Cerrado · abre '+new Date(next).toLocaleString('es-HN',{timeZone:HN_TZ,weekday:'long',hour:'numeric',minute:'2-digit',hour12:true}) : 'Cerrado · horario por confirmar';
  }
  if (isStoreOpen(s)) return "Abierto ahora · cierra a las " + hmLabel(closeHM(s));
  if (s.open !== true) return "Cerrado · abre a las " + openLabel(s);
  const p = hnParts();
  const nowM = p.h * 60 + p.min;
  const o = parseOpensAt(s);
  if (nowM < o.hh * 60 + o.mm) return "Cerrado · abre hoy a las " + openLabel(s);
  return "Cerrado · abre mañana a las " + openLabel(s);
}
const STATUS_LABEL = {
  nuevo: "Nuevo",
  preparacion: "En cocina",
  listo: "Listo",
  camino: "En camino",
  entregado: "Entregado",
  facturada: "Facturada",
  programado: "Programado",
  cancelado: "Cancelado"
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function inRange(iso, from, to) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}
function paidOrders(orders) {
  return (orders || []).filter(isRevenueOrder);
}
function crmStats(db) {
  const now = new Date();
  const day0 = startOfDay(now);
  const week0 = new Date(day0);
  week0.setDate(week0.getDate() - 6);
  const month0 = new Date(day0.getFullYear(), day0.getMonth(), 1);
  const paid = paidOrders(db.orders);
  const slice = (from) => paid.filter((o) => inRange(o.createdAt, from, now));
  const sum = (list) => list.reduce((a, o) => a + Number(o.total || 0), 0);
  const ptsCost = (list) => list.reduce((a, o) => a + Number(o.redeemValue || 0), 0);
  const ptsGiven = (list) => list.filter((o) => o.status === "entregado" || o.pointsGranted).reduce((a, o) => a + Number(o.pointsEarned || 0), 0);
  const byItem = {};
  const byFam = {};
  paid.forEach((o) => {
    (o.items || []).forEach((i) => {
      byItem[i.name] = byItem[i.name] || { qty: 0, sales: 0 };
      byItem[i.name].qty += i.qty;
      byItem[i.name].sales += i.unit * i.qty;
      const prod = (db.products || []).find((p) => p.id === i.productId);
      const fam = prod?.category || "otros";
      byFam[fam] = byFam[fam] || { qty: 0, sales: 0 };
      byFam[fam].qty += i.qty;
      byFam[fam].sales += i.unit * i.qty;
    });
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, n: 0, sales: 0 }));
  slice(day0).forEach((o) => {
    const h = hnHour(o.paidAt || o.createdAt);
    hours[h].n += 1;
    hours[h].sales += Number(o.total || 0);
  });
  const customers = (db.users || []).filter((u) => u.role === "customer" || (u.role !== "admin" && u.role !== "cashier" && u.role !== "kitchen")).map((u) => {
    const theirs = paid.filter((o) => samePerson(u, o));
    return {
      ...u,
      orders: theirs.length,
      spent: sum(theirs),
      points: livePoints(u),
      rewardCost: ptsCost(theirs)
    };
  }).sort((a, b) => b.spent - a.spent);
  return {
    day: { orders: slice(day0).length, sales: sum(slice(day0)), ptsCost: ptsCost(slice(day0)), ptsGiven: ptsGiven(slice(day0)) },
    week: { orders: slice(week0).length, sales: sum(slice(week0)), ptsCost: ptsCost(slice(week0)), ptsGiven: ptsGiven(slice(week0)) },
    month: { orders: slice(month0).length, sales: sum(slice(month0)), ptsCost: ptsCost(slice(month0)), ptsGiven: ptsGiven(slice(month0)) },
    byItem: Object.entries(byItem).sort((a, b) => b[1].qty - a[1].qty),
    byFam: Object.entries(byFam).sort((a, b) => b[1].sales - a[1].sales),
    hours,
    customers,
    allSales: sum(paid),
    allOrders: paid.length
  };
}

function barChart(rows, maxKey) {
  const max = Math.max(1, ...rows.map((r) => r[maxKey]));
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row">
      <span class="bar-lab">${r.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((r[maxKey] / max) * 100)}%"></div></div>
      <span class="bar-val">${r.display}</span>
    </div>`).join("")}</div>`;
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function viewAdminCRM() {
  const user = currentUser();
  if (!user || user.role !== "admin") return viewLogin();
  const db = Store.get();
  const nowP = hnParts();
  const y = STATE.calY || nowP.y;
  const m = STATE.calM != null ? STATE.calM : (nowP.m - 1);
  const sel = STATE.calDay || hnYmd();
  const from = STATE.salesFrom || sel, to = STATE.salesTo || from;
  const report = dayReport(db, from, to);
  const monthName = new Date(y, m, 1).toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  const cells = monthGrid(y, m);
  const salesByDay = {};
  (db.orders || []).forEach((o) => {
    if (!isRevenueOrder(o) || !Number.isFinite(Date.parse(orderWhen(o)))) return;
    const k = hnYmd(orderWhen(o));
    if (!k.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)) return;
    salesByDay[k] = (salesByDay[k] || 0) + Number(o.total || 0);
  });
  const s = crmStats(db);
  const hourRows = s.hours.filter((h) => h.n).map((h) => ({
    label: String(h.h).padStart(2, "0") + ":00",
    n: h.n,
    display: `${h.n} · ${money(h.sales)}`
  }));
  const itemRows = s.byItem.slice(0, 8).map(([name, v]) => ({
    label: name, n: v.qty, display: `${v.qty} · ${money(v.sales)}`
  }));
  const famRows = s.byFam.map(([name, v]) => ({
    label: name, n: v.sales, display: money(v.sales)
  }));
  const chLab = { app: "App", caja: "Caja / walk-in", whatsapp: "WhatsApp" };
  return `
    <div class="section-h"><h2>Ventas</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <form class="form card-block sales-range" id="salesRangeForm">
      <label>Desde<input type="date" name="from" required value="${from}"></label>
      <label>Hasta<input type="date" name="to" required value="${to}"></label>
      <button class="btn gold" type="submit">Ver ventas</button>
      <button class="btn ghost" type="button" data-sales-today>Hoy</button>
      <small>Fechas inclusivas · hora de Honduras · ventas facturadas. Toca un día del calendario para consultar solo ese día.</small>
    </form>
    ${FinanceUI.view(from,to)}
    <details class="finance-legacy"${STATE.crmUser ? " open" : ""}><summary>Calendario, turnos, detalle de ventas y CRM histórico</summary>
    <div class="card-block cal-wrap">
      <div class="section-h" style="margin:0">
        <button class="btn ghost" data-cal-nav="-1">‹</button>
        <h3 style="text-transform:capitalize;margin:0">${monthName}</h3>
        <button class="btn ghost" data-cal-nav="1">›</button>
      </div>
      <div class="cal-week">${["L","M","M","J","V","S","D"].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">
        ${cells.map((d) => {
          if (!d) return `<span class="cal-empty"></span>`;
          const ymd = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          const sold = salesByDay[ymd] || 0;
          return `<button type="button" class="cal-day ${ymd >= from && ymd <= to ? "on" : ""} ${sold ? "has" : ""}" data-cal-day="${ymd}">
            <b>${d}</b>${sold ? `<small>${money(sold)}</small>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>
    <div class="card-block">
      <h3>${from === to ? 'Día ' + from : 'Del ' + from + ' al ' + to}</h3>
      <div class="admin-grid">
        <div class="kpi"><b>${report.n}</b><span>Órdenes</span></div>
        <div class="kpi"><b>${money(report.sales)}</b><span>Venta de comida</span></div>
        <div class="kpi"><b>${money(report.deliveryFees)}</b><span>Tarifas de delivery</span></div>
        <div class="kpi"><b>${money(report.tips)}</b><span>Propinas de repartidores</span></div>
        <div class="kpi"><b>${money(report.collected)}</b><span>Total cobrado</span></div>
        <div class="kpi"><b>${report.app.n}</b><span>App · ${money(report.app.sales)}</span></div>
        <div class="kpi"><b>${report.caja.n}</b><span>Caja · ${money(report.caja.sales)}</span></div>
        <div class="kpi"><b>${report.whatsapp.n}</b><span>WhatsApp · ${money(report.whatsapp.sales)}</span></div>
        <div class="kpi"><b>${money(report.pay.Efectivo)}</b><span>Efectivo</span></div>
        <div class="kpi"><b>${money(report.pay.Tarjeta)}</b><span>Tarjeta</span></div>
        <div class="kpi"><b>${money(report.pay.Transferencia)}</b><span>Transfer</span></div>
      </div>
      <h4 style="margin-top:14px">Turnos que coinciden con las fechas</h4><p class="hint">Los importes de cada turno corresponden a su cierre completo. Los totales de ventas de arriba sí se filtran por las fechas seleccionadas.</p>
      ${report.shifts.length ? report.shifts.map((sh) => `
        <article class="order">
          <b>${sh.userName || "Cajero"}</b> · ${sh.autoClosed ? "CERRADO AUTOMÁTICAMENTE · 11:00 p. m." : sh.closedAt ? "cerrado" : "ABIERTO"}
          <div class="hint">Entró ${fmtHn(sh.openedAt)}${sh.closedAt ? " · salió " + fmtHn(sh.closedAt) : ""}</div>
          <div class="hint">Fondo ${money(sh.fondo)} · Efectivo ${money(sh.cash)} · Tarjeta ${money(sh.card)} · Transfer ${money(sh.transfer)}</div>
          ${sh.closedAt ? `<div class="hint">Esperado ${money(sh.expected)} · ${sh.arqueoPending?"Arqueo pendiente":`Contado ${money(sh.counted)} · Dif. ${money(sh.diff)}`}</div>` : ""}
        </article>`).join("") : "<p class='hint'>Nadie abrió turno ese día.</p>"}
      <h4 style="margin-top:14px">Qué se vendió</h4>
      ${report.items.length ? `<table class="table"><tr><th>Producto</th><th>Cant.</th><th>L.</th></tr>${report.items.map(([n,v]) => `<tr><td>${n}</td><td>${v.qty}</td><td>${money(v.sales)}</td></tr>`).join("")}</table>` : "<p class='hint'>Sin ventas.</p>"}
      <h4 style="margin-top:14px">Órdenes</h4>
      ${report.list.map((o) => `<div class="hint" style="margin:6px 0">${o.code} · ${chLab[channelOf(o)]} · ${o.payment || ""} · ${fmtHn(orderWhen(o))} · ${money(o.total)} · ${o.customerName || ""}</div>`).join("") || "<p class='hint'>Ninguna.</p>"}
    </div>
    <div class="admin-grid">
      <h3>Resumen general · independiente del rango seleccionado</h3>
      <div class="kpi"><b>${s.day.orders}</b><span>Órdenes hoy</span></div>
      <div class="kpi"><b>${money(s.day.sales)}</b><span>Ventas hoy</span></div>
      <div class="kpi"><b>${money(s.day.ptsCost)}</b><span>Costo rewards hoy</span></div>
      <div class="kpi"><b>${s.week.orders}</b><span>Órdenes 7 días</span></div>
      <div class="kpi"><b>${money(s.week.sales)}</b><span>Ventas 7 días</span></div>
      <div class="kpi"><b>${money(s.week.ptsCost)}</b><span>Rewards 7 días</span></div>
      <div class="kpi"><b>${s.month.orders}</b><span>Órdenes del mes</span></div>
      <div class="kpi"><b>${money(s.month.sales)}</b><span>Ventas del mes</span></div>
      <div class="kpi"><b>${money(s.month.ptsCost)}</b><span>Rewards del mes</span></div>
    </div>
    <div class="card-block">
      <h3>Órdenes por hora (hoy)</h3>
      ${hourRows.length ? barChart(hourRows, "n") : "<p class='hint'>Aún no hay ventas hoy.</p>"}
    </div>
    <div class="card-block">
      <h3>Productos más vendidos</h3>
      ${itemRows.length ? barChart(itemRows, "n") : "<p class='hint'>Sin datos todavía.</p>"}
    </div>
    <div class="card-block">
      <h3>Ventas por familia</h3>
      ${famRows.length ? barChart(famRows, "n") : "<p class='hint'>Sin datos.</p>"}
    </div>
    <details class="fold">
      <summary>Clientes y puntos</summary>
      <div class="card-block">
      <h3>Clientes y puntos</h3>
      <div style="overflow:auto">
        <table class="table">
          <tr><th>Cliente</th><th>Tel</th><th>Órdenes</th><th>Gastó</th><th>Puntos</th><th>Rewards</th></tr>
          ${s.customers.map((c) => `<tr data-crm-user="${c.id}" style="cursor:pointer">
            <td>${c.name}<div class="hint">${c.email} · DNI ${c.dni || "—"}</div></td>
            <td>${c.phone}</td>
            <td>${c.orders}</td>
            <td>${money(c.spent)}</td>
            <td>${c.points}</td>
            <td>${money(pointsToLempiras(c.points || 0))}</td>
          </tr>`).join("") || "<tr><td colspan='6'>Sin clientes</td></tr>"}
        </table>
      </div>
      ${(() => {
        const id = STATE.crmUser;
        const c = id && (db.users || []).find((u) => u.id === id);
        if (!c) return "<p class='hint'>Toca un cliente para ver ficha e historial.</p>";
        const hist = (db.orders || []).filter((o) => o.userId === c.id);
        return `<div class="card-block" style="margin-top:12px">
          <h3>Ficha · ${c.name}</h3>
          <p>DNI ${c.dni || "—"} · ${c.email || ""} · ${c.phone || ""}</p>
          <p>Dirección: ${(c.addresses || []).map((a) => a.line).join(" · ") || "—"}</p>
          <p>Puntos ${c.points || 0} = ${money(pointsToLempiras(c.points || 0))} · canje torta desde ${ptsForTorta()} pts</p>
          ${hist.map((o) => `<div class="hint">${o.code} · ${fmtHn(o.createdAt)} · ${o.status} · ${money(o.total)} · +${o.pointsEarned || 0} pts ${o.redeemPts ? "canje −" + o.redeemPts : ""}</div>`).join("") || "<p class='hint'>Sin compras.</p>"}
        </div>`;
      })()}
    </div>
    </details></details>`;
}

function viewAdminClientes() {
  if (!canAdmin()) return viewLogin();
  const db = Store.get();
  const s = crmStats(db);
  const list = (s.customers || []).filter((c) => c.role === "customer" || !["admin", "cashier", "kitchen"].includes(c.role));
  const id = STATE.crmUser;
  const c = id && (db.users || []).find((u) => u.id === id);
  const hist = c ? (db.orders || []).filter((o) => samePerson(c, o)) : [];
  return `
    <div class="section-h"><h2>Clientes</h2><button class="btn ghost" data-go="admin-crm">Ventas / CRM</button></div>
    <p class="hint">${list.length} clientes registrados. Toca uno para ver puntos e historial.</p>
    <details class="fold" open>
      <summary>Lista de clientes · ${list.length}</summary>
      <div style="overflow:auto">
        <table class="table">
          <tr><th>Cliente</th><th>Tel</th><th>Órdenes</th><th>Gastó</th><th>Pts</th></tr>
          ${list.map((u) => `<tr data-crm-user="${u.id}" style="cursor:pointer">
            <td>${u.name}<div class="hint">${u.email || ""}</div></td>
            <td>${u.phone || "—"}</td>
            <td>${u.orders || 0}</td>
            <td>${money(u.spent || 0)}</td>
            <td>${livePoints(u)}</td>
          </tr>`).join("") || "<tr><td colspan='5'>Sin clientes aún</td></tr>"}
        </table>
      </div>
    </details>
    ${c ? `<details class="fold" open>
      <summary>Ficha · ${c.name}</summary>
      <p>DNI ${c.dni || "—"} · ${c.email || ""} · ${c.phone || ""}</p>
      <p>Dirección: ${(c.addresses || []).map((a) => a.line).join(" · ") || "—"}</p>
      <p>Puntos ${livePoints(c)} = ${money(pointsToLempiras(livePoints(c)))}</p>
      ${hist.map((o) => `<div class="hint">${o.code} · ${fmtHn(o.createdAt)} · ${o.status} · ${money(o.total)} · +${o.pointsEarned || 0}${o.redeemPts ? " · canje −" + o.redeemPts : ""}</div>`).join("") || "<p class='hint'>Sin compras.</p>"}
    </details>` : ""}`;
}

function viewAdminCover() {
  const user = currentUser();
  if (!user || user.role !== "admin") return viewLogin();
  const s = Store.get().settings;
  return `
    <div class="section-h"><h2>Portada</h2><button class="btn ghost" data-go="admin">Volver</button></div>
    <form class="form card-block" id="coverForm">
      <label>Título grande</label>
      <input name="heroTitle" value="${s.heroTitle || "Comida mexicana con todo el sabor"}">
      <label>Subtítulo</label>
      <textarea name="heroSubtitle" rows="2">${s.heroSubtitle || "El Chingadazo · Comida mexicana."}</textarea>
      <label>Foto de portada</label>
      <input type="hidden" name="heroImage" value="">
      <button class="btn gold" type="button" id="pickCover">Elegir foto de la galería</button>
      <input type="file" id="coverFile" accept="image/jpeg,image/png,image/webp,image/*">
      <p class="hint">La foto se aplica al elegirla. Luego Guardar portada.</p>
      <label>Alto de la portada</label>
      <input name="heroHeight" type="range" min="140" max="320" value="${s.heroHeight || 210}">
      <div style="position:relative;min-height:${s.heroHeight || 210}px;border-radius:16px;overflow:hidden">
        <img src="${s.heroImage || "assets/logo.jpg"}" alt="portada" style="width:100%;height:${s.heroHeight || 210}px;object-fit:cover">
      </div>
      <button class="btn" type="submit">Guardar portada</button>
    </form>`;
}
