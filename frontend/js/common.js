/* Shared helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, method = 'GET', body) {
  const opt = { method, headers: { 'X-Lang': store.get('lang', 'ta') }, credentials: 'same-origin' };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  else if (method !== 'GET') opt.headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(url, opt); } catch { throw new Error(store.get('lang', 'ta') === 'en' ? 'Cannot reach the server' : 'சர்வருடன் இணைக்க முடியவில்லை'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'பிழை ஏற்பட்டது'); e.status = r.status; throw e; }
  return data;
}

function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const passwordEyeIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const passwordEyeOffIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.9"></path><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.2 3.3-.6"></path></svg>';
function passwordToggleButton() {
  const label = t('showPassword');
  return '<button class="password-toggle" type="button" data-password-toggle aria-pressed="false" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + passwordEyeIcon + '</button>';
}
document.querySelectorAll('[data-password-toggle]').forEach((button) => { button.innerHTML = passwordEyeIcon; });
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-password-toggle]');
  if (!button) return;
  const input = button.parentElement.querySelector('input');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const visible = input.type === 'text';
  const label = t(visible ? 'hidePassword' : 'showPassword');
  button.innerHTML = visible ? passwordEyeOffIcon : passwordEyeIcon;
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', label);
  button.title = label;
});

const fmtDate = (iso) => new Date(iso).toLocaleString(store.get('lang', 'ta') === 'en' ? 'en-IN' : 'ta-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
