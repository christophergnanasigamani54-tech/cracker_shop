(function () {
  let S = {}, cats = [], products = [];
  let cat = 'all', query = '', sort = 'pop';
  let cart = store.get('cart', {}); // id -> qty
  if (!cart || typeof cart !== 'object' || Array.isArray(cart)) cart = {};
  let loaded = false;
  let submitting = false;
  let customer = null, accountOrders = [], accountMode = 'login', pendingAddId = null, pendingRegistrationEmail = '', pendingProfileEmail = '', pendingProfile = null;
  let menuOpen = false;

  const fw = Fireworks.start($('#sky'));
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .card, .drawer, .modal, .menu-backdrop, .customer-nav')) return;
    fw.burst(e.clientX, e.clientY);
  });

  const pById = (id) => products.find((p) => p.id === Number(id));
  const saveCart = () => store.set('cart', cart);
  const off = (p) => Math.round((1 - p.price / p.mrp) * 100);
  // shop texts typed by the owner: Tamil + optional English version
  const pick = (ta, en) => (isEn() && en ? en : ta);

  async function loadCustomer() {
    const result = await api('/api/customer/me');
    customer = result.loggedIn ? result.customer : null;
    pendingProfileEmail = customer ? String(result.pendingEmail || '') : '';
    pendingProfile = customer ? result.pendingProfile || null : null;
    updateAccountButton();
    if (customer) {
      const saved = store.get('cust', {});
      const savedMatches = saved.email && String(saved.email).toLowerCase() === String(customer.email || '').toLowerCase();
      $('#cName').value = customer.name || (savedMatches ? saved.name : '');
      $('#cPhone').value = customer.phone || (savedMatches ? saved.phone : '');
      $('#cAddr').value = customer.address || (savedMatches ? saved.address : '');
    }
  }

  function updateAccountButton() {
    document.body.classList.toggle('guest', !customer);
    $('#accountBtn').textContent = customer ? t('customerWelcome', { n: customer.name }) : t('customerAccount');
    $$('[data-customer-only]').forEach((item) => { item.hidden = !customer; });
    $('#menuToggle').hidden = !customer;
    $('#customerNav').hidden = !customer;
    $('.searchbox').hidden = !customer;
    $('#openCart').hidden = !customer;
    setMenuOpen(customer ? menuOpen : false);
  }

  function setMenuOpen(open) {
    const drawerMode = window.matchMedia('(max-width: 700px)').matches;
    if (open && (!customer || !drawerMode)) return;
    const wasOpen = menuOpen;
    menuOpen = open;
    $('#customerNav').classList.toggle('open', open);
    $('#customerNav').setAttribute('aria-hidden', String(!customer || (drawerMode && !open)));
    $('#menuBackdrop').hidden = !open;
    document.body.classList.toggle('menu-open', open);
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', t(open ? 'closeMenu' : 'openMenu'));
    if (open) $('#menuClose').focus();
    else if (wasOpen && drawerMode && !$('#menuToggle').hidden) $('#menuToggle').focus();
  }

  window.addEventListener('resize', () => {
    if (menuOpen && !window.matchMedia('(max-width: 700px)').matches) setMenuOpen(false);
  });

  function showPage(page) {
    if (!customer && page !== 'home') {
      accountMode = 'login';
      openAccount();
      return;
    }
    $('#homePage').hidden = page !== 'home';
    $('#productsPage').hidden = page !== 'products';
    $('#drawer').hidden = page !== 'cart';
    $('#ordersPage').hidden = page !== 'orders';
    $('#accountPage').hidden = page !== 'account';
    $$('[data-page]').forEach((button) => {
      const selected = button.dataset.page === page;
      button.classList.toggle('on', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'orders') loadOrders();
    if (page === 'account') renderProfile();
    if (page === 'cart') {
      const phone = $('#cPhone').value.replace(/\D/g, '');
      if (phone.length < 10) $('#cPhone').focus();
      else if ($('#cAddr').value.trim().length < 5) $('#cAddr').focus();
    }
  }

  function renderProfile() {
    if (!customer) return;
    const saved = store.get('cust', {});
    const savedMatches = saved.email && String(saved.email).toLowerCase() === String(customer.email || '').toLowerCase();
    const editData = pendingProfile || customer;
    const phone = editData.phone || (!pendingProfile && savedMatches ? saved.phone : '') || '';
    const address = editData.address || (!pendingProfile && savedMatches ? saved.address : '') || '';
    $('#customerProfile').innerHTML = '<div class="profile-details" id="profileSummary"><dl>' +
      '<div><dt data-i18n="profileName">' + t('profileName') + '</dt><dd>' + esc(customer.name || t('profileNotProvided')) + '</dd></div>' +
      '<div><dt data-i18n="profileEmail">' + t('profileEmail') + '</dt><dd>' + esc(customer.email || t('profileNotProvided')) + '</dd></div>' +
      '<div><dt data-i18n="profilePhone">' + t('profilePhone') + '</dt><dd>' + esc(phone || t('profileNotProvided')) + '</dd></div>' +
      '<div><dt data-i18n="profileAddress">' + t('profileAddress') + '</dt><dd>' + esc(address || t('profileNotProvided')) + '</dd></div>' +
      '</dl></div><div class="profile-actions"><button class="btn ghost" id="profileEdit" type="button" data-i18n="profileEdit">' + t('profileEdit') + '</button></div>' +
      '<form class="form profile-form" id="profileForm" hidden>' +
      '<div class="field"><label for="profileEmail" data-i18n="customerEmail">' + t('customerEmail') + '</label><input id="profileEmail" name="email" type="email" value="' + esc(editData.email || '') + '" maxlength="254" autocomplete="email" required></div>' +
      '<div class="field"><label for="profileName" data-i18n="customerName">' + t('customerName') + '</label><input id="profileName" name="name" value="' + esc(editData.name || '') + '" minlength="2" maxlength="60" autocomplete="name" required></div>' +
      '<div class="field"><label for="profilePhone" data-i18n="profilePhone">' + t('profilePhone') + '</label><input id="profilePhone" name="phone" type="tel" inputmode="numeric" value="' + esc(phone) + '" maxlength="20" autocomplete="tel"></div>' +
      '<div class="field"><label for="profileAddress" data-i18n="profileAddress">' + t('profileAddress') + '</label><textarea id="profileAddress" name="address" rows="3" maxlength="300" autocomplete="street-address">' + esc(address) + '</textarea></div>' +
      '<div class="account-error" id="profileError" role="alert"></div>' +
      '<div class="profile-form-actions"><button class="btn primary" type="submit" data-i18n="profileSave">' + t('profileSave') + '</button>' +
      '<button class="btn ghost" id="profileCancel" type="button" data-i18n="profileCancel">' + t('profileCancel') + '</button></div></form>' +
      '<form class="form profile-email-form" id="profileEmailVerifyForm" hidden>' +
      '<p class="profile-verify-copy"><span data-i18n="profileEmailVerifyText">' + t('profileEmailVerifyText') + '</span><br><b id="profilePendingEmail">' + esc(pendingProfileEmail) + '</b></p>' +
      '<div class="field"><label for="profileEmailCode" data-i18n="customerOtpCode">' + t('customerOtpCode') + '</label><input id="profileEmailCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></div>' +
      '<div class="account-error" id="profileEmailError" role="alert"></div>' +
      '<button class="btn primary" type="submit" style="justify-content:center" data-i18n="profileEmailVerify">' + t('profileEmailVerify') + '</button>' +
      '<div class="profile-email-actions"><button type="button" id="profileEmailResend" data-i18n="customerResendOtp">' + t('customerResendOtp') + '</button><button type="button" id="profileChangeEdit" data-i18n="profileEdit">' + t('profileEdit') + '</button></div></form>';
    $('#profileEdit').hidden = !!pendingProfileEmail;
    $('#profileSummary').hidden = !!pendingProfileEmail;
    $('#profileForm').hidden = true;
    $('#profileEmailVerifyForm').hidden = !pendingProfileEmail;
    $('#profileEdit').onclick = () => openProfileEditor('profileEmail');
    $('#profileForm').onsubmit = saveProfile;
    $('#profileCancel').onclick = cancelProfileEdit;
    $('#profileEmailVerifyForm').onsubmit = verifyProfileEmail;
    $('#profileEmailResend').onclick = resendProfileEmail;
    $('#profileChangeEdit').onclick = editPendingProfile;
  }

  function openProfileEditor(focusId) {
    $('#profileSummary').hidden = true;
    $('#profileEdit').hidden = true;
    $('#profileForm').hidden = false;
    $(focusId).focus();
  }

  function cancelProfileEdit() {
    pendingProfile = null;
    renderProfile();
  }

  function maybePromptContactDetails() {
    if (!customer || pendingProfileEmail) return;
    const phone = String(customer.phone || $('#cPhone').value || '').replace(/\D/g, '');
    const address = String(customer.address || $('#cAddr').value || '').trim();
    if (phone.length >= 10 && address.length >= 5) return;

    const saved = store.get('profileContactPrompts', {});
    const prompted = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const key = String(customer.id || customer.email || 'customer');
    if (prompted[key]) return;
    prompted[key] = true;
    store.set('profileContactPrompts', prompted);
    $('#profileContactPrompt').classList.add('on');
  }

  function closeContactPrompt() {
    $('#profileContactPrompt').classList.remove('on');
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    const error = $('#profileError');
    button.disabled = true;
    error.textContent = '';
    try {
      const result = await api('/api/customer/me', 'PUT', data);
      pendingProfileEmail = result.pendingEmail || '';
      pendingProfile = result.pendingProfile || null;
      if (!result.verificationRequired) {
        customer = result.customer;
        pendingProfile = null;
        $('#cName').value = customer.name || '';
        $('#cPhone').value = customer.phone || '';
        $('#cAddr').value = customer.address || '';
        store.set('cust', { name: customer.name, phone: customer.phone, address: customer.address, email: customer.email });
      }
      renderProfile();
      toast(t(result.verificationRequired ? 'customerProfileVerificationSent' : 'customerProfileSaved'));
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  async function verifyProfileEmail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const code = $('#profileEmailCode').value.trim();
    const error = $('#profileEmailError');
    button.disabled = true;
    error.textContent = '';
    try {
      const result = await api('/api/customer/me/email/verify', 'POST', { code });
      customer = result.customer;
      pendingProfileEmail = '';
      pendingProfile = null;
      $('#cName').value = customer.name || '';
      $('#cPhone').value = customer.phone || '';
      $('#cAddr').value = customer.address || '';
      updateAccountButton();
      store.set('cust', { name: customer.name, phone: customer.phone, address: customer.address, email: customer.email });
      renderProfile();
      toast(t('customerProfileVerified'));
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  async function resendProfileEmail(event) {
    const button = event.currentTarget;
    button.disabled = true;
    $('#profileEmailError').textContent = '';
    try {
      await api('/api/customer/me/email/resend', 'POST', {});
      toast(t('customerOtpSent'));
    } catch (e) {
      $('#profileEmailError').textContent = e.message;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  async function editPendingProfile() {
    try {
      await api('/api/customer/me/email/cancel', 'POST', {});
      pendingProfileEmail = '';
      renderProfile();
      openProfileEditor('profileEmail');
    } catch (e) {
      $('#profileEmailError').textContent = e.message;
    }
  }

  async function loadOrders() {
    const list = $('#customerOrderList');
    list.textContent = t('loading');
    try {
      const result = await api('/api/customer/orders');
      accountOrders = result.orders;
      list.innerHTML = accountOrders.length ? accountOrders.map((order) =>
        '<article class="account-order"><b>' + esc(order.id) + ' · ' + rupee(order.total) + '</b>' +
        '<small>' + esc(fmtDate(order.createdAt)) + ' · ' + esc(t('customerStatus' + order.status[0].toUpperCase() + order.status.slice(1))) + '</small>' +
        '<small>' + order.lines.map((line) => esc(pName(line)) + ' × ' + line.qty).join(', ') + '</small></article>'
      ).join('') : '<p>' + t('customerNoOrders') + '</p>';
    } catch (e) {
      list.textContent = e.message;
    }
  }

  function showProducts() {
    setMenuOpen(false);
    if (!customer) {
      accountMode = 'login';
      openAccount();
      return;
    }
    showPage('products');
  }

  async function openAccount() {
    setMenuOpen(false);
    if (customer) {
      showPage('account');
      return;
    }
    $('#accountModal').classList.add('on');
    await renderAccount();
  }

  function requestAdd(id) {
    if (!customer) {
      pendingAddId = Number(id);
      accountMode = 'login';
      openAccount();
      return;
    }
    if (change(id, 1)) toast(t('added'));
  }
  function closeAccount() {
    pendingAddId = null;
    $('#accountModal').classList.remove('on');
  }

  async function renderAccount(error = '') {
    const box = $('#accountBox');
    const registering = accountMode === 'register';
    const verifying = accountMode === 'verify';
    const fields = registering
      ? '<div class="field"><label for="accountName">' + t('customerName') + '</label><input id="accountName" name="name" required minlength="2" maxlength="60" autocomplete="name"></div>' +
        '<div class="field"><label for="accountEmail">' + t('customerEmail') + '</label><input id="accountEmail" name="email" type="email" maxlength="254" autocomplete="email" required></div>' +
        '<div class="field"><label for="accountPassword">' + t('customerPassword') + '</label><div class="password-field"><input id="accountPassword" name="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password">' + passwordToggleButton() + '</div></div>' +
        '<div class="field"><label for="accountPasswordConfirm">' + t('customerConfirmPassword') + '</label><div class="password-field"><input id="accountPasswordConfirm" name="passwordConfirm" type="password" required minlength="8" maxlength="100" autocomplete="new-password">' + passwordToggleButton() + '</div></div>'
      : verifying
        ? '<div class="field"><label for="accountCode">' + t('customerOtpCode') + '</label><input id="accountCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></div>'
        : '<div class="field"><label for="accountIdentifier">' + t('customerIdentifier') + '</label><input id="accountIdentifier" name="identifier" required autocomplete="username"></div>' +
          '<div class="field"><label for="accountPassword">' + t('customerPassword') + '</label><div class="password-field"><input id="accountPassword" name="password" type="password" required minlength="8" maxlength="100" autocomplete="current-password">' + passwordToggleButton() + '</div></div>';
    box.innerHTML = '<button class="x" id="accountClose" style="float:right" aria-label="' + esc(t('close')) + '">✕</button>' +
      '<h2>' + t(verifying ? 'customerVerifyTitle' : registering ? 'customerRegisterTitle' : 'accountTitle') + '</h2>' +
      (verifying ? '<p class="account-otp-note">' + esc(t('customerOtpSentTo')) + '<br><b>' + esc(pendingRegistrationEmail) + '</b></p>' : '') +
      '<form class="form" id="accountForm">' +
      fields +
      '<div class="account-error" id="accountError" role="alert">' + esc(error) + '</div>' +
      '<button class="btn primary" type="submit" style="width:100%;justify-content:center">' + t(verifying ? 'customerVerifyButton' : registering ? 'customerRegister' : 'customerLogin') + '</button></form>' +
      (verifying
        ? '<p class="account-links"><button type="button" id="resendOtp">' + t('customerResendOtp') + '</button> · <button type="button" id="changeEmail">' + t('customerChangeEmail') + '</button></p>'
        : '<p class="account-links"><button type="button" id="accountSwitch">' + t(registering ? 'customerHaveAccount' : 'customerNeedAccount') + '</button></p>');
    $('#accountClose').onclick = closeAccount;
    if ($('#accountSwitch')) $('#accountSwitch').onclick = () => { accountMode = registering ? 'login' : 'register'; renderAccount(); };
    if (verifying) {
      $('#changeEmail').onclick = () => { accountMode = 'register'; renderAccount(); };
      $('#resendOtp').onclick = async (event) => {
        const resend = event.currentTarget;
        resend.disabled = true;
        try {
          await api('/api/customer/register/resend', 'POST', { email: pendingRegistrationEmail });
          toast(t('customerOtpSent'));
        } catch (err) {
          $('#accountError').textContent = err.message;
        } finally {
          if (resend.isConnected) resend.disabled = false;
        }
      };
    }
    $('#accountForm').onsubmit = submitAccount;
  }

  async function submitAccount(e) {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    const registering = accountMode === 'register';
    const verifying = accountMode === 'verify';
    const body = Object.fromEntries(data.entries());
    const error = $('#accountError');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (registering) {
        if (body.password !== body.passwordConfirm) throw new Error(t('customerPasswordMismatch'));
        pendingRegistrationEmail = String(body.email).trim().toLowerCase();
        await api('/api/customer/register', 'POST', body);
        accountMode = 'verify';
        renderAccount();
        toast(t('customerOtpSent'));
        return;
      }
      if (verifying) {
        await api('/api/customer/register/verify', 'POST', { email: pendingRegistrationEmail, code: body.code });
      } else {
        await api('/api/customer/login', 'POST', body);
      }
      await loadCustomer();
      accountOrders = [];
      $('#accountModal').classList.remove('on');
      const addId = pendingAddId;
      pendingAddId = null;
      if (verifying) pendingRegistrationEmail = '';
      toast(t(verifying ? 'customerAccountCreated' : 'customerLogin'));
      renderAll();
      showPage('products');
      renderCart();
      if (addId && pById(addId) && change(addId, 1)) toast(t('added'));
      maybePromptContactDetails();
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  }

  async function logoutCustomer() {
    try {
      await api('/api/customer/logout', 'POST', {});
      customer = null; accountOrders = []; accountMode = 'login'; pendingProfileEmail = '';
      localStorage.removeItem('cust');
      $('#cName').value = ''; $('#cPhone').value = ''; $('#cAddr').value = '';
      $('#accountModal').classList.remove('on');
      setMenuOpen(false);
      updateAccountButton(); renderGrid(); renderCart(); showPage('home');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function load() {
    try {
      const d = await api('/api/public');
      S = d.settings; cats = d.categories; products = d.products;
      const activeCategories = cats.filter((c) => products.some((p) => p.category === c.id));
      if (cat !== 'all' && !activeCategories.some((c) => c.id === cat)) cat = activeCategories[0] ? activeCategories[0].id : 'all';
    } catch (e) {
      loaded = false;
      $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1">' + t('down') + '</div>';
      return false;
    }
    for (const id of Object.keys(cart)) {
      const p = pById(id), qty = Number(cart[id]);
      if (!p || !Number.isSafeInteger(qty) || qty <= 0 || p.stock <= 0) delete cart[id];
      else cart[id] = Math.min(qty, p.stock, 9999);
    }
    saveCart();
    loaded = true;
    return true;
  }

  // draw everything that depends on language or data
  function renderAll() {
    applyStatic();
    if (!loaded) return;
    const shop = pick(S.shopName, S.shopNameEn);
    const fest = pick(S.festivalTitle, S.festivalTitleEn) || t('festDefault');
    document.title = t('pageTitle', { n: shop });
    $('#shopName').textContent = shop;
    $('#tagline').textContent = pick(S.tagline, S.taglineEn);
    $('#shopLogo').hidden = !S.logo;
    $('#shopLogoFallback').hidden = !!S.logo;
    if (S.logo) $('#shopLogo').src = S.logo;
    $('#festival').textContent = '🪔 ' + fest;
    const m = t('marquee', { f: fest, d: S.discount, p: S.phone, n: shop });
    $('#marquee').textContent = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? m : m + '　　' + m;
    $('#heroText').textContent = t('heroText', { d: S.discount });
    $('#fName').textContent = shop;
    $('#fTag').textContent = pick(S.tagline, S.taglineEn);
    $('#fAddr').textContent = pick(S.address, S.addressEn);
    $('#fPhone').innerHTML = '<a href="tel:' + esc(S.phone) + '">' + esc(S.phone) + '</a>';
    const delivery = [S.deliveryArea, S.deliveryInfo].filter((value) => value && value.trim());
    $('#deliveryBlock').hidden = delivery.length === 0;
    $('#fDelivery').textContent = delivery.join(' · ');
    const checkoutNote = String(pick(S.checkoutNote || '', S.checkoutNoteEn || '') || '').trim();
    $('#checkoutNote').textContent = checkoutNote;
    $('#checkoutNote').hidden = !checkoutNote;
    $('#doneNote').textContent = checkoutNote;
    $('#doneNote').hidden = !checkoutNote;
    const checkoutPhone = $('#checkoutPhone');
    checkoutPhone.textContent = S.phone ? t('orderContact', { n: S.phone }) : '';
    checkoutPhone.href = S.phone ? 'tel:' + String(S.phone).replace(/[^\d+]/g, '') : '';
    checkoutPhone.hidden = !S.phone;
    $('#fLic').textContent = S.licenseNo ? t('licNo', { n: S.licenseNo }) : t('licDefault');
    updateAccountButton();
    renderChips(); renderGrid(); renderCart();
  }

  function renderChips() {
    if (!customer) { $('#chips').innerHTML = ''; return; }
    const all = [{ id: 'all', name: t('all'), nameEn: t('all'), emoji: '🎆' }, ...cats.filter((c) => products.some((p) => p.category === c.id))];
    $('#chips').innerHTML = all.map((c) => '<button class="chip' + (c.id === cat ? ' on' : '') + '" data-c="' + c.id + '" role="tab">' + c.emoji + ' ' + esc(cName(c)) + '</button>').join('');
  }

  function renderGrid() {
    const authorized = !!customer;
    $('#productPreview').hidden = false;
    $('#previewPrompt').hidden = authorized;
    $('.toolbar').hidden = !authorized;
    $('#previewGrid').hidden = false;
    $('#grid').hidden = !authorized;
    const q = query.trim().toLowerCase();
    const featured = products.filter((p) => !q || (p.name + ' ' + p.nameEn).toLowerCase().includes(q))
      .sort((a, b) => (b.popular - a.popular) || a.id - b.id).slice(0, 4);
    if (!authorized) {
      $('#previewGrid').innerHTML = featured.map(previewCardHtml).join('') || '<div class="empty" style="grid-column:1/-1">' + t('nothing') + '</div>';
      return;
    }
    $('#previewGrid').innerHTML = featured.map(cardHtml).join('');
    let list = products.filter((p) => (cat === 'all' || p.category === cat));
    if (q) list = list.filter((p) => (p.name + ' ' + p.nameEn).toLowerCase().includes(q));
    const by = {
      pop: (a, b) => (b.popular - a.popular) || a.id - b.id,
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      off: (a, b) => off(b) - off(a),
    };
    list.sort(by[sort]);
    if (!list.length) { $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1">' + t('nothing') + '</div>'; return; }
    $('#grid').innerHTML = list.map(cardHtml).join('');
  }

  function previewCardHtml(p) {
    const name = pName(p);
    return '<button type="button" class="card preview-card" data-preview aria-label="' + esc(t('previewAria', { n: name })) + '">' +
      '<span class="pic"><i class="photo-fallback"' + (p.image ? ' hidden' : '') + '>' + esc(p.emoji) + '</i>' +
      (p.image ? '<img class="product-photo" src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') +
      '<span class="preview-lock" aria-hidden="true">🔒</span></span>' +
      '<span class="body"><span class="preview-name">' + esc(name) + '</span><span class="unit">' + esc(unitText(p.unit)) + '</span></span></button>';
  }

  function actHtml(p) {
    if (p.stock <= 0) return '<button class="add" disabled>' + t('soldOut') + '</button>';
    const q = cart[p.id] || 0;
    if (!q) return '<button class="add" data-add="' + p.id + '">' + t(customer ? 'add' : 'signInToAdd') + '</button>';
    return '<div class="stepper"><button data-dec="' + p.id + '" aria-label="' + t('dec') + '">−</button><span>' + q + '</span><button data-inc="' + p.id + '" aria-label="' + t('inc') + '">+</button></div>';
  }
  function cardHtml(p) {
    return '<article class="card" data-id="' + p.id + '">' +
      '<div class="pic"><i class="photo-fallback"' + (p.image ? ' hidden' : '') + '>' + esc(p.emoji) + '</i>' + (p.image ? '<img class="product-photo" src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : '') + '<span class="off">' + t('off', { n: off(p) }) + '</span>' + (p.popular ? '<span class="hot">' + t('hot') + '</span>' : '') + '</div>' +
      '<div class="body"><h3>' + esc(pName(p)) + '</h3><div class="unit">' + esc(unitText(p.unit)) + '</div>' +
      '<div class="price"><b>' + rupee(p.price) + '</b><s>' + rupee(p.mrp) + '</s></div>' +
      (p.stock > 0 && p.stock <= 10 ? '<div class="stockwarn">' + t('onlyLeft', { n: p.stock }) + '</div>' : '') +
      '<div class="act">' + actHtml(p) + '</div></div></article>';
  }
  function refreshCard(id) {
    $$('.card[data-id="' + id + '"] .act').forEach((card) => { card.innerHTML = actHtml(pById(id)); });
  }

  function totals() {
    let mrp = 0, tot = 0, n = 0;
    for (const [id, q] of Object.entries(cart)) { const p = pById(id); if (!p) continue; mrp += p.mrp * q; tot += p.price * q; n += q; }
    return { mrp, tot, n, save: mrp - tot };
  }

  function renderCart() {
    const tt = totals();
    $('#cartCount').textContent = tt.n || ''; $('#cartCount').dataset.n = tt.n;
    const mb = $('#mbar'); mb.hidden = !customer || !tt.n;
    $('#mbarN').textContent = t('items', { n: tt.n }); $('#mbarT').textContent = t('viewCart', { t: rupee(tt.tot) });
    const ids = Object.keys(cart).filter((id) => pById(id));
    if (!ids.length) {
      $('#cartBody').innerHTML = '<div class="empty">🛒<br>' + t('cartEmpty') + '<br><small>' + t('cartEmptySub') + '</small></div>';
      $('#cartSum').hidden = true; return;
    }
    $('#cartBody').innerHTML = ids.map((id) => {
      const p = pById(id), q = cart[id];
      return '<div class="line"><div class="em">' + (p.image ? '<span hidden>' + esc(p.emoji) + '</span><img src="' + esc(p.image) + '" alt="" loading="lazy" onerror="this.hidden=true;this.previousElementSibling.hidden=false">' : esc(p.emoji)) + '</div><div><b>' + esc(pName(p)) + '</b><small>' + esc(unitText(p.unit)) + ' • ' + rupee(p.price) + '</small>' +
        '<div class="stepper"><button data-dec="' + id + '" aria-label="' + t('dec') + '">−</button><span>' + q + '</span><button data-inc="' + id + '" aria-label="' + t('inc') + '">+</button></div></div>' +
        '<div class="amt">' + rupee(p.price * q) + '<br><button class="x" style="width:28px;height:28px;font-size:12px;margin-top:6px" data-del="' + id + '" aria-label="' + t('del') + '">🗑</button></div></div>';
    }).join('');
    $('#cartSum').hidden = false;
    $('#sMrp').textContent = rupee(tt.mrp); $('#sSave').textContent = '− ' + rupee(tt.save); $('#sTot').textContent = rupee(tt.tot);
    const short = S.minOrder - tt.tot;
    $('#minNote').textContent = short > 0 ? t('minNote', { m: rupee(S.minOrder), s: rupee(short) }) : '';
    $('#placeBtn').disabled = !tt.n || short > 0 || submitting;
  }

  function change(id, d) {
    const p = pById(id); if (!p) return;
    const max = Math.min(p.stock, 9999);
    const current = Number(cart[id]) || 0;
    const q = Math.max(0, Math.min(max, current + d));
    if (d > 0 && current >= max) toast(t(max === p.stock ? 'stockOnly' : 'qtyLimit', { n: p.stock }), 'err');
    if (q) cart[id] = q; else delete cart[id];
    saveCart(); refreshCard(id); renderCart();
    return q > current;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#menuToggle')) {
      setMenuOpen(!menuOpen);
      return;
    }
    if (e.target.closest('#menuClose,#menuBackdrop')) {
      setMenuOpen(false);
      return;
    }
    const menuAnchor = e.target.closest('[data-menu-anchor]');
    if (menuAnchor) {
      e.preventDefault();
      const target = $(menuAnchor.getAttribute('href'));
      setMenuOpen(false);
      if (target && target.closest('#homePage') && $('#homePage').hidden) {
        showPage('home');
        requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth' }));
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    const productsEntry = e.target.closest('[data-products-entry]');
    if (productsEntry) {
      e.preventDefault();
      setMenuOpen(false);
      showProducts();
      return;
    }
    const pageButton = e.target.closest('[data-page]');
    if (pageButton) {
      if (pageButton.tagName === 'A') e.preventDefault();
      setMenuOpen(false);
      showPage(pageButton.dataset.page);
      return;
    }
    const lb = e.target.closest('.lang button');
    if (lb) {
      setLang(lb.dataset.lang); renderAll();
      if ($('#accountModal').classList.contains('on')) renderAccount();
      return;
    }
    const b = e.target.closest('[data-add],[data-inc],[data-dec],[data-del],[data-c]');
    if (e.target.closest('[data-preview]')) {
      accountMode = 'login';
      openAccount();
      return;
    }
    if (!b) return;
    if (b.dataset.add) requestAdd(b.dataset.add);
    else if (b.dataset.inc) change(b.dataset.inc, 1);
    else if (b.dataset.dec) change(b.dataset.dec, -1);
    else if (b.dataset.del) { delete cart[b.dataset.del]; saveCart(); refreshCard(b.dataset.del); renderCart(); }
    else if (b.dataset.c) { cat = b.dataset.c; renderChips(); renderGrid(); }
  });
  $('#q').addEventListener('input', (e) => { query = e.target.value; renderGrid(); });
  $('#sort').addEventListener('change', (e) => { sort = e.target.value; renderGrid(); });

  const openCart = () => {
    if (!customer) { openAccount(); return; }
    showPage('cart');
  };
  const closeCart = () => showPage('products');
  $('#openCart').onclick = openCart; $('#mbar').onclick = openCart;
  $('#closeCart').onclick = closeCart;
  $('#accountBtn').onclick = openAccount;
  $('#accountLogout').onclick = logoutCustomer;
  $('#accountModal').addEventListener('mousedown', (e) => { if (e.target.id === 'accountModal') closeAccount(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#done').classList.remove('on'); closeContactPrompt(); closeAccount(); setMenuOpen(false); } });

  // restore customer details
  const saved = store.get('cust', {});
  $('#cName').value = saved.name || ''; $('#cPhone').value = saved.phone || ''; $('#cAddr').value = saved.address || '';
  $('#profileContactAdd').onclick = () => {
    closeContactPrompt();
    showPage('account');
    openProfileEditor('profilePhone');
  };
  $('#profileContactLater').onclick = closeContactPrompt;
  $('#profileContactPrompt').addEventListener('mousedown', (e) => {
    if (e.target.id === 'profileContactPrompt') closeContactPrompt();
  });

  $('#orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting || !Object.keys(cart).length) return;
    if (!customer) { toast(t('customerLoginFirst'), 'err'); await openAccount(); return; }
    const name = $('#cName').value.trim(), phone = $('#cPhone').value.replace(/\D/g, ''), address = $('#cAddr').value.trim();
    if (name.length < 2) { $('#cName').focus(); return toast(t('vName'), 'err'); }
    if (phone.length < 10) { $('#cPhone').focus(); return toast(t('vPhone'), 'err'); }
    if (address.length < 5) { $('#cAddr').focus(); return toast(t('vAddr'), 'err'); }
    submitting = true;
    const btn = $('#placeBtn'); btn.disabled = true; btn.textContent = t('sending');
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
      const r = await api('/api/orders', 'POST', { name, phone, address, note: $('#cNote').value, items });
      store.set('cust', { name, phone, address, email: customer.email });
      customer = { ...customer, name, phone, address };
      cart = {}; saveCart(); closeCart();
      $('#doneId').textContent = r.order.id;
      $('#doneNote').textContent = String(pick(S.checkoutNote || '', S.checkoutNoteEn || '') || '').trim();
      $('#doneNote').hidden = !$('#doneNote').textContent;
      const wa = $('#waLink');
      if (S.whatsapp) {
        wa.hidden = false; wa.textContent = t('wa');
        wa.href = 'https://wa.me/' + (S.whatsapp.length === 10 ? '91' + S.whatsapp : S.whatsapp) + '?text=' + encodeURIComponent(t('waMsg', { name, id: r.order.id, total: rupee(r.order.total) }));
      }
      $('#done').classList.add('on');
      for (let i = 0; i < 6; i++) setTimeout(() => fw.launch(), i * 200);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      await load(); renderAll();
      submitting = false;
      btn.disabled = false; btn.textContent = t('place');
      renderCart();
    }
  });
  $('#doneClose').onclick = () => $('#done').classList.remove('on');

  applyStatic();
  load().then(async () => {
    try { await loadCustomer(); } catch (e) { toast(e.message, 'err'); }
    renderAll();
    if (customer) {
      showPage('products');
      maybePromptContactDetails();
    }
  });
})();
