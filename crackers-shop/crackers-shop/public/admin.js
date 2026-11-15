(function () {
  let D = null; // all data
  let tab = 'dash';
  const view = $('#view');
  let pollErrorShown = false;
  const STATUSES = ['new', 'confirmed', 'packed', 'delivered', 'cancelled'];
  const PAYS = ['cash', 'upi', 'card'];
  const stLabel = (s) => t('st' + s);
  const payLabel = (p) => t('pay' + p);
  const pill = (s) => '<span class="pill ' + s + '">' + stLabel(s) + '</span>';
  const catName = (id) => { const c = D.categories.find((x) => x.id === id); return c ? c.emoji + ' ' + cName(c) : id; };
  const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const locale = () => (isEn() ? 'en-IN' : 'ta-IN');
  const shopText = (ta, en) => (isEn() && en ? en : ta);

  /* ---------- auth ---------- */
  let fwStarted = false;
  function showLogin(message = '') {
    D = null;
    $('#app').hidden = true; $('#login').hidden = false;
    $('#loginErr').textContent = message;
    if (!fwStarted) { Fireworks.start($('#sky'), { intensity: 1.2 }); fwStarted = true; }
    $('#pw').focus();
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try { await api('/api/login', 'POST', { password: $('#pw').value }); $('#pw').value = ''; await boot(); }
    catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logout').onclick = async () => {
    try { await api('/api/logout', 'POST', {}); showLogin(); }
    catch (e) { toast(e.message, 'err'); }
  };

  function applyShopName() {
    if (!D) return;
    const n = shopText(D.settings.shopName, D.settings.shopNameEn);
    $('#sideName').textContent = n;
    $('#sideLogo').hidden = !D.settings.logo;
    $('#sideLogoFallback').hidden = !!D.settings.logo;
    if (D.settings.logo) $('#sideLogo').src = D.settings.logo;
    $('#workspaceName').textContent = n;
    document.title = 'Admin - ' + n;
  }
  async function boot() {
    try { D = await api('/api/admin/data'); }
    catch (e) { if (e.status === 401) return showLogin($('#app').hidden ? '' : t('sessionExpired')); toast(e.message, 'err'); return; }
    $('#login').hidden = true; $('#app').hidden = false;
    applyShopName(); updateBadge(); render();
  }
  async function reload() { D = await api('/api/admin/data'); updateBadge(); }
  function updateBadge() {
    const n = D.orders.filter((o) => o.status === 'new').length;
    $('#newBadge').hidden = !n; $('#newBadge').textContent = n;
  }
  $$('nav.side .tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; $$('nav.side .tab').forEach((x) => x.classList.toggle('on', x === b)); render(); }));
  function render() { ({ dash, pos, orders, bills, products, settings }[tab])(); }

  // language switch (login box + sidebar)
  document.addEventListener('click', (e) => {
    const lb = e.target.closest('.lang button');
    if (!lb) return;
    setLang(lb.dataset.lang);
    closeModal();
    applyShopName();
    if (D && !$('#app').hidden) render();
  });
  applyStatic();

  /* ---------- modal ---------- */
  function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.add('on'); }
  function closeModal() { $('#modal').classList.remove('on'); }
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---------- dashboard ---------- */
  function dash() {
    const today = dayKey(new Date().toISOString());
    const billsToday = D.bills.filter((b) => dayKey(b.createdAt) === today);
    const ordersToday = D.orders.filter((o) => dayKey(o.createdAt) === today && o.status !== 'cancelled');
    const counterToday = billsToday.reduce((a, b) => a + b.total, 0);
    const onlineToday = ordersToday.reduce((a, o) => a + o.total, 0);
    const all = D.bills.reduce((a, b) => a + b.total, 0) + D.orders.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0);
    const low = D.products.filter((p) => p.active && p.stock <= 10);
    const newOrders = D.orders.filter((o) => o.status === 'new').length;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = dayKey(d.toISOString());
      const v = D.bills.filter((b) => dayKey(b.createdAt) === k).reduce((a, b) => a + b.total, 0) +
        D.orders.filter((o) => dayKey(o.createdAt) === k && o.status !== 'cancelled').reduce((a, o) => a + o.total, 0);
      days.push({ label: d.toLocaleDateString(locale(), { weekday: 'short' }), v });
    }
    const max = Math.max(1, ...days.map((d) => d.v));

    const sold = {}; // Tamil name -> {q, line}
    const addLines = (lines) => lines.forEach((l) => { (sold[l.name] = sold[l.name] || { q: 0, l }).q += l.qty; });
    D.bills.forEach((b) => addLines(b.lines));
    D.orders.filter((o) => o.status !== 'cancelled').forEach((o) => addLines(o.lines));
    const top = Object.values(sold).sort((a, b) => b.q - a.q).slice(0, 6);

    view.innerHTML =
      '<h2 class="title">' + t('dashTitle') + '</h2>' +
      (D.settings.defaultPassword ? '<div class="warn">' + t('defPwWarn') + '</div>' : '') +
      '<div class="cards">' +
      '<div class="stat g"><small>' + t('cToday') + '</small><b>' + rupee(counterToday) + '</b><small>' + t('nBills', { n: billsToday.length }) + '</small></div>' +
      '<div class="stat b"><small>' + t('oToday') + '</small><b>' + rupee(onlineToday) + '</b><small>' + t('nOrders', { n: ordersToday.length }) + '</small></div>' +
      '<div class="stat o"><small>' + t('newOrdersCard') + '</small><b>' + newOrders + '</b></div>' +
      '<div class="stat"><small>' + t('totalSales') + '</small><b>' + rupee(all) + '</b></div>' +
      '<div class="stat r"><small>' + t('lowCard') + '</small><b>' + low.length + '</b></div></div>' +
      '<div class="two"><div class="panel"><h3>' + t('last7') + '</h3><div class="bars">' +
      days.map((d) => '<div><span>' + (d.v ? rupee(d.v) : '') + '</span><i style="height:' + Math.round((d.v / max) * 130) + 'px"></i>' + esc(d.label) + '</div>').join('') + '</div></div>' +
      '<div class="panel"><h3>' + t('topSold') + '</h3>' + (top.length ? top.map((x, i) => '<div class="row" style="justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--line)"><span>' + (i + 1) + '. ' + esc(pName(x.l)) + '</span><b>' + x.q + '</b></div>').join('') : '<p style="color:var(--muted)">' + t('noSales') + '</p>') + '</div></div>' +
      '<div class="panel"><h3>' + t('lowTitle') + '</h3>' + (low.length ? '<div class="tw"><table><tr><th>' + t('colProduct') + '</th><th class="n">' + t('colStock') + '</th></tr>' + low.map((p) => '<tr><td>' + esc(p.emoji + ' ' + pName(p)) + '</td><td class="n low">' + p.stock + '</td></tr>').join('') + '</table></div>' : '<p style="color:var(--muted)">' + t('stockOk') + '</p>') + '</div>';
  }

  /* ---------- POS billing ---------- */
  let cart = {}, posQ = '', posCat = 'all';
  let extra = 0, payment = 'cash';
  function pos() {
    view.innerHTML =
      '<h2 class="title">' + t('posTitle') + '</h2><div class="pos"><div class="panel">' +
      '<div class="row" style="margin-bottom:10px"><input class="in" id="pq" placeholder="' + esc(t('posSearch')) + '" style="flex:1;min-width:160px" value="' + esc(posQ) + '">' +
      '<select class="in" id="pc" style="width:auto"><option value="all">' + t('allCats') + '</option>' + D.categories.map((c) => '<option value="' + c.id + '"' + (c.id === posCat ? ' selected' : '') + '>' + c.emoji + ' ' + esc(cName(c)) + '</option>').join('') + '</select></div>' +
      '<div class="plist" id="plist"></div></div>' +
      '<div class="panel bill"><h3>' + t('billTitle') + '</h3><div class="fg" style="grid-template-columns:1fr 1fr"><div><label>' + t('custName') + '</label><input class="in" id="bn" placeholder="' + esc(t('optName')) + '"></div><div><label>' + t('mobile') + '</label><input class="in" id="bp" inputmode="numeric" placeholder="' + esc(t('optional')) + '"></div></div>' +
      '<div class="lines" id="blines"></div><div id="bsum"></div></div></div>';
    $('#pq').oninput = (e) => { posQ = e.target.value; plist(); };
    $('#pc').onchange = (e) => { posCat = e.target.value; plist(); };
    plist(); bill();
  }
  function plist() {
    const q = posQ.trim().toLowerCase();
    const list = D.products.filter((p) => p.active && (posCat === 'all' || p.category === posCat) && (!q || (p.name + ' ' + p.nameEn).toLowerCase().includes(q)));
    $('#plist').innerHTML = list.map((p) => '<button class="pbtn" data-p="' + p.id + '"' + (p.stock <= 0 ? ' disabled' : '') + '><span class="e">' + (p.image ? '<span hidden>' + esc(p.emoji) + '</span><img src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : esc(p.emoji)) + '</span><b>' + esc(pName(p)) + '</b><small>' + esc(unitText(p.unit)) + ' • ' + t('stockN', { n: p.stock }) + '</small><span class="pr">' + rupee(p.price) + '</span></button>').join('') || '<p style="color:var(--muted)">' + t('noProduct') + '</p>';
    $$('#plist .pbtn').forEach((b) => b.onclick = () => {
      const p = D.products.find((x) => x.id === Number(b.dataset.p));
      const q2 = (cart[p.id] || 0) + 1;
      if (q2 > Math.min(p.stock, 9999)) return toast(t(p.stock < 9999 ? 'onlyStock' : 'qtyLimit', { n: p.stock }), 'err');
      cart[p.id] = q2; bill();
    });
  }
  function bill() {
    const ids = Object.keys(cart);
    const lines = ids.map((id) => ({ p: D.products.find((x) => x.id === Number(id)), q: cart[id] })).filter((l) => l.p);
    const sub = lines.reduce((a, l) => a + l.p.price * l.q, 0);
    const mrp = lines.reduce((a, l) => a + l.p.mrp * l.q, 0);
    extra = Math.min(extra, sub);
    $('#blines').innerHTML = lines.length ? lines.map((l) => '<div class="bl"><div><b>' + esc(pName(l.p)) + '</b><br><small style="color:var(--muted)">' + rupee(l.p.price) + ' × ' + l.q + '</small></div>' +
      '<input type="number" min="1" max="' + Math.min(l.p.stock, 9999) + '" value="' + l.q + '" data-q="' + l.p.id + '" aria-label="' + esc(t('qty')) + '"><div style="text-align:right;min-width:70px"><b>' + rupee(l.p.price * l.q) + '</b><br><a href="#" data-r="' + l.p.id + '" style="color:var(--red);font-size:12px">' + t('remove') + '</a></div></div>').join('') : '<p style="color:var(--muted);padding:14px 0">' + t('pickLeft') + '</p>';
    $('#bsum').innerHTML =
      '<div class="row" style="justify-content:space-between"><span>' + t('mrpTotal') + '</span><span>' + rupee(mrp) + '</span></div>' +
      '<div class="row" style="justify-content:space-between"><span>' + t('subTotal') + '</span><span>' + rupee(sub) + '</span></div>' +
      '<div class="row" style="justify-content:space-between;margin:6px 0"><span>' + t('extraDisc') + '</span><input class="in" id="bx" type="number" min="0" value="' + extra + '" style="width:110px"></div>' +
      '<div class="row" style="margin:6px 0"><label>' + t('payMode') + '</label><select class="in" id="bpay" style="width:auto">' + PAYS.map((k) => '<option value="' + k + '"' + (k === payment ? ' selected' : '') + '>' + payLabel(k) + '</option>').join('') + '</select></div>' +
      '<div class="tot"><span>' + t('total') + '</span><b>' + rupee(sub - extra) + '</b></div>' +
      '<div class="row"><button class="btn pri" id="bsave" style="flex:1;padding:12px"' + (lines.length ? '' : ' disabled') + '>' + t('saveBill') + '</button><button class="btn gh" id="bclear">' + t('clear') + '</button></div>';
    $$('#blines [data-q]').forEach((i) => i.onchange = () => {
      const p = D.products.find((x) => x.id === Number(i.dataset.q));
      if (p.stock <= 0) { delete cart[p.id]; toast(t('onlyStock', { n: 0 }), 'err'); bill(); return; }
      let v = Math.floor(Number(i.value)) || 1;
      if (v > p.stock) { v = p.stock; toast(t('onlyStock', { n: p.stock }), 'err'); }
      if (v > 9999) { v = 9999; toast(t('qtyLimit'), 'err'); }
      cart[p.id] = Math.max(1, v); bill();
    });
    $$('#blines [data-r]').forEach((a) => a.onclick = (e) => { e.preventDefault(); delete cart[a.dataset.r]; bill(); });
    $('#bx').onchange = (e) => { extra = Math.max(0, Math.floor(Number(e.target.value)) || 0); bill(); };
    $('#bpay').onchange = (e) => { payment = e.target.value; };
    $('#bclear').onclick = () => { cart = {}; extra = 0; bill(); };
    $('#bsave').onclick = saveBill;
  }
  async function saveBill() {
    const btn = $('#bsave'); btn.disabled = true;
    try {
      const r = await api('/api/admin/bills', 'POST', {
        items: Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty })),
        extraDiscount: extra, payment, name: $('#bn').value, phone: $('#bp').value,
      });
      cart = {}; extra = 0;
      await reload();
      toast(t('billSaved', { id: r.bill.id }));
      printBill(r.bill);
      pos();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
  }

  function printBill(b) {
    const s = D.settings;
    $('#receipt').innerHTML = '<div class="rc">' + (s.logo ? '<div class="rc-logo-wrap"><img class="rc-logo" src="' + esc(s.logo) + '" alt=""></div>' : '') + '<h1>' + esc(shopText(s.shopName, s.shopNameEn)) + '</h1><div class="c">' + esc(shopText(s.address, s.addressEn)) + '<br>📞 ' + esc(s.phone) +
      (s.gstNo ? '<br>GSTIN: ' + esc(s.gstNo) : '') + (s.licenseNo ? '<br>' + t('rcLic') + ': ' + esc(s.licenseNo) : '') + '</div><hr>' +
      '<div class="t"><span>' + esc(b.id) + '</span><span>' + fmtDate(b.createdAt) + '</span></div>' +
      (b.customer && b.customer.name ? '<div>' + t('rcCust') + ': ' + esc(b.customer.name) + ' ' + esc(b.customer.phone || '') + '</div>' : '') + '<hr>' +
      '<table style="width:100%"><tr><th style="text-align:left">' + t('rcItem') + '</th><th>' + t('rcQty') + '</th><th style="text-align:right">' + t('rcAmt') + '</th></tr>' +
      b.lines.map((l) => '<tr><td>' + esc(pName(l)) + '<br><small>' + rupee(l.price) + '</small></td><td style="text-align:center">' + l.qty + '</td><td style="text-align:right">' + rupee(l.amount) + '</td></tr>').join('') + '</table><hr>' +
      '<div class="t"><span>' + t('mrpTotal') + '</span><span>' + rupee(b.mrpTotal) + '</span></div>' +
      (b.extraDiscount ? '<div class="t"><span>' + t('rcExtra') + '</span><span>- ' + rupee(b.extraDiscount) + '</span></div>' : '') +
      '<div class="t g"><span>' + t('total') + '</span><span>' + rupee(b.total) + '</span></div>' +
      '<div class="t"><span>' + t('rcSaved') + '</span><span>' + rupee(b.mrpTotal - b.total) + '</span></div>' +
      '<div class="t"><span>' + t('rcPaid') + '</span><span>' + (b.payment ? payLabel(b.payment) : t('rcPending')) + '</span></div><hr>' +
      '<div class="c">' + t('rcThanks') + '<br>' + t('rcSafe') + '</div></div>';
    const logo = $('#receipt .rc-logo');
    if (logo && !logo.complete) {
      logo.onload = () => window.print();
      logo.onerror = () => window.print();
    } else setTimeout(() => window.print(), 150);
  }

  /* ---------- online orders ---------- */
  let ofilter = 'all';
  function orders() {
    const list = D.orders.filter((o) => ofilter === 'all' || o.status === ofilter);
    view.innerHTML = '<h2 class="title">' + t('ordersTitle') + '</h2>' +
      '<div class="row" style="margin-bottom:12px">' + ['all', ...STATUSES].map((k) => '<button class="btn sm ' + (k === ofilter ? 'pri' : 'gh') + '" data-f="' + k + '">' + (k === 'all' ? t('all') : stLabel(k)) + '</button>').join('') + '</div>' +
      '<div class="tw"><table><tr><th>' + t('colOrder') + '</th><th>' + t('colTime') + '</th><th>' + t('colCustomer') + '</th><th class="n">' + t('colAmount') + '</th><th>' + t('colStatus') + '</th><th></th></tr>' +
      (list.map((o) => '<tr><td><b>' + o.id + '</b></td><td>' + fmtDate(o.createdAt) + '</td><td>' + esc(o.customer.name) + '<br><small>' + esc(o.customer.phone) + '</small></td><td class="n">' + rupee(o.total) + '</td><td>' + pill(o.status) + '</td><td><button class="btn sm" data-o="' + o.id + '">' + t('view') + '</button></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">' + t('noOrders') + '</td></tr>') + '</table></div>';
    $$('[data-f]').forEach((b) => b.onclick = () => { ofilter = b.dataset.f; orders(); });
    $$('[data-o]').forEach((b) => b.onclick = () => orderModal(b.dataset.o));
  }
  function orderModal(id) {
    const o = D.orders.find((x) => x.id === id);
    openModal('<div class="row" style="justify-content:space-between"><h3>' + o.id + ' ' + pill(o.status) + '</h3><button class="btn gh sm" id="mx">✕</button></div>' +
      '<p style="margin:8px 0"><b>' + esc(o.customer.name) + '</b> • <a href="tel:' + esc(o.customer.phone) + '">' + esc(o.customer.phone) + '</a><br>' + esc(o.customer.address) + (o.note ? '<br><i>' + t('notePre') + esc(o.note) + '</i>' : '') + '<br><small>' + fmtDate(o.createdAt) + '</small></p>' +
      '<div class="tw"><table><tr><th>' + t('colProduct') + '</th><th class="n">' + t('colPrice') + '</th><th class="n">' + t('qty') + '</th><th class="n">' + t('colAmount') + '</th></tr>' + o.lines.map((l) => '<tr><td>' + esc(pName(l)) + '</td><td class="n">' + rupee(l.price) + '</td><td class="n">' + l.qty + '</td><td class="n">' + rupee(l.amount) + '</td></tr>').join('') + '</table></div>' +
      '<div class="tot"><span>' + t('total') + '</span><b>' + rupee(o.total) + '</b></div>' +
      '<div class="row">' + STATUSES.map((k) => '<button class="btn sm ' + (k === o.status ? 'pri' : k === 'cancelled' ? 'red' : 'gh') + '" data-s="' + k + '">' + stLabel(k) + '</button>').join('') +
      '<button class="btn sm" id="oprint" style="margin-left:auto">' + t('print') + '</button></div>');
    $('#mx').onclick = closeModal;
    $('#oprint').onclick = () => { closeModal(); printBill({ ...o, payment: 'cash', customer: o.customer, extraDiscount: 0 }); };
    $$('#modalBox [data-s]').forEach((b) => b.onclick = async () => {
      if (b.dataset.s === 'cancelled' && !confirm(t('cancelConfirm'))) return;
      try { await api('/api/admin/orders/' + id, 'PUT', { status: b.dataset.s }); await reload(); closeModal(); orders(); toast(t('statusChanged')); }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  /* ---------- bills history ---------- */
  function bills() {
    view.innerHTML = '<h2 class="title">' + t('billsTitle') + '</h2><div class="tw"><table><tr><th>' + t('colBill') + '</th><th>' + t('colTime') + '</th><th>' + t('colCustomer') + '</th><th>' + t('colMode') + '</th><th class="n">' + t('colAmount') + '</th><th></th></tr>' +
      (D.bills.slice(0, 300).map((b) => '<tr><td><b>' + b.id + '</b></td><td>' + fmtDate(b.createdAt) + '</td><td>' + esc(b.customer.name || '-') + '</td><td>' + payLabel(b.payment) + '</td><td class="n">' + rupee(b.total) + '</td><td><button class="btn sm" data-b="' + b.id + '">' + t('reprint') + '</button></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">' + t('noBills') + '</td></tr>') + '</table></div>';
    $$('[data-b]').forEach((x) => x.onclick = () => printBill(D.bills.find((b) => b.id === x.dataset.b)));
  }

  /* ---------- products ---------- */
  let pf = '';
  function products() {
    const q = pf.trim().toLowerCase();
    const list = D.products.filter((p) => !q || (p.name + ' ' + p.nameEn).toLowerCase().includes(q));
    view.innerHTML = '<h2 class="title">' + t('productsTitle') + ' <button class="btn pri" id="addP" style="margin-left:auto">' + t('addProduct') + '</button></h2>' +
      '<input class="in" id="pfq" placeholder="' + esc(t('searchPh2')) + '" value="' + esc(pf) + '" style="max-width:360px;margin-bottom:12px">' +
      '<div class="tw"><table><tr><th>' + t('colProduct') + '</th><th>' + t('colCat') + '</th><th class="n">MRP</th><th class="n">' + t('colSell') + '</th><th class="n">' + t('colStock') + '</th><th>' + t('colShow') + '</th><th></th></tr>' +
      list.map((p) => '<tr><td><span class="product-thumb">' + (p.image ? '<span hidden>' + esc(p.emoji) + '</span><img src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : esc(p.emoji)) + '</span> <b>' + esc(pName(p)) + '</b><br><small style="color:var(--muted)">' + esc(unitText(p.unit)) + '</small></td><td>' + catName(p.category) + '</td><td class="n">' + rupee(p.mrp) + '</td><td class="n"><b>' + rupee(p.price) + '</b><br><small>' + (p.discount === null ? D.settings.discount : p.discount) + '%</small></td><td class="n ' + (p.stock <= 10 ? 'low' : '') + '">' + p.stock + '</td><td>' + (p.active ? t('shown') : t('hidden')) + '</td><td><button class="btn sm" data-e="' + p.id + '">' + t('edit') + '</button></td></tr>').join('') + '</table></div>';
    $('#addP').onclick = () => prodModal();
    $('#pfq').oninput = (e) => { pf = e.target.value; const pos = e.target.selectionStart; products(); const el = $('#pfq'); el.focus(); el.setSelectionRange(pos, pos); };
    $$('[data-e]').forEach((b) => b.onclick = () => prodModal(D.products.find((p) => p.id === Number(b.dataset.e))));
  }
  function prodModal(p) {
    const n = !p; p = p || { name: '', nameEn: '', category: D.categories[0].id, emoji: '🎆', mrp: '', discount: null, unit: t('defUnit'), stock: 0, popular: false, active: true, image: '' };
    let removePhoto = false;
    let photoPreviewUrl = '';
    const releasePhotoPreview = () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      photoPreviewUrl = '';
    };
    openModal('<h3 style="margin-bottom:12px">' + (n ? t('newProduct') : t('editProduct')) + '</h3><div class="fg">' +
      '<div><label>' + t('fNameTa') + '</label><input class="in" id="f_name" value="' + esc(p.name) + '"></div>' +
      '<div><label>' + t('fNameEn') + '</label><input class="in" id="f_nameEn" value="' + esc(p.nameEn) + '"></div>' +
      '<div><label>' + t('fCat') + '</label><select class="in" id="f_cat">' + D.categories.map((c) => '<option value="' + c.id + '"' + (c.id === p.category ? ' selected' : '') + '>' + c.emoji + ' ' + esc(cName(c)) + '</option>').join('') + '</select></div>' +
      '<div><label>' + t('fEmoji') + '</label><input class="in" id="f_emoji" value="' + esc(p.emoji) + '" maxlength="4"></div>' +
      '<div><label>' + t('fMrp') + '</label><input class="in" id="f_mrp" type="number" min="1" value="' + esc(p.mrp) + '"></div>' +
      '<div><label>' + t('fDisc', { d: D.settings.discount }) + '</label><input class="in" id="f_disc" type="number" min="0" max="95" value="' + (p.discount === null ? '' : p.discount) + '"></div>' +
      '<div><label>' + t('fUnit') + '</label><input class="in" id="f_unit" value="' + esc(p.unit) + '"></div>' +
      '<div><label>' + t('fStock') + '</label><input class="in" id="f_stock" type="number" min="0" value="' + p.stock + '"></div>' +
      '<div class="full"><label for="f_photo">' + t('fPhoto') + '</label><input class="in" id="f_photo" type="file" accept="image/jpeg,image/png,image/webp"><small class="photo-help">' + t('fPhotoHelp') + '</small>' +
      '<div class="photo-preview" id="f_photoPreview">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span' + (p.image ? ' hidden' : '') + '>' + esc(p.emoji) + '</span></div>' +
      (p.image ? '<button class="btn gh sm" id="f_photoRemove" type="button">' + t('fPhotoRemove') + '</button>' : '') + '</div></div>' +
      '<div class="row" style="margin:12px 0"><label><input type="checkbox" id="f_pop"' + (p.popular ? ' checked' : '') + '> ' + t('fPopular') + '</label><label><input type="checkbox" id="f_act"' + (p.active ? ' checked' : '') + '> ' + t('fActive') + '</label></div>' +
      '<div class="row"><button class="btn pri" id="f_save">' + t('save') + '</button><button class="btn gh" id="f_cancel">' + t('cancel') + '</button>' + (n ? '' : '<button class="btn red" id="f_del" style="margin-left:auto">' + t('del') + '</button>') + '</div>');
    $('#f_cancel').onclick = () => { releasePhotoPreview(); closeModal(); };
    $('#f_photo').onchange = () => {
      const file = $('#f_photo').files[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 700 * 1024) {
        $('#f_photo').value = '';
        releasePhotoPreview();
        $('#f_photoPreview').innerHTML = (!removePhoto && p.image ? '<img src="' + esc(p.image) + '" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span' + (!removePhoto && p.image ? ' hidden' : '') + '>' + esc(p.emoji) + '</span>';
        toast(t('fPhotoInvalid'), 'err');
        return;
      }
      removePhoto = false;
      releasePhotoPreview();
      photoPreviewUrl = URL.createObjectURL(file);
      const preview = $('#f_photoPreview');
      preview.innerHTML = '<img src="' + photoPreviewUrl + '" alt="">';
      if ($('#f_photoRemove')) $('#f_photoRemove').hidden = true;
    };
    if ($('#f_photoRemove')) $('#f_photoRemove').onclick = () => {
      removePhoto = true;
      releasePhotoPreview();
      $('#f_photo').value = '';
      $('#f_photoPreview').innerHTML = '<span>' + esc(p.emoji) + '</span>';
      $('#f_photoRemove').hidden = true;
    };
    $('#f_save').onclick = async () => {
      const saveButton = $('#f_save');
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      const body = { name: $('#f_name').value, nameEn: $('#f_nameEn').value, category: $('#f_cat').value, emoji: $('#f_emoji').value, mrp: $('#f_mrp').value, discount: $('#f_disc').value === '' ? null : $('#f_disc').value, unit: $('#f_unit').value, stock: $('#f_stock').value, popular: $('#f_pop').checked, active: $('#f_act').checked };
      if (removePhoto) body.removeImage = true;
      const file = $('#f_photo').files[0];
      try {
        if (file) body.imageDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error(t('fPhotoReadError')));
          reader.readAsDataURL(file);
        });
        await api(n ? '/api/admin/products' : '/api/admin/products/' + p.id, n ? 'POST' : 'PUT', body);
        releasePhotoPreview(); closeModal(); await reload(); products(); toast(t('saved'));
      }
      catch (e) { saveButton.disabled = false; toast(e.message, 'err'); }
    };
    if (!n) $('#f_del').onclick = async () => {
      if (!confirm(t('delConfirm', { n: pName(p) }))) return;
      try { await api('/api/admin/products/' + p.id, 'DELETE'); releasePhotoPreview(); closeModal(); await reload(); products(); toast(t('deleted')); } catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ---------- settings ---------- */
  function settings() {
    const s = D.settings;
    let removeLogo = false;
    let logoPreviewUrl = '';
    const releaseLogoPreview = () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      logoPreviewUrl = '';
    };
    const f = (id, label, v, type = 'text') => '<div><label>' + label + '</label><input class="in" id="' + id + '" type="' + type + '" value="' + esc(v) + '"></div>';
    view.innerHTML = '<h2 class="title">' + t('setTitle') + '</h2>' +
      '<div class="panel"><h3>' + t('shopDetails') + '</h3><div class="fg">' +
      '<div class="full logo-setting"><label for="s_logoFile">' + t('sLogo') + '</label><input class="in" id="s_logoFile" type="file" accept="image/jpeg,image/png,image/webp"><small class="photo-help">' + t('sLogoHelp') + '</small>' +
      '<div class="logo-preview" id="s_logoPreview">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span' + (s.logo ? ' hidden' : '') + '>🎆</span></div>' +
      (s.logo ? '<button class="btn gh sm" id="s_logoRemove" type="button">' + t('sLogoRemove') + '</button>' : '') + '</div>' +
      f('s_name', t('sNameTa'), s.shopName) + f('s_nameEn', t('sNameEn'), s.shopNameEn) + f('s_tag', t('sTagTa'), s.tagline) + f('s_tagEn', t('sTagEn'), s.taglineEn) +
      f('s_fest', t('sFestTa'), s.festivalTitle) + f('s_festEn', t('sFestEn'), s.festivalTitleEn) +
      '<div class="full settings-hint">' + t('sFestivalHint') + '</div>' +
      f('s_phone', t('sPhone'), s.phone) + f('s_wa', t('sWa'), s.whatsapp) +
      f('s_addr', t('sAddrTa'), s.address) + f('s_addrEn', t('sAddrEn'), s.addressEn) + f('s_deliveryArea', t('sDeliveryArea'), s.deliveryArea || '') +
      '<div class="full"><label for="s_deliveryInfo">' + t('sDeliveryInfo') + '</label><textarea class="in" id="s_deliveryInfo" rows="3">' + esc(s.deliveryInfo || '') + '</textarea></div>' +
      '<div class="full"><label for="s_checkoutNote">' + t('sCheckoutNoteTa') + '</label><textarea class="in" id="s_checkoutNote" rows="2">' + esc(s.checkoutNote || '') + '</textarea></div>' +
      '<div class="full"><label for="s_checkoutNoteEn">' + t('sCheckoutNoteEn') + '</label><textarea class="in" id="s_checkoutNoteEn" rows="2">' + esc(s.checkoutNoteEn || '') + '</textarea></div>' +
      f('s_lic', t('sLic'), s.licenseNo) + f('s_gst', t('sGst'), s.gstNo) +
      f('s_disc', t('sDisc'), s.discount, 'number') + f('s_min', t('sMin'), s.minOrder, 'number') +
      '</div><div style="margin-top:14px"><button class="btn pri" id="s_save">' + t('save') + '</button></div></div>' +
      '<div class="panel"><h3>' + t('pwTitle') + '</h3><div class="fg">' + f('p_cur', t('pwCur'), '', 'password') + f('p_new', t('pwNew'), '', 'password') + '</div><div style="margin-top:14px"><button class="btn" id="p_save">' + t('pwBtn') + '</button></div></div>' +
      '<div class="panel"><h3>' + t('bkTitle') + '</h3><p style="color:var(--muted);margin-bottom:10px">' + t('bkText') + '</p><a class="btn" href="/api/admin/backup" download>' + t('bkBtn') + '</a></div>';
    $('#s_save').onclick = async () => {
      const button = $('#s_save');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const body = { shopName: $('#s_name').value, shopNameEn: $('#s_nameEn').value, tagline: $('#s_tag').value, taglineEn: $('#s_tagEn').value, festivalTitle: $('#s_fest').value, festivalTitleEn: $('#s_festEn').value, phone: $('#s_phone').value, whatsapp: $('#s_wa').value, address: $('#s_addr').value, addressEn: $('#s_addrEn').value, deliveryArea: $('#s_deliveryArea').value, deliveryInfo: $('#s_deliveryInfo').value, checkoutNote: $('#s_checkoutNote').value, checkoutNoteEn: $('#s_checkoutNoteEn').value, licenseNo: $('#s_lic').value, gstNo: $('#s_gst').value, discount: $('#s_disc').value, minOrder: $('#s_min').value };
        if (removeLogo) body.removeLogo = true;
        const file = $('#s_logoFile').files[0];
        if (file) body.logoDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error(t('sLogoReadError')));
          reader.readAsDataURL(file);
        });
        await api('/api/admin/settings', 'PUT', body);
        releaseLogoPreview(); await reload(); applyShopName(); toast(t('saved')); settings();
      } catch (e) { button.disabled = false; toast(e.message, 'err'); }
    };
    $('#s_logoFile').onchange = () => {
      const file = $('#s_logoFile').files[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 700 * 1024) {
        $('#s_logoFile').value = '';
        releaseLogoPreview();
        $('#s_logoPreview').innerHTML = (!removeLogo && s.logo ? '<img src="' + esc(s.logo) + '" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span' + (!removeLogo && s.logo ? ' hidden' : '') + '>🎆</span>';
        toast(t('sLogoInvalid'), 'err');
        return;
      }
      removeLogo = false;
      releaseLogoPreview();
      logoPreviewUrl = URL.createObjectURL(file);
      $('#s_logoPreview').innerHTML = '<img src="' + logoPreviewUrl + '" alt="">';
      if ($('#s_logoRemove')) $('#s_logoRemove').hidden = true;
    };
    if ($('#s_logoRemove')) $('#s_logoRemove').onclick = () => {
      removeLogo = true;
      releaseLogoPreview();
      $('#s_logoFile').value = '';
      $('#s_logoPreview').innerHTML = '<span>🎆</span>';
      $('#s_logoRemove').hidden = true;
    };
    $('#p_save').onclick = async () => {
      try { await api('/api/admin/password', 'POST', { current: $('#p_cur').value, next: $('#p_new').value }); await reload(); toast(t('pwDone')); settings(); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  // new-order polling
  setInterval(async () => {
    if ($('#app').hidden) return;
    try {
      const fresh = await api('/api/admin/data');
      pollErrorShown = false;
      const had = D.orders.length; D = fresh; updateBadge();
      if (fresh.orders.length > had) { toast(t('newOrderToast')); if (tab === 'orders' || tab === 'dash') render(); }
    } catch (e) {
      if (e.status === 401) { showLogin(t('sessionExpired')); return; }
      if (!pollErrorShown) { toast(e.message, 'err'); pollErrorShown = true; }
    }
  }, 20000);

  boot();
})();
