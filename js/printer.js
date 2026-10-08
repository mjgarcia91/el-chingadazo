/* Impresoras ESC/POS: USB directo o RawBT en Android.
   WebUSB se usa solamente durante cada operacion y libera la interfaz al terminar,
   para no bloquear HIOPOS Cloud. */
const ChingadazoPrinter = (() => {
  const KEY = "chingadazo_sunpos_usb_v1";
  const AUTO_KEY = "chingadazo_auto_print_v1";
  const TRANSPORT_KEY = "chingadazo_printer_transport_v1";
  const native = () => window.ChingadazoNative?.isApp === true;
  const transport = () => native() ? 'native' : localStorage.getItem(TRANSPORT_KEY) === 'rawbt' ? 'rawbt' : 'usb';
  function setTransport(value) {
    if (native()) throw new Error('La APK usa su impresora USB nativa, sin RawBT.');
    if (!['usb','rawbt'].includes(value)) throw new Error('Transporte desconocido.');
    if (value === 'rawbt' && !/Android/i.test(navigator.userAgent)) throw new Error('RawBT requiere Android.');
    localStorage.setItem(TRANSPORT_KEY, value);
  }
  // Official byte-preserving URI: https://github.com/402d/DemoRawBtPrinter
  // Explicit links retain a user gesture in Firefox. Never auto-launch competing intents.
  // Jobs live only in this page, not localStorage; no receipt data goes to a server.
  function queueRawbt(bytes, label) {
    if (bytes.length > 65536) throw new Error('Ticket demasiado grande para RawBT.');
    let tray = document.getElementById('rawbt-jobs');
    if (!tray) {
      tray = document.createElement('details');tray.id = 'rawbt-jobs';
      tray.style.cssText = 'position:fixed;z-index:10000;bottom:72px;right:12px;left:12px;max-height:45vh;overflow:auto;padding:14px;background:#181818;color:#fff;border:2px solid #ffda24;border-radius:12px;box-shadow:0 4px 24px #000';
      const title = document.createElement('summary');title.textContent = 'RawBT · envíos pendientes (toca para plegar)';tray.append(title);
      const help = document.createElement('p');help.textContent = 'Toca cada envío y permite abrir RawBT. Al volver, comprueba el papel o la gaveta y retira la fila. Solicitar no confirma impresión. No vuelvas a cobrar. Esta lista se pierde al recargar.';tray.append(help);
      document.body.append(tray);
    }
    if (tray.querySelectorAll('[data-rawbt-job]').length >= 30) throw new Error('Retira los envíos terminados de RawBT antes de continuar.');
    const row = document.createElement('div');row.dataset.rawbtJob = '';row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:10px 0';
    const link = document.createElement('a');link.className = 'btn gold';link.textContent = 'Abrir RawBT: ' + label;
    const uri = 'rawbt:base64,' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));link.href = uri;
    let requested = false;
    link.addEventListener('click', event => {
      if (requested) { event.preventDefault();return; }
      // Navigate synchronously, then disarm this link against double taps.
      event.preventDefault();window.location.href = uri;requested = true;
      link.removeAttribute('href');link.textContent = 'Envío solicitado: ' + label;
      retry.disabled = false;
    });
    const retry = document.createElement('button');retry.type = 'button';retry.className = 'btn ghost';retry.textContent = 'Reintentar';
    retry.disabled = true;
    retry.onclick = () => { if (requested && confirm('¿Reintentar? Puede duplicar el ticket o volver a abrir la gaveta. Comprueba primero el resultado.')) { requested = false;link.href = uri;link.textContent = 'Abrir RawBT: ' + label; } };
    const remove = document.createElement('button');remove.type = 'button';remove.className = 'btn ghost';remove.textContent = 'Retirar';
    remove.onclick = () => { if (requested || confirm('¿Descartar este envío pendiente sin imprimir ni abrir la gaveta?')) { row.remove();if (!tray.querySelector('[data-rawbt-job]')) tray.remove(); } };
    row.append(link,retry,remove);tray.append(row);tray.open = true;
    return { queued:true, transport:'rawbt' };
  }
  const encoder = new TextEncoder();
  const ESC = 0x1b, GS = 0x1d;

  const saved = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  };
  const supported = () => native() || !!navigator.usb;
  const automatic = (fallback = true) => localStorage.getItem(AUTO_KEY) === null ? !!fallback : localStorage.getItem(AUTO_KEY) !== "0";
  const setAutomatic = (value) => localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  const ascii = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\n]/g, "");
  const moneyText = (n) => "L. " + Number(n || 0).toFixed(2);
  const line = (left, right = "", width = 42) => {
    left = ascii(left); right = ascii(right);
    const room = Math.max(1, width - right.length - 1);
    return left.slice(0, room).padEnd(room + 1, " ") + right.slice(-Math.max(0, width - room - 1));
  };
  const center = (value, width = 42) => {
    const s = ascii(value).slice(0, width);
    return " ".repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
  };
  const itemLines = (item) => {
    const qty = Number(item.qty || 1), unit = Number(item.unit || 0);
    const rows = [line(`${qty} x ${item.name || "Producto"}`, moneyText(qty * unit))];
    if (item.modsText) rows.push("  " + ascii(item.modsText).slice(0, 40));
    if (item.note) rows.push("  NOTA: " + ascii(item.note).slice(0, 34));
    return rows.join("\n");
  };
  function receipt(order, kind, settings = {}) {
    const kitchen = kind === "kitchen";
    const rows = [center(kitchen ? "*** COCINA ***" : (settings.name || "EL CHINGADAZO")), center(order.code || order.id || ""), "------------------------------------------"];
    rows.push(line("Fecha", new Date(order.createdAt || Date.now()).toLocaleString("es-HN", { timeZone:"America/Tegucigalpa" })));
    rows.push(line("Cliente", order.customerName || "Mostrador"));
    rows.push(line("Tipo", order.type === "delivery" ? "DOMICILIO" : "PARA LLEVAR"));
    rows.push("------------------------------------------");
    (order.items || []).forEach(item => rows.push(itemLines(item)));
    if (order.notes) rows.push("NOTA GENERAL: " + ascii(order.notes).slice(0, 80));
    rows.push("------------------------------------------");
    if (!kitchen) {
      if (order.deliveryFee) rows.push(line("Envio", moneyText(order.deliveryFee)));
      if (order.tip) rows.push(line("Propina", moneyText(order.tip)));
      rows.push(line("TOTAL", moneyText(order.total)));
      rows.push(line("Pago", order.payment || ""));
      if (order.payment === "Efectivo" && order.payWith) {
        rows.push(line("Recibido", moneyText(order.payWith)));
        rows.push(line("Cambio", moneyText(Math.max(0, Number(order.payWith) - Number(order.total)))));
      }
      rows.push("", center("Gracias por su compra"), center("El buen sabor nos une"));
    }
    return rows.join("\n") + "\n\n\n";
  }
  async function choose() {
    if (!supported()) throw new Error("Este navegador no ofrece WebUSB. En Android selecciona Usar RawBT y después Imprimir prueba.");
    const device = await navigator.usb.requestDevice({ filters: [] });
    localStorage.setItem(KEY, JSON.stringify({ vendorId:device.vendorId, productId:device.productId, productName:device.productName || "Impresora integrada" }));
    return device;
  }
  async function granted() {
    if (!supported()) return null;
    const cfg = saved(), devices = await navigator.usb.getDevices();
    return devices.find(d => !cfg || (d.vendorId === cfg.vendorId && d.productId === cfg.productId)) || null;
  }
  function outputInterface(device) {
    const interfaces = device.configuration?.interfaces || [];
    for (const iface of interfaces) for (const alt of iface.alternates || []) {
      const endpoint = (alt.endpoints || []).find(e => e.direction === "out" && (e.type === "bulk" || e.type === "interrupt"));
      if (endpoint) return { number:iface.interfaceNumber, alternate:alt.alternateSetting, endpoint:endpoint.endpointNumber };
    }
    return null;
  }
  async function use(action, allowChoose = false) {
    let device = await granted();
    if (!device && allowChoose) device = await choose();
    if (!device) throw new Error("Primero toca ‘Conectar impresora integrada’.");
    let iface;
    try {
      if (!device.opened) await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      iface = outputInterface(device);
      if (!iface) throw new Error("No se encontro la salida USB de la impresora.");
      try { await device.claimInterface(iface.number); }
      catch { throw new Error("La impresora esta ocupada. Cierra printer-DEMO o HIOPOS e intenta de nuevo."); }
      if (iface.alternate) await device.selectAlternateInterface(iface.number, iface.alternate);
      return await action(device, iface.endpoint);
    } finally {
      if (device?.opened) {
        if (iface) try { await device.releaseInterface(iface.number); } catch {}
        try { await device.close(); } catch {}
      }
    }
  }
  async function write(device, endpoint, bytes) {
    for (let i = 0; i < bytes.length; i += 2048) {
      const result = await device.transferOut(endpoint, bytes.slice(i, i + 2048));
      if (result.status !== "ok") throw new Error("La impresora no confirmo el envio.");
    }
  }
  async function connect() {
    if (native()) return window.ChingadazoNative.request('connect');
    await use(async (device, endpoint) => {
      await write(device, endpoint, new Uint8Array([ESC, 0x40]));
    }, true);
    setTransport('usb');
    return saved();
  }
  async function print(order, kind, settings) {
    if (native()) return window.ChingadazoNative.request('print',ascii(receipt(order,kind,settings)));
    if (transport() === 'rawbt') {
      const text = encoder.encode(ascii(receipt(order,kind,settings)));
      if (text.length > 65528) throw new Error('Ticket demasiado grande para RawBT.');
      const bytes = new Uint8Array(text.length + 8);
      bytes.set([ESC,0x40,ESC,0x61,0]);bytes.set(text,5);bytes.set([GS,0x56,0],text.length+5);
      return queueRawbt(bytes, (kind === 'kitchen' ? 'Cocina · ' : 'Cliente · ') + String(order.code || order.id || 'Ticket').slice(0,80));
    }
    return use(async (device, endpoint) => {
      const init = new Uint8Array([ESC,0x40,ESC,0x61,0x00]);
      await write(device, endpoint, init);
      await write(device, endpoint, encoder.encode(ascii(receipt(order, kind, settings))));
      await write(device, endpoint, new Uint8Array([GS,0x56,0x01]));
      return true;
    });
  }
  async function summary(account, tableName) {
    if (!native()) throw new Error('El resumen USB requiere la APK.');
    const rows=[center('EL CHINGADAZO'),center(tableName),'RESUMEN - NO ES COMPROBANTE DE PAGO','------------------------------------------',...(account.items||[]).map(itemLines),'------------------------------------------',line('TOTAL',moneyText(account.total)),'\n\n\n'];
    return window.ChingadazoNative.request('print',ascii(rows.join('\n')));
  }
  async function drawer() {
    if (native()) return window.ChingadazoNative.request('drawer');
    if (transport() === 'rawbt') return queueRawbt(new Uint8Array([ESC,0x40,ESC,0x70,0x00,0x19,0xfa]), 'Abrir gaveta');
    return use(async (device, endpoint) => {
      await write(device, endpoint, new Uint8Array([ESC,0x40,ESC,0x70,0x00,0x19,0xfa]));
      return true;
    });
  }
  async function status() {
    if (native()) return { ...(await window.ChingadazoNative.request('status')), automatic:automatic() };
    if (transport() === 'rawbt') return { supported:true, connected:false, configured:true, transport:'rawbt', automatic:automatic(), name:'RawBT (Android)' };
    const device = await granted();
    return { supported:supported(), connected:!!device, configured:!!device, transport:'usb', automatic:automatic(), name:saved()?.productName || "Impresora USB" };
  }
  return { supported, automatic, setAutomatic, connect, print, summary, drawer, status, receipt, transport, setTransport };
})();
window.ChingadazoPrinter = ChingadazoPrinter;
