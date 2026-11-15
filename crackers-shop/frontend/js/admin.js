(function () {
  let D = null; // all data
  let dataUpdatedAt = null;
  let tab = 'dash';
  const view = $('#view');
  let pollErrorShown = false;
  let passwordResetToken = '';
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
    passwordResetToken = new URLSearchParams(location.hash.slice(1)).get('reset') || '';
    if (passwordResetToken) {
      history.replaceState(null, '', location.pathname + location.search);
      $('#loginForm').hidden = true;
      $('#forgotPasswordForm').hidden = true;
      $('#resetPasswordForm').hidden = false;
      $('#resetPassword').focus();
    } else {
      $('#loginForm').hidden = false;
      $('#forgotPasswordForm').hidden = true;
      $('#resetPasswordForm').hidden = true;
      $('#pw').focus();
    }
    if (!fwStarted) { Fireworks.start($('#sky'), { intensity: 1.2 }); fwStarted = true; }
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try { await api('/api/login', 'POST', { password: $('#pw').value }); $('#pw').value = ''; await boot(); }
    catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#forgotPasswordLink').onclick = () => {
    $('#loginForm').hidden = true;
    $('#resetPasswordForm').hidden = true;
    $('#forgotPasswordForm').hidden = false;
    $('#forgotPasswordError').textContent = '';
    $('#forgotPasswordMessage').hidden = true;
    $('#forgotEmail').focus();
  };
  $('#backToLogin').onclick = () => showLogin();
  $('#resetBackToLogin').onclick = () => {
    passwordResetToken = '';
    showLogin();
  };
  $('#forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('#forgotPasswordForm button[type="submit"]');
    button.disabled = true;
    $('#forgotPasswordError').textContent = '';
    $('#forgotPasswordMessage').hidden = true;
    try {
      await api('/api/admin/password-reset/request', 'POST', { email: $('#forgotEmail').value });
      $('#forgotPasswordMessage').textContent = t('forgotSent');
      $('#forgotPasswordMessage').hidden = false;
    } catch (error) {
      $('#forgotPasswordError').textContent = error.message;
    } finally { button.disabled = false; }
  });
  $('#resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('#resetPasswordForm button[type="submit"]');
    const next = $('#resetPassword').value;
    $('#resetPasswordError').textContent = '';
    if (next !== $('#resetPasswordConfirm').value) {
      $('#resetPasswordError').textContent = t('resetMismatch');
      return;
    }
    button.disabled = true;
    try {
      await api('/api/admin/password-reset/complete', 'POST', { token: passwordResetToken, next });
      passwordResetToken = '';
      $('#resetPassword').value = '';
      $('#resetPasswordConfirm').value = '';
      showLogin();
      toast(t('resetDone'));
    } catch (error) {
      $('#resetPasswordError').textContent = error.message;
    } finally { button.disabled = false; }
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
    try { D = await api('/api/admin/data'); dataUpdatedAt = new Date(); }
    catch (e) { if (e.status === 401) return showLogin($('#app').hidden ? '' : t('sessionExpired')); toast(e.message, 'err'); return; }
    $('#login').hidden = true; $('#app').hidden = false;
    applyShopName(); updateBadge(); render();
  }
  async function reload() { D = await api('/api/admin/data'); dataUpdatedAt = new Date(); updateBadge(); }
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
    const low = D.products.filter((p) => p.active && p.stock <= (p.lowStockThreshold ?? 10));
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

    const sold = new Map();
    const addLines = (lines) => lines.forEach((line) => {
      const key = line.id === undefined ? line.name : line.id;
      const item = sold.get(key) || { q: 0, l: line };
      item.q += line.qty;
      sold.set(key, item);
    });
    D.bills.forEach((b) => addLines(b.lines));
    D.orders.filter((o) => o.status !== 'cancelled').forEach((o) => addLines(o.lines));
    const top = [...sold.values()].sort((a, b) => b.q - a.q).slice(0, 6);
    const updatedAt = dataUpdatedAt
      ? dataUpdatedAt.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
      : '—';

    view.innerHTML =
      '<div class="dashboard-head"><div><h2 class="title">' + t('dashTitle') + '</h2><p class="dashboard-sub">' + t('dashboardSub') + '</p></div>' +
      '<div class="dashboard-tools"><span class="dashboard-updated"><i></i>' + t('updatedAt', { time: esc(updatedAt) }) + '</span><button class="btn gh" id="refreshDashboard"><span aria-hidden="true">↻</span> ' + t('refresh') + '</button></div></div>' +
      (D.settings.defaultPassword ? '<div class="warn">' + t('defPwWarn') + '</div>' : '') +
      '<div class="dashboard-metrics">' +
      '<div class="stat dash-stat"><div class="dash-stat-heading"><small>' + t('cToday') + '</small><span class="dash-icon" aria-hidden="true">₹</span></div><b>' + rupee(counterToday) + '</b><small>' + t('nBills', { n: billsToday.length }) + '</small></div>' +
      '<div class="stat dash-stat"><div class="dash-stat-heading"><small>' + t('oToday') + '</small><span class="dash-icon" aria-hidden="true">↗</span></div><b>' + rupee(onlineToday) + '</b><small>' + t('nOrders', { n: ordersToday.length }) + '</small></div>' +
      '<div class="stat dash-stat"><div class="dash-stat-heading"><small>' + t('newOrdersCard') + '</small><span class="dash-icon" aria-hidden="true">⌑</span></div><b>' + newOrders + '</b><button class="dash-link" id="viewNewOrders">' + t('viewOrders') + ' →</button></div>' +
      '<div class="stat dash-stat"><div class="dash-stat-heading"><small>' + t('totalSales') + '</small><span class="dash-icon" aria-hidden="true">Σ</span></div><b>' + rupee(all) + '</b><small>' + t('recordedValueHint') + '</small></div>' +
      '<div class="stat dash-stat"><div class="dash-stat-heading"><small>' + t('lowCard') + '</small><span class="dash-icon alert" aria-hidden="true">!</span></div><b>' + low.length + '</b><small>' + t('dashboardLowHint') + '</small></div></div>' +
      '<div class="dashboard-grid"><section class="panel dashboard-panel dashboard-chart"><div class="dashboard-section-head"><div><h3>' + t('last7') + '</h3><p>' + t('salesChartHint') + '</p></div></div><div class="bars" role="list" aria-label="' + esc(t('last7')) + '">' +
      days.map((d) => {
        const height = d.v ? Math.max(6, Math.round((d.v / max) * 132)) : 3;
        const label = t('dashboardDaySummary', { day: d.label, amount: rupee(d.v) });
        return '<div class="dash-bar" role="listitem" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span>' + (d.v ? rupee(d.v) : '') + '</span><i style="height:' + height + 'px"></i><small>' + esc(d.label) + '</small></div>';
      }).join('') + '</div></section>' +
      '<section class="panel dashboard-panel"><div class="dashboard-section-head"><div><h3>' + t('topSold') + '</h3><p>' + t('topSoldHint') + '</p></div></div>' +
      (top.length ? '<div class="tw dashboard-table"><table><thead><tr><th>#</th><th>' + t('colProduct') + '</th><th class="n">' + t('qty') + '</th></tr></thead><tbody>' +
        top.map((item, index) => '<tr><td><span class="rank-badge">' + (index + 1) + '</span></td><td><b>' + esc(pName(item.l)) + '</b></td><td class="n"><strong>' + esc(item.q.toLocaleString(locale())) + '</strong></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="dashboard-empty">' + t('noSales') + '</p>') + '</section></div>' +
      '<section class="panel dashboard-panel dashboard-inventory"><div class="dashboard-section-head"><div><h3>' + t('lowTitle') + '</h3><p>' + t('dashboardLowHint') + '</p></div><button class="btn gh sm" id="manageInventory">' + t('manageInventory') + ' →</button></div>' +
      (low.length ? '<div class="tw dashboard-table"><table><thead><tr><th>' + t('colProduct') + '</th><th>' + t('stockThreshold') + '</th><th class="n">' + t('colStock') + '</th></tr></thead><tbody>' +
        low.slice(0, 8).map((p) => '<tr><td><span class="dashboard-product">' + esc(p.emoji) + '</span><b>' + esc(pName(p)) + '</b></td><td>' + esc(p.lowStockThreshold ?? 10) + '</td><td class="n"><span class="stock-state ' + (p.stock <= 0 ? 'out' : 'low') + '">' + t(p.stock <= 0 ? 'stockState_out' : 'stockState_low') + '</span> <b>' + esc(p.stock) + '</b></td></tr>').join('') +
        '</tbody></table></div>' + (low.length > 8 ? '<p class="dashboard-more">' + t('dashboardMoreLow', { n: low.length - 8 }) + '</p>' : '') :
        '<p class="dashboard-empty">' + t('stockOk') + '</p>') + '</section>';
    const navigateTo = (next) => {
      tab = next;
      $$('nav.side .tab').forEach((button) => button.classList.toggle('on', button.dataset.t === next));
      render();
    };
    $('#refreshDashboard').onclick = async () => {
      const button = $('#refreshDashboard');
      button.disabled = true;
      try { await reload(); render(); toast(t('dashboardRefreshed')); }
      catch (error) { toast(error.message, 'err'); }
      finally { if ($('#refreshDashboard')) $('#refreshDashboard').disabled = false; }
    };
    $('#viewNewOrders').onclick = () => navigateTo('orders');
    $('#manageInventory').onclick = () => navigateTo('products');
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
  let orderSearch = '', orderStart = '', orderEnd = '', orderPageSize = 100;
  let billSearch = '', billStart = '', billEnd = '', billPayment = 'all', billPageSize = 100;
  const recordDay = (iso) => {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  };
  const matchesDays = (record, start, end) => {
    const day = recordDay(record.createdAt);
    return !!day && (!start || day >= start) && (!end || day <= end);
  };
  function printOrderHistory(orders) {
    if (orderStart && orderEnd && orderStart > orderEnd) {
      toast(t('exportInvalidDates'), 'err');
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) { toast(t('exportPopupBlocked'), 'err'); return; }
    popup.opener = null;
    const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const rows = orders.map((order) => {
      const items = (order.lines || []).map((line) =>
        esc(pName(line)) + ' × ' + Number(line.qty || 0)).join('<br>');
      return '<tr><td>' + esc(order.id) + '</td><td>' + esc(new Date(order.createdAt).toLocaleString(locale())) +
        '</td><td>' + esc(order.customer?.name || '-') + '</td><td>' + esc(order.customer?.phone || '-') +
        '</td><td>' + esc(stLabel(order.status)) + '</td><td>' + (items || '-') +
        '</td><td class="amount">' + rupee(order.total) + '</td></tr>';
    }).join('');
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(t('ordersTitle')) + '</title><style>' +
      'body{font:12px Arial,"Nirmala UI",Latha,sans-serif;color:#222;margin:24px}h1{font-size:20px}' +
      'table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}' +
      'th{background:#eee}.amount{text-align:right;white-space:nowrap}' +
      '@media print{body{margin:12mm}tr{break-inside:avoid}thead{display:table-header-group}}' +
      '</style></head><body><h1>' + esc(t('ordersTitle')) + ' — ' + esc(shopText(D.settings.shopName, D.settings.shopNameEn)) +
      '</h1><p>' + esc((orderStart || t('all')) + ' – ' + (orderEnd || t('all'))) + '</p><p>' +
      esc(t('recordsShown', { shown: orders.length, total: orders.length })) + ' · ' + esc(t('total')) +
      ': ' + rupee(total) + '</p><table><thead><tr><th>' + esc(t('colOrder')) + '</th><th>' +
      esc(t('colTime')) + '</th><th>' + esc(t('colCustomer')) + '</th><th>' + esc(t('mobile')) +
      '</th><th>' + esc(t('colStatus')) + '</th><th>' + esc(t('colProduct')) + '</th><th>' +
      esc(t('colAmount')) + '</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">' + esc(t('noOrders')) + '</td></tr>') +
      '</tbody></table><script>window.onload=function(){window.focus();window.print()}</script></body></html>';
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
  function downloadOrderHistory(orders) {
    if (orderStart && orderEnd && orderStart > orderEnd) {
      toast(t('exportInvalidDates'), 'err');
      return;
    }
    const cell = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      let text = String(value ?? '');
      if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      ['Order ID', 'Date', 'Status', 'Customer', 'Phone', 'Address', 'Note', 'Item', 'Quantity', 'Unit price', 'Line amount', 'Order total'],
      ...orders.flatMap((order) => (order.lines?.length ? order.lines : [null]).map((line) => [
        order.id, order.createdAt, order.status, order.customer?.name, order.customer?.phone,
        order.customer?.address, order.note, line ? pName(line) : '', line ? Number(line.qty || 0) : '',
        line ? Number(line.price || 0) : '', line ? Number(line.amount || 0) : '', Number(order.total || 0),
      ])),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    const filename = 'orders-' + (orderStart || 'all') + '-to-' + (orderEnd || 'all') + '.csv';
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bindFilter(id, setValue, rerender) {
    const input = $('#' + id);
    input.addEventListener(input.type === 'text' ? 'input' : 'change', (event) => {
      setValue(event.target.value);
      const position = input.type === 'text' ? input.selectionStart : null;
      rerender();
      if (position !== null) {
        const replacement = $('#' + id);
        replacement.focus();
        replacement.setSelectionRange(position, position);
      }
    });
  }
  function orders() {
    const q = orderSearch.trim().toLocaleLowerCase();
    const filtered = D.orders.filter((order) =>
      (ofilter === 'all' || order.status === ofilter) &&
      matchesDays(order, orderStart, orderEnd) &&
      (!q || [order.id, order.customer?.name, order.customer?.phone, order.customer?.address]
        .join(' ').toLocaleLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const list = filtered.slice(0, orderPageSize);
    view.innerHTML = '<h2 class="title">' + t('ordersTitle') + '</h2>' +
      '<div class="row" style="margin-bottom:12px">' + ['all', ...STATUSES].map((k) => '<button class="btn sm ' + (k === ofilter ? 'pri' : 'gh') + '" data-f="' + k + '">' + (k === 'all' ? t('all') : stLabel(k)) + '</button>').join('') + '</div>' +
      '<div class="fg" style="margin-bottom:12px">' +
      '<div><label for="orderSearch">' + t('recordSearch') + '</label><input class="in" id="orderSearch" type="text" value="' + esc(orderSearch) + '" placeholder="' + esc(t('orderSearchPh')) + '"></div>' +
      '<div><label for="orderStart">' + t('filterStartDate') + '</label><input class="in" id="orderStart" type="date" value="' + esc(orderStart) + '"></div>' +
      '<div><label for="orderEnd">' + t('filterEndDate') + '</label><input class="in" id="orderEnd" type="date" value="' + esc(orderEnd) + '"></div>' +
      '<div class="row" style="align-self:end"><button class="btn sm gh" id="printOrderHistory">' + t('downloadPdf') + '</button>' +
      '<button class="btn sm gh" id="downloadOrderHistory">' + t('downloadCsv') + '</button></div></div>' +
      '<p style="color:var(--muted);margin:0 0 8px">' + t('recordsShown', { shown: list.length, total: filtered.length }) + '</p>' +
      '<div class="tw"><table><tr><th>' + t('colOrder') + '</th><th>' + t('colTime') + '</th><th>' + t('colCustomer') + '</th><th class="n">' + t('colAmount') + '</th><th>' + t('colStatus') + '</th><th></th></tr>' +
      (list.map((o) => '<tr><td><b>' + esc(o.id) + '</b></td><td>' + fmtDate(o.createdAt) + '</td><td>' + esc(o.customer?.name || '-') + '<br><small>' + esc(o.customer?.phone || '') + '</small></td><td class="n">' + rupee(o.total) + '</td><td>' + pill(o.status) + '</td><td><button class="btn sm" data-o="' + esc(o.id) + '">' + t('view') + '</button></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">' + t('noOrders') + '</td></tr>') + '</table></div>' +
      (filtered.length > list.length ? '<div style="text-align:center;margin-top:12px"><button class="btn gh" id="moreOrders">' + t('showMore') + '</button></div>' : '');
    bindFilter('orderSearch', (value) => { orderSearch = value; orderPageSize = 100; }, orders);
    bindFilter('orderStart', (value) => { orderStart = value; orderPageSize = 100; }, orders);
    bindFilter('orderEnd', (value) => { orderEnd = value; orderPageSize = 100; }, orders);
    $('#printOrderHistory').onclick = () => printOrderHistory(filtered);
    $('#downloadOrderHistory').onclick = () => downloadOrderHistory(filtered);
    $$('[data-f]').forEach((b) => b.onclick = () => { ofilter = b.dataset.f; orderPageSize = 100; orders(); });
    $$('[data-o]').forEach((b) => b.onclick = () => orderModal(b.dataset.o));
    if ($('#moreOrders')) $('#moreOrders').onclick = () => { orderPageSize += 100; orders(); };
  }
  function showOrdersUpdateNotice() {
    if ($('#orderUpdateNotice')) return;
    const notice = document.createElement('div');
    notice.className = 'order-update-notice';
    notice.id = 'orderUpdateNotice';
    notice.setAttribute('role', 'status');
    const message = document.createElement('span');
    message.textContent = t('newOrderToast');
    const refresh = document.createElement('button');
    refresh.className = 'btn sm gh';
    refresh.type = 'button';
    refresh.textContent = t('refresh');
    refresh.addEventListener('click', orders);
    notice.append(message, refresh);
    view.prepend(notice);
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
    $('#oprint').onclick = () => { closeModal(); printBill({ ...o, customer: o.customer, extraDiscount: 0 }); };
    $$('#modalBox [data-s]').forEach((b) => b.onclick = async () => {
      if (b.dataset.s === 'cancelled' && !confirm(t('cancelConfirm'))) return;
      try { await api('/api/admin/orders/' + id, 'PUT', { status: b.dataset.s }); await reload(); closeModal(); orders(); toast(t('statusChanged')); }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  /* ---------- bills history ---------- */
  function bills() {
    const q = billSearch.trim().toLocaleLowerCase();
    const filtered = D.bills.filter((bill) =>
      matchesDays(bill, billStart, billEnd) &&
      (billPayment === 'all' || bill.payment === billPayment) &&
      (!q || [bill.id, bill.customer?.name, bill.customer?.phone, bill.payment]
        .join(' ').toLocaleLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const list = filtered.slice(0, billPageSize);
    view.innerHTML = '<h2 class="title">' + t('billsTitle') + '</h2>' +
      '<div class="fg" style="margin-bottom:12px">' +
      '<div><label for="billSearch">' + t('recordSearch') + '</label><input class="in" id="billSearch" type="text" value="' + esc(billSearch) + '" placeholder="' + esc(t('billSearchPh')) + '"></div>' +
      '<div><label for="billStart">' + t('filterStartDate') + '</label><input class="in" id="billStart" type="date" value="' + esc(billStart) + '"></div>' +
      '<div><label for="billEnd">' + t('filterEndDate') + '</label><input class="in" id="billEnd" type="date" value="' + esc(billEnd) + '"></div>' +
      '<div><label for="billPayment">' + t('filterPayment') + '</label><select class="in" id="billPayment"><option value="all">' + t('all') + '</option>' + PAYS.map((payment) => '<option value="' + payment + '"' + (payment === billPayment ? ' selected' : '') + '>' + payLabel(payment) + '</option>').join('') + '</select></div></div>' +
      '<p style="color:var(--muted);margin:0 0 8px">' + t('recordsShown', { shown: list.length, total: filtered.length }) + '</p>' +
      '<div class="tw"><table><tr><th>' + t('colBill') + '</th><th>' + t('colTime') + '</th><th>' + t('colCustomer') + '</th><th>' + t('colMode') + '</th><th class="n">' + t('colAmount') + '</th><th></th></tr>' +
      (list.map((b) => '<tr><td><b>' + esc(b.id) + '</b></td><td>' + fmtDate(b.createdAt) + '</td><td>' + esc(b.customer?.name || '-') + '</td><td>' + payLabel(b.payment) + '</td><td class="n">' + rupee(b.total) + '</td><td><button class="btn sm" data-b="' + esc(b.id) + '">' + t('reprint') + '</button></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">' + t('noBills') + '</td></tr>') + '</table></div>' +
      (filtered.length > list.length ? '<div style="text-align:center;margin-top:12px"><button class="btn gh" id="moreBills">' + t('showMore') + '</button></div>' : '');
    bindFilter('billSearch', (value) => { billSearch = value; billPageSize = 100; }, bills);
    bindFilter('billStart', (value) => { billStart = value; billPageSize = 100; }, bills);
    bindFilter('billEnd', (value) => { billEnd = value; billPageSize = 100; }, bills);
    bindFilter('billPayment', (value) => { billPayment = value; billPageSize = 100; }, bills);
    $$('[data-b]').forEach((x) => x.onclick = () => printBill(D.bills.find((b) => b.id === x.dataset.b)));
    if ($('#moreBills')) $('#moreBills').onclick = () => { billPageSize += 100; bills(); };
  }

  /* ---------- products ---------- */
  let pf = '', productCategory = 'all', productStock = 'all', productSort = 'name';
  const stockState = (p) => p.stock <= 0 ? 'out' : p.stock <= (p.lowStockThreshold ?? 10) ? 'low' : 'ok';
  const movementReason = (m) => {
    const key = m.kind === 'manual' ? 'stockReason_' + m.reason : 'stockKind_' + m.kind;
    return t(key) === key ? m.kind : t(key);
  };
  const movementRows = (items, includeProduct = true) => items.map((m) =>
    '<tr><td>' + fmtDate(m.createdAt) + '</td>' +
    (includeProduct ? '<td>' + esc(m.productName) + (m.reference ? '<br><small>' + esc(m.reference) + '</small>' : '') + '</td>' : '') +
    '<td>' + esc(movementReason(m)) + (m.note ? '<br><small>' + esc(m.note) + '</small>' : '') + '</td>' +
    '<td class="n ' + (m.change > 0 ? 'stock-positive' : 'stock-negative') + '">' + (m.change > 0 ? '+' : '') + m.change + '</td>' +
    '<td class="n">' + m.stockBefore + ' → ' + m.stockAfter + '</td></tr>').join('');
  function products() {
    const q = pf.trim().toLowerCase();
    const list = D.products.filter((p) => {
      const state = stockState(p);
      return (!q || (p.name + ' ' + p.nameEn).toLowerCase().includes(q)) &&
        (productCategory === 'all' || p.category === productCategory) &&
        (productStock === 'all' || (productStock === 'in' ? p.stock > 0 : state === productStock));
    }).sort((a, b) => productSort === 'stock_asc' ? a.stock - b.stock || a.name.localeCompare(b.name) :
      productSort === 'stock_desc' ? b.stock - a.stock || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    const lowCount = D.products.filter((p) => stockState(p) === 'low').length;
    const outCount = D.products.filter((p) => stockState(p) === 'out').length;
    const totalUnits = D.products.reduce((total, p) => total + p.stock, 0);
    const rows = list.map((p) => {
      const state = stockState(p);
      return '<tr><td><span class="product-thumb">' + (p.image ? '<span hidden>' + esc(p.emoji) + '</span><img src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : esc(p.emoji)) + '</span> <b>' + esc(pName(p)) + '</b><br><small style="color:var(--muted)">' + esc(unitText(p.unit)) + '</small></td>' +
        '<td>' + catName(p.category) + '</td><td class="n">' + rupee(p.mrp) + '</td><td class="n"><b>' + rupee(p.price) + '</b><br><small>' + (p.discount === null ? D.settings.discount : p.discount) + '%</small></td>' +
        '<td class="n ' + (state === 'low' || state === 'out' ? 'low' : '') + '"><b>' + p.stock + '</b><br><small>' + t('stockThreshold') + ': ' + (p.lowStockThreshold ?? 10) + '</small></td>' +
        '<td><span class="stock-state ' + state + '">' + t('stockState_' + state) + '</span><br><small>' + (p.active ? t('shown') : t('hidden')) + '</small></td>' +
        '<td><div class="row"><button class="btn sm pri" data-adjust="' + p.id + '">' + t('adjustStock') + '</button><button class="btn sm gh" data-history="' + p.id + '">' + t('stockHistory') + '</button><button class="btn sm" data-e="' + p.id + '">' + t('edit') + '</button></div></td></tr>';
    }).join('');
    const recent = (D.stockMovements || []).slice(0, 20);
    view.innerHTML = '<h2 class="title">' + t('productsTitle') + ' <button class="btn pri" id="addP" style="margin-left:auto">' + t('addProduct') + '</button></h2>' +
      '<div class="cards"><div class="stat"><small>' + t('inventoryProducts') + '</small><b>' + D.products.length + '</b></div><div class="stat b"><small>' + t('inventoryUnits') + '</small><b>' + totalUnits.toLocaleString(locale()) + '</b></div>' +
      '<div class="stat o"><small>' + t('inventoryLow') + '</small><b>' + lowCount + '</b></div><div class="stat r"><small>' + t('inventoryOut') + '</small><b>' + outCount + '</b></div></div>' +
      '<div class="fg" style="margin-bottom:12px"><div><label for="pfq">' + t('inventorySearch') + '</label><input class="in" id="pfq" placeholder="' + esc(t('searchPh2')) + '" value="' + esc(pf) + '"></div>' +
      '<div><label for="productCategory">' + t('inventoryCategory') + '</label><select class="in" id="productCategory"><option value="all">' + t('allCats') + '</option>' + D.categories.map((c) => '<option value="' + esc(c.id) + '"' + (productCategory === c.id ? ' selected' : '') + '>' + esc(c.emoji + ' ' + cName(c)) + '</option>').join('') + '</select></div>' +
      '<div><label for="productStock">' + t('inventoryStockFilter') + '</label><select class="in" id="productStock">' +
      [['all', 'stockAll'], ['in', 'stockIn'], ['low', 'stockLow'], ['out', 'stockOut']].map(([value, label]) => '<option value="' + value + '"' + (productStock === value ? ' selected' : '') + '>' + t(label) + '</option>').join('') + '</select></div>' +
      '<div><label for="productSort">' + t('inventorySort') + '</label><select class="in" id="productSort">' +
      [['name', 'sortName'], ['stock_asc', 'sortStockAsc'], ['stock_desc', 'sortStockDesc']].map(([value, label]) => '<option value="' + value + '"' + (productSort === value ? ' selected' : '') + '>' + t(label) + '</option>').join('') + '</select></div></div>' +
      '<p style="color:var(--muted);margin:0 0 8px">' + t('inventoryMatches', { shown: list.length, total: D.products.length }) + '</p>' +
      '<div class="tw"><table><tr><th>' + t('colProduct') + '</th><th>' + t('colCat') + '</th><th class="n">MRP</th><th class="n">' + t('colSell') + '</th><th class="n">' + t('colStock') + '</th><th>' + t('colShow') + '</th><th>' + t('actions') + '</th></tr>' +
      (rows || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">' + t('inventoryNoProducts') + '</td></tr>') + '</table></div>' +
      '<div class="panel" style="margin-top:18px"><h3>' + t('recentMovements') + '</h3>' +
      (recent.length ? '<div class="tw"><table><tr><th>' + t('colTime') + '</th><th>' + t('colProduct') + '</th><th>' + t('stockReason') + '</th><th class="n">' + t('stockChange') + '</th><th class="n">' + t('stockBalance') + '</th></tr>' + movementRows(recent) + '</table></div>' :
        '<p style="color:var(--muted)">' + t('stockNoMovements') + '</p>') + '</div>';
    $('#addP').onclick = () => prodModal();
    $('#pfq').oninput = (e) => { pf = e.target.value; const pos = e.target.selectionStart; products(); const el = $('#pfq'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#productCategory').onchange = (e) => { productCategory = e.target.value; products(); };
    $('#productStock').onchange = (e) => { productStock = e.target.value; products(); };
    $('#productSort').onchange = (e) => { productSort = e.target.value; products(); };
    $$('[data-e]').forEach((b) => b.onclick = () => prodModal(D.products.find((p) => p.id === Number(b.dataset.e))));
    $$('[data-adjust]').forEach((b) => b.onclick = () => stockModal(D.products.find((p) => p.id === Number(b.dataset.adjust))));
    $$('[data-history]').forEach((b) => b.onclick = () => stockHistory(D.products.find((p) => p.id === Number(b.dataset.history))));
  }
  function stockModal(p) {
    if (!p) return;
    openModal('<div class="row" style="justify-content:space-between"><h3>' + t('adjustStock') + ' - ' + esc(pName(p)) + '</h3><button class="btn gh sm" id="stockClose">✕</button></div>' +
      '<p style="margin:8px 0 14px">' + t('currentStock') + ': <b>' + p.stock + '</b> ' + esc(unitText(p.unit)) + '</p>' +
      '<div class="fg"><div><label for="stockMode">' + t('stockMode') + '</label><select class="in" id="stockMode"><option value="add">' + t('stockModeAdd') + '</option><option value="remove">' + t('stockModeRemove') + '</option><option value="set">' + t('stockModeSet') + '</option></select></div>' +
      '<div><label for="stockAmount">' + t('stockQuantity') + '</label><input class="in" id="stockAmount" type="number" min="1" step="1" value="1"></div>' +
      '<div><label for="stockReason">' + t('stockReason') + '</label><select class="in" id="stockReason" required>' +
      [['restock', 'stockReason_restock'], ['damaged', 'stockReason_damaged'], ['correction', 'stockReason_correction'], ['return', 'stockReason_return'], ['other', 'stockReason_other']].map(([value, label]) => '<option value="' + value + '">' + t(label) + '</option>').join('') + '</select></div>' +
      '<div><label for="stockNote">' + t('stockNote') + '</label><input class="in" id="stockNote" maxlength="200"></div></div>' +
      '<p id="stockPreview" style="margin:12px 0;color:var(--muted)"></p><div class="row"><button class="btn pri" id="stockSave">' + t('save') + '</button><button class="btn gh" id="stockCancel">' + t('cancel') + '</button></div>');
    const mode = $('#stockMode'), amount = $('#stockAmount'), preview = $('#stockPreview'), save = $('#stockSave');
    const updatePreview = () => {
      const value = Number(amount.value);
      const delta = mode.value === 'add' ? value : mode.value === 'remove' ? -value : value - p.stock;
      const after = p.stock + delta;
      const reason = $('#stockReason').value;
      const wrongDirection = ((reason === 'restock' || reason === 'return') && delta < 0) || (reason === 'damaged' && delta > 0);
      const valid = Number.isSafeInteger(value) && value >= 0 && (mode.value === 'set' || value > 0) && after >= 0 && after <= 10000000 && delta !== 0 && !wrongDirection;
      preview.textContent = t('stockNewBalance', { n: Number.isSafeInteger(after) ? after : '-' });
      save.disabled = !valid;
    };
    mode.onchange = () => { amount.min = mode.value === 'set' ? '0' : '1'; amount.value = mode.value === 'set' ? String(p.stock) : '1'; updatePreview(); };
    amount.oninput = updatePreview;
    $('#stockReason').onchange = updatePreview;
    $('#stockClose').onclick = closeModal;
    $('#stockCancel').onclick = closeModal;
    updatePreview();
    save.onclick = async () => {
      if (save.disabled) return;
      save.disabled = true;
      const value = Number(amount.value);
      try {
        await api('/api/admin/products/' + p.id + '/stock-adjust', 'POST', { mode: mode.value, quantity: value, reason: $('#stockReason').value, note: $('#stockNote').value });
        closeModal(); await reload(); products(); toast(t('stockSaved'));
      } catch (e) { save.disabled = false; toast(e.message, 'err'); }
    };
  }
  async function stockHistory(p) {
    if (!p) return;
    openModal('<div class="row" style="justify-content:space-between"><h3>' + t('stockHistory') + ' - ' + esc(pName(p)) + '</h3><button class="btn gh sm" id="stockHistoryClose">✕</button></div>' +
      '<div id="stockHistoryRows" style="margin-top:12px"><p style="color:var(--muted)">' + t('stockHistoryLoading') + '</p></div>');
    $('#stockHistoryClose').onclick = closeModal;
    let offset = 0;
    let loading = false;
    let movements = [];
    const renderHistory = (hasMore) => {
      const target = $('#stockHistoryRows');
      if (!target) return;
      target.innerHTML = movements.length
        ? '<div class="tw"><table><tr><th>' + t('colTime') + '</th><th>' + t('stockReason') + '</th><th class="n">' + t('stockChange') + '</th><th class="n">' + t('stockBalance') + '</th></tr>' + movementRows(movements, false) + '</table></div>' +
          (hasMore ? '<div style="text-align:center;margin-top:12px"><button class="btn gh" id="stockHistoryMore">' + t('showMore') + '</button></div>' : '')
        : '<p style="color:var(--muted)">' + t('stockNoMovements') + '</p>';
      if ($('#stockHistoryMore')) $('#stockHistoryMore').onclick = loadMore;
    };
    const loadMore = async () => {
      if (loading) return;
      loading = true;
      if ($('#stockHistoryMore')) $('#stockHistoryMore').disabled = true;
      try {
        const result = await api('/api/admin/stock-movements?productId=' + encodeURIComponent(p.id) + '&limit=100&offset=' + offset);
        movements = movements.concat(result.movements);
        offset += result.movements.length;
        renderHistory(result.movements.length === 100);
      } catch (e) {
        const target = $('#stockHistoryRows');
        if (target) target.textContent = e.message || t('stockHistoryError');
      } finally {
        loading = false;
      }
    };
    await loadMore();
  }
  function prodModal(p) {
    const n = !p; p = p || { name: '', nameEn: '', category: D.categories[0].id, emoji: '🎆', mrp: '', discount: null, unit: t('defUnit'), stock: 0, lowStockThreshold: 10, popular: false, active: true, image: '' };
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
      '<div><label>' + t('fStock') + '</label>' + (n ? '<input class="in" id="f_stock" type="number" min="0" max="10000000" value="0">' : '<input class="in" value="' + p.stock + '" readonly><small>' + t('stockAdjustHint') + '</small>') + '</div>' +
      '<div><label for="f_lowStockThreshold">' + t('fLowStockThreshold') + '</label><input class="in" id="f_lowStockThreshold" type="number" min="0" max="10000000" value="' + (p.lowStockThreshold ?? 10) + '"></div>' +
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
      const body = { name: $('#f_name').value, nameEn: $('#f_nameEn').value, category: $('#f_cat').value, emoji: $('#f_emoji').value, mrp: $('#f_mrp').value, discount: $('#f_disc').value === '' ? null : $('#f_disc').value, unit: $('#f_unit').value, lowStockThreshold: $('#f_lowStockThreshold').value, popular: $('#f_pop').checked, active: $('#f_act').checked };
      if (n) body.stock = $('#f_stock').value;
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
    const f = (id, label, v, type = 'text') => {
      const input = '<input class="in" id="' + id + '" type="' + type + '" value="' + esc(v) + '"' +
        (type === 'password' ? ' autocomplete="' + (id === 'p_cur' ? 'current-password' : 'new-password') + '"' : '') + '>';
      return '<div><label for="' + id + '">' + label + '</label>' +
        (type === 'password' ? '<div class="password-field">' + input + passwordToggleButton() + '</div>' : input) + '</div>';
    };
    view.innerHTML = '<h2 class="title">' + t('setTitle') + '</h2>' +
      '<div class="panel"><h3>' + t('shopDetails') + '</h3><div class="fg">' +
      '<div class="full logo-setting"><label for="s_logoFile">' + t('sLogo') + '</label><input class="in" id="s_logoFile" type="file" accept="image/jpeg,image/png,image/webp"><small class="photo-help">' + t('sLogoHelp') + '</small>' +
      '<div class="logo-preview" id="s_logoPreview">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span' + (s.logo ? ' hidden' : '') + '>🎆</span></div>' +
      (s.logo ? '<button class="btn gh sm" id="s_logoRemove" type="button">' + t('sLogoRemove') + '</button>' : '') + '</div>' +
      f('s_name', t('sNameTa'), s.shopName) + f('s_nameEn', t('sNameEn'), s.shopNameEn) + f('s_tag', t('sTagTa'), s.tagline) + f('s_tagEn', t('sTagEn'), s.taglineEn) +
      f('s_fest', t('sFestTa'), s.festivalTitle) + f('s_festEn', t('sFestEn'), s.festivalTitleEn) +
      '<div class="full settings-hint">' + t('sFestivalHint') + '</div>' +
      f('s_phone', t('sPhone'), s.phone) + f('s_adminEmail', t('sAdminEmail'), s.adminEmail || '', 'email') +
      '<div class="full settings-hint">' + t('sAdminEmailHelp') + '</div>' + f('s_wa', t('sWa'), s.whatsapp) +
      f('s_addr', t('sAddrTa'), s.address) + f('s_addrEn', t('sAddrEn'), s.addressEn) + f('s_deliveryArea', t('sDeliveryArea'), s.deliveryArea || '') +
      '<div class="full"><label for="s_deliveryInfo">' + t('sDeliveryInfo') + '</label><textarea class="in" id="s_deliveryInfo" rows="3">' + esc(s.deliveryInfo || '') + '</textarea></div>' +
      '<div class="full"><label for="s_checkoutNote">' + t('sCheckoutNoteTa') + '</label><textarea class="in" id="s_checkoutNote" rows="2">' + esc(s.checkoutNote || '') + '</textarea></div>' +
      '<div class="full"><label for="s_checkoutNoteEn">' + t('sCheckoutNoteEn') + '</label><textarea class="in" id="s_checkoutNoteEn" rows="2">' + esc(s.checkoutNoteEn || '') + '</textarea></div>' +
      f('s_lic', t('sLic'), s.licenseNo) + f('s_gst', t('sGst'), s.gstNo) +
      f('s_disc', t('sDisc'), s.discount, 'number') + f('s_min', t('sMin'), s.minOrder, 'number') +
      '</div><div style="margin-top:14px"><button class="btn pri" id="s_save">' + t('save') + '</button></div></div>' +
      '<div class="panel"><h3>' + t('pwTitle') + '</h3><div class="fg">' + f('p_cur', t('pwCur'), '', 'password') + f('p_new', t('pwNew'), '', 'password') + '</div><div style="margin-top:14px"><button class="btn" id="p_save">' + t('pwBtn') + '</button></div></div>' +
      '<div class="panel"><h3>' + t('exportTitle') + '</h3><p style="color:var(--muted);margin-bottom:12px">' + t('exportText') + '</p>' +
      '<div class="fg">' +
      '<div><label for="exportStart">' + t('exportFrom') + '</label><input class="in" id="exportStart" type="date"></div>' +
      '<div><label for="exportEnd">' + t('exportTo') + '</label><input class="in" id="exportEnd" type="date"></div>' +
      '<div><label for="exportStatus">' + t('exportStatus') + '</label><select class="in" id="exportStatus"><option value="all">' + t('all') + '</option>' + STATUSES.map((status) => '<option value="' + status + '">' + stLabel(status) + '</option>').join('') + '</select></div>' +
      '<div><label for="exportPayment">' + t('exportPayment') + '</label><select class="in" id="exportPayment"><option value="all">' + t('all') + '</option>' + PAYS.map((payment) => '<option value="' + payment + '">' + payLabel(payment) + '</option>').join('') + '</select></div>' +
      '</div><div class="row" style="margin-top:14px"><button class="btn pri" id="exportExcel">' + t('exportExcel') + '</button><button class="btn" id="exportPdf">' + t('exportPdf') + '</button></div></div>' +
      '<div class="panel"><h3>' + t('bkTitle') + '</h3><p style="color:var(--muted);margin-bottom:10px">' + t('bkText') + '</p><a class="btn" href="/api/admin/backup" download>' + t('bkBtn') + '</a></div>';
    $('#exportExcel').onclick = downloadExcelExport;
    $('#exportPdf').onclick = printFilteredReport;
    $('#s_save').onclick = async () => {
      const button = $('#s_save');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const body = { shopName: $('#s_name').value, shopNameEn: $('#s_nameEn').value, tagline: $('#s_tag').value, taglineEn: $('#s_tagEn').value, festivalTitle: $('#s_fest').value, festivalTitleEn: $('#s_festEn').value, phone: $('#s_phone').value, adminEmail: $('#s_adminEmail').value, whatsapp: $('#s_wa').value, address: $('#s_addr').value, addressEn: $('#s_addrEn').value, deliveryArea: $('#s_deliveryArea').value, deliveryInfo: $('#s_deliveryInfo').value, checkoutNote: $('#s_checkoutNote').value, checkoutNoteEn: $('#s_checkoutNoteEn').value, licenseNo: $('#s_lic').value, gstNo: $('#s_gst').value, discount: $('#s_disc').value, minOrder: $('#s_min').value };
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

  function currentExportFilters() {
    const start = $('#exportStart').value;
    const end = $('#exportEnd').value;
    const endNextDay = end ? new Date(end + 'T00:00:00') : null;
    if (endNextDay) endNextDay.setDate(endNextDay.getDate() + 1);
    return {
      start,
      end,
      startOffset: start ? new Date(start + 'T00:00:00').getTimezoneOffset() : 0,
      endOffset: endNextDay ? endNextDay.getTimezoneOffset() : 0,
      status: $('#exportStatus').value,
      payment: $('#exportPayment').value,
    };
  }
  function filteredExportRows(filters) {
    const inDateRange = (record) => {
      const timestamp = new Date(record.createdAt);
      const date = Number.isFinite(timestamp.getTime())
        ? [timestamp.getFullYear(), String(timestamp.getMonth() + 1).padStart(2, '0'), String(timestamp.getDate()).padStart(2, '0')].join('-')
        : '';
      return (!filters.start || date >= filters.start) && (!filters.end || date <= filters.end);
    };
    return {
      bills: D.bills.filter((bill) => inDateRange(bill) && (filters.payment === 'all' || bill.payment === filters.payment)),
      orders: D.orders.filter((order) => inDateRange(order) && (filters.status === 'all' || order.status === filters.status)),
    };
  }
  async function downloadExcelExport() {
    const filters = currentExportFilters();
    if (filters.start && filters.end && filters.start > filters.end) {
      toast(t('exportInvalidDates'), 'err');
      return;
    }
    const query = new URLSearchParams(filters);
    try {
      const response = await fetch('/api/admin/export?' + query, {
        headers: { 'X-Lang': store.get('lang', 'ta') },
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 401) { showLogin(t('sessionExpired')); return; }
        throw new Error(error.error || t('exportFailed'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'crackers-shop-export-' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast(error.message, 'err');
    }
  }
  function printFilteredReport() {
    const filters = currentExportFilters();
    if (filters.start && filters.end && filters.start > filters.end) {
      toast(t('exportInvalidDates'), 'err');
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) { toast(t('exportPopupBlocked'), 'err'); return; }
    popup.opener = null;
    const rows = filteredExportRows(filters);
    const itemText = (lines) => lines.map((line) => (isEn() && line.nameEn ? line.nameEn : line.name) + ' × ' + line.qty).join(', ');
    const dateText = (date) => esc(new Date(date).toLocaleString(locale()));
    const billTotal = rows.bills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const orderTotal = rows.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const table = (headers, body) => '<table><thead><tr>' + headers.map((header) => '<th>' + header + '</th>').join('') +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="' + headers.length + '">' + t('exportNoRows') + '</td></tr>') + '</tbody></table>';
    const bills = rows.bills.map((bill) => '<tr><td>' + esc(bill.id) + '</td><td>' + dateText(bill.createdAt) + '</td><td>' +
      esc(bill.customer?.name || '-') + '</td><td>' + esc(payLabel(bill.payment)) + '</td><td>' + esc(itemText(bill.lines || [])) +
      '</td><td class="amount">' + rupee(bill.total) + '</td></tr>').join('');
    const orders = rows.orders.map((order) => '<tr><td>' + esc(order.id) + '</td><td>' + dateText(order.createdAt) + '</td><td>' +
      esc(order.customer?.name || '-') + '</td><td>' + esc(stLabel(order.status)) + '</td><td>' + esc(itemText(order.lines || [])) +
      '</td><td class="amount">' + rupee(order.total) + '</td></tr>').join('');
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(t('exportReport')) + '</title><style>' +
      'body{font:12px Arial,"Nirmala UI",Latha,sans-serif;color:#222;margin:24px}h1{font-size:20px}h2{font-size:16px;margin-top:24px}' +
      '.summary{display:flex;gap:24px;margin:16px 0}.summary strong{font-size:16px}table{width:100%;border-collapse:collapse;margin:8px 0 20px}' +
      'th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#eee}.amount{text-align:right;white-space:nowrap}' +
      '@media print{body{margin:12mm}h2{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}}' +
      '</style></head><body><h1>' + esc(t('exportReport')) + ' — ' + esc(shopText(D.settings.shopName, D.settings.shopNameEn)) +
      '</h1><p>' + esc(new Date().toLocaleString(locale())) + '</p><p>' + t('exportAppliedFilters') + ': ' +
      esc((filters.start || t('all')) + ' – ' + (filters.end || t('all')) + ' · ' +
        t('exportStatus') + ': ' + (filters.status === 'all' ? t('all') : stLabel(filters.status)) + ' · ' +
        t('exportPayment') + ': ' + (filters.payment === 'all' ? t('all') : payLabel(filters.payment))) +
      '</p><div class="summary"><div>' + t('exportBills') +
      ': <strong>' + rows.bills.length + '</strong> (' + rupee(billTotal) + ')</div><div>' + t('exportOrders') +
      ': <strong>' + rows.orders.length + '</strong> (' + rupee(orderTotal) + ')</div></div><h2>' + t('exportBills') + '</h2>' +
      table([t('exportId'), t('exportDate'), t('exportCustomer'), t('exportPaymentCol'), t('exportItems'), t('exportAmount')], bills) +
      '<h2>' + t('exportOrders') + '</h2>' +
      table([t('exportId'), t('exportDate'), t('exportCustomer'), t('exportStatusCol'), t('exportItems'), t('exportAmount')], orders) +
      '<script>window.onload=function(){window.focus();window.print()}</script></body></html>';
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  // new-order polling
  setInterval(async () => {
    if ($('#app').hidden) return;
    try {
      const fresh = await api('/api/admin/data');
      pollErrorShown = false;
      const had = D.orders.length; D = fresh; dataUpdatedAt = new Date(); updateBadge();
      const hasNewOrders = fresh.orders.length > had;
      if (hasNewOrders) toast(t('newOrderToast'));
      if (tab === 'dash') render();
      else if (hasNewOrders && tab === 'orders') showOrdersUpdateNotice();
    } catch (e) {
      if (e.status === 401) { showLogin(t('sessionExpired')); return; }
      if (!pollErrorShown) { toast(e.message, 'err'); pollErrorShown = true; }
    }
  }, 20000);

  if (new URLSearchParams(location.hash.slice(1)).has('reset')) showLogin();
  else boot();
})();
