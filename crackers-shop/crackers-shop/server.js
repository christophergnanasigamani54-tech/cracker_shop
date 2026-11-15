'use strict';
/*
 * பட்டாசு கடை மென்பொருள் - Crackers Shop Server
 * Zero dependencies. Node.js 24 LTS. Data stored in data/db.json
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const seed = require('./seed');

const PORT = Number(process.env.PORT) || 5280;
const HOST = process.env.HOST || '127.0.0.1'; // localhost only. Use HOST=0.0.0.0 to allow shop LAN.
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PRODUCT_IMAGE_DIR = path.join(DATA_DIR, 'product-images');
const SHOP_IMAGE_DIR = path.join(DATA_DIR, 'shop-images');
const PID_FILE = path.join(DATA_DIR, 'server.pid');

fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
fs.mkdirSync(SHOP_IMAGE_DIR, { recursive: true });

/* ---------- password helpers ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return salt + ':' + h;
}
function checkPassword(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const test = crypto.scryptSync(String(pw), salt, 32);
  const real = Buffer.from(h, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

/* ---------- database ---------- */
function defaultDb() {
  return {
    settings: {
      shopName: 'ஸ்ரீ முருகன் பட்டாசு கடை',
      shopNameEn: 'Sri Murugan Crackers Shop',
      tagline: 'தரமான பட்டாசுகள் • நேரடி தொழிற்சாலை விலை',
      taglineEn: 'Quality crackers • Direct factory price',
      phone: '9999999999',
      whatsapp: '',
      address: 'மெயின் ரோடு, சிவகாசி',
      addressEn: 'Main Road, Sivakasi',
      licenseNo: '',
      gstNo: '',
      discount: 50,
      minOrder: 0,
      deliveryArea: '',
      deliveryInfo: '',
      checkoutNote: '',
      checkoutNoteEn: '',
      logo: '',
      festivalTitle: 'தீபாவளி சிறப்பு விற்பனை',
      festivalTitleEn: 'Diwali Special Sale',
      adminHash: hashPassword('admin123'),
      defaultPassword: true,
    },
    categories: seed.categories,
    products: seed.products,
    customers: [],
    orders: [],
    bills: [],
    counters: { product: seed.products.length, order: 0, bill: 0, customer: 0 },
  };
}

let db;
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return;
    } catch (e) {
      const bad = DB_FILE + '.corrupt-' + Date.now();
      fs.renameSync(DB_FILE, bad);
      console.error('db.json சேதமடைந்துள்ளது. நகல்:', bad);
    }
  }
  db = defaultDb();
  saveDb();
}
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function productImageBackup() {
  const images = [...new Set([...db.products.map((p) => p.image), db.settings.logo].filter(Boolean))];
  return images.map((image) => {
    const isShopLogo = /^\/shop-images\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(image);
    const directory = isShopLogo ? SHOP_IMAGE_DIR : PRODUCT_IMAGE_DIR;
    const filename = path.basename(image);
    return { path: image, data: fs.readFileSync(path.join(directory, filename)).toString('base64') };
  });
}
function dailyBackup() {
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const f = path.join(BACKUP_DIR, 'db-' + stamp + '.json');
  if (!fs.existsSync(f) && fs.existsSync(DB_FILE)) {
    fs.writeFileSync(f, JSON.stringify({ ...db, productImages: productImageBackup() }, null, 2));
  }
  // keep last 30
  const files = fs.readdirSync(BACKUP_DIR).filter((x) => x.startsWith('db-')).sort();
  while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
}
loadDb();
// fill fields added in newer versions (English names) for existing databases
(function migrate() {
  const d = defaultDb();
  let changed = false;
  for (const k of ['shopNameEn', 'taglineEn', 'addressEn', 'festivalTitleEn', 'deliveryArea', 'deliveryInfo', 'checkoutNote', 'checkoutNoteEn', 'logo']) {
    if (db.settings[k] === undefined) { db.settings[k] = d.settings[k]; changed = true; }
  }
  for (const c of db.categories) {
    const s = seed.categories.find((x) => x.id === c.id);
    if (c.nameEn === undefined && s) { c.nameEn = s.nameEn; changed = true; }
  }
  if (!Array.isArray(db.customers)) { db.customers = []; changed = true; }
  if (!db.counters) { db.counters = d.counters; changed = true; }
  const maxCustomerId = Math.max(0, ...db.customers.map((c) => Number(c.id) || 0));
  if (!Number.isSafeInteger(db.counters.customer) || db.counters.customer < maxCustomerId) {
    db.counters.customer = maxCustomerId;
    changed = true;
  }
  if (changed) saveDb();
})();
dailyBackup();
setInterval(dailyBackup, 6 * 3600 * 1000).unref();

/* ---------- pricing ---------- */
const unitPrice = (p) => {
  const d = p.discount === null || p.discount === undefined || p.discount === '' ? db.settings.discount : Number(p.discount);
  return Math.max(0, Math.round(p.mrp * (1 - d / 100)));
};
const msg = (lang, ta, en) => (lang === 'en' ? en : ta);
const langOf = (req) => (req.headers['x-lang'] === 'en' ? 'en' : 'ta');
const pad = (n, w = 4) => String(n).padStart(w, '0');
const clampInt = (v, min, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
const normalizePhone = (v) => {
  let digits = str(v, 20).replace(/\D/g, '');
  if (digits.startsWith('0091') && digits.length === 14) digits = digits.slice(4);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
};

/* ---------- sessions ---------- */
const sessions = new Map();
const SESSION_MS = 8 * 3600 * 1000;
const fails = new Map(); // ip -> {n, until}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function getSession(req) {
  const t = parseCookies(req).sid;
  const s = t && sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  s.exp = Date.now() + SESSION_MS;
  return t;
}
function sessionFor(req, role) {
  const sid = getSession(req);
  const session = sid && sessions.get(sid);
  return session && session.role === role ? session : null;
}
function setSessionCookie(res, sid) {
  return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_MS / 1000 });
}
function startSession(role, customerId) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { role, customerId, exp: Date.now() + SESSION_MS });
  return sid;
}
function customerView(customer) {
  const { id, name, email, phone, address } = customer;
  return { id, name, email, phone, address };
}

/* ---------- http helpers ---------- */
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}
// English versions of the fixed Tamil error messages (used when the browser sends X-Lang: en)
const EN_ERR = {
  'JSON மட்டும்': 'JSON only',
  'இல்லை': 'Not found',
  'தவறான தரவு': 'Invalid data',
  'தரவு மிகப் பெரியது': 'Data too large',
  'சிறிது நேரம் கழித்து முயற்சிக்கவும்': 'Too many attempts. Please try again in a minute',
  'கடவுச்சொல் தவறு': 'Incorrect password',
  'உள்நுழைய வேண்டும்': 'Please log in',
  'பொருள் இல்லை': 'Product not found',
  'ஆர்டர் இல்லை': 'Order not found',
  'தவறான நிலை': 'Invalid status',
  'தற்போதைய கடவுச்சொல் தவறு': 'Current password is incorrect',
  'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள்': 'New password must be at least 6 characters',
  'வழங்கப்பட்ட ஆர்டரை ரத்து செய்ய முடியாது': 'A delivered order cannot be cancelled',
  'ரத்து செய்யப்பட்ட ஆர்டரை மீண்டும் திறக்க முடியாது': 'Cancelled order cannot be reopened because there is not enough stock',
  'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்': 'Please log in to your customer account',
  'பெயர் மற்றும் கடவுச்சொல் தேவை': 'Name and password are required',
  'சரியான மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்': 'Enter a valid email address or phone number',
  'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்': 'Password must be at least 8 characters',
  'இந்த மின்னஞ்சல் அல்லது தொலைபேசி ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது': 'This email or phone number is already registered',
  'படம் JPG, PNG அல்லது WebP வடிவில் இருக்க வேண்டும்': 'Photo must be a JPG, PNG, or WebP image',
  'படம் 700 KB-க்கு குறைவாக இருக்க வேண்டும்': 'Photo must be smaller than 700 KB',
  'படத்தின் அளவு 5000 × 5000 பிக்சல்களைத் தாண்டக்கூடாது': 'Photo dimensions must not exceed 5000 × 5000 pixels',
  'தவறான படம்': 'Invalid image file',
  'மின்னஞ்சல் அல்லது தொலைபேசி எண் மற்றும் கடவுச்சொல் தேவை': 'Email or phone number and password are required',
  'உள்நுழைவு விவரங்கள் தவறு': 'Incorrect sign-in details',
  'பெயர் தேவை': 'Name is required',
  'MRP விலை தேவை': 'MRP price is required',
  'வகை தவறு': 'Invalid category',
  'சர்வர் பிழை': 'Server error',
};
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new HttpError(413, 'தரவு மிகப் பெரியது')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected a JSON object');
        resolve(body);
      }
      catch { reject(new HttpError(400, 'தவறான தரவு')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp',
};
function readStoredImage(req, res, filename, directory) {
  const ext = path.extname(filename).toLowerCase();
  fs.readFile(path.join(directory, filename), (err, image) => {
    if (err) return send(res, 404, '404 - Image not found');
    res.writeHead(200, {
      'Content-Type': MIME[ext],
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : image);
  });
}
function storeImage(dataUrl, directory, urlPrefix) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ''));
  if (!match) throw new HttpError(400, 'படம் JPG, PNG அல்லது WebP வடிவில் இருக்க வேண்டும்');
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > 700 * 1024 || image.toString('base64') !== match[2]) {
    throw new HttpError(400, 'படம் 700 KB-க்கு குறைவாக இருக்க வேண்டும்');
  }
  const type = match[1];
  const valid = type === 'jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : type === 'png'
      ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new HttpError(400, 'தவறான படம்');
  let width, height;
  if (type === 'png' && image.length >= 24) {
    width = image.readUInt32BE(16);
    height = image.readUInt32BE(20);
  } else if (type === 'webp' && image.length >= 25) {
    const chunk = image.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && image.length >= 30) {
      width = 1 + image.readUIntLE(24, 3);
      height = 1 + image.readUIntLE(27, 3);
    } else if (chunk === 'VP8L' && image[20] === 0x2f) {
      width = 1 + image[21] + ((image[22] & 0x3f) << 8);
      height = 1 + (image[22] >> 6) + (image[23] << 2) + ((image[24] & 0x0f) << 10);
    } else if (chunk === 'VP8 ' && image.length >= 30 && image[23] === 0x9d && image[24] === 0x01 && image[25] === 0x2a) {
      width = image.readUInt16LE(26) & 0x3fff;
      height = image.readUInt16LE(28) & 0x3fff;
    }
  } else if (type === 'jpeg') {
    const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 4 <= image.length) {
      if (image[offset] !== 0xff) break;
      while (image[offset] === 0xff) offset++;
      const marker = image[offset++];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > image.length) break;
      const length = image.readUInt16BE(offset);
      if (length < 2 || offset + length > image.length) break;
      if (frameMarkers.has(marker) && length >= 7) {
        height = image.readUInt16BE(offset + 3);
        width = image.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (!width || !height) throw new HttpError(400, 'தவறான படம்');
  if (width > 5000 || height > 5000 || width * height > 25_000_000) {
    throw new HttpError(400, 'படத்தின் அளவு 5000 × 5000 பிக்சல்களைத் தாண்டக்கூடாது');
  }
  const ext = type === 'jpeg' ? '.jpg' : '.' + type;
  const filename = crypto.randomBytes(16).toString('hex') + ext;
  fs.writeFileSync(path.join(directory, filename), image, { flag: 'wx' });
  return urlPrefix + filename;
}
function removeStoredImage(imageUrl, prefix, directory) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp('^' + escapedPrefix + '([a-f0-9]{32}\\.(?:jpg|png|webp))$').exec(String(imageUrl || ''));
  if (match) fs.rmSync(path.join(directory, match[1]), { force: true });
}
function storeProductImage(dataUrl) {
  return storeImage(dataUrl, PRODUCT_IMAGE_DIR, '/product-images/');
}
function removeProductImage(imageUrl) {
  removeStoredImage(imageUrl, '/product-images/', PRODUCT_IMAGE_DIR);
}
function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
  let file;
  try { file = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname))); } catch { return send(res, 400, 'Bad request'); }
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, '404 - பக்கம் கிடைக்கவில்லை');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buf);
  });
}

/* ---------- public views ---------- */
function publicSettings() {
  const { adminHash, defaultPassword, ...rest } = db.settings;
  return rest;
}
function publicProducts() {
  return db.products.filter((p) => p.active).map((p) => ({
    id: p.id, name: p.name, nameEn: p.nameEn, category: p.category, emoji: p.emoji, unit: p.unit,
    mrp: p.mrp, price: unitPrice(p), stock: p.stock, popular: p.popular, image: p.image || '',
  }));
}

/* ---------- order / bill building ---------- */
function buildLines(items, { checkStock = true, activeOnly = true, lang = 'ta' } = {}) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, msg(lang, 'பொருட்கள் எதுவும் இல்லை', 'No items selected'));
  if (items.length > 200) throw new HttpError(400, msg(lang, 'அதிகமான பொருட்கள்', 'Too many items'));
  const merged = new Map();
  for (const it of items) {
    if (!it || typeof it !== 'object') throw new HttpError(400, msg(lang, 'தவறான தரவு', 'Invalid data'));
    const id = Number(it.id), qty = Number(it.qty);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(qty) || qty <= 0 || qty > 9999) {
      throw new HttpError(400, msg(lang, 'தவறான தரவு', 'Invalid data'));
    }
    const totalQty = (merged.get(id) || 0) + qty;
    if (totalQty > 9999) throw new HttpError(400, msg(lang, 'தவறான தரவு', 'Invalid data'));
    merged.set(id, totalQty);
  }
  const lines = [];
  for (const [id, qty] of merged) {
    const p = db.products.find((x) => x.id === id);
    if (!p || (activeOnly && !p.active)) throw new HttpError(400, msg(lang, 'பொருள் கிடைக்கவில்லை (#' + id + ')', 'Item not available (#' + id + ')'));
    if (checkStock && p.stock < qty) throw new HttpError(400, msg(lang, p.name + ' - இருப்பு ' + p.stock + ' மட்டுமே', (p.nameEn || p.name) + ' - only ' + p.stock + ' in stock'));
    const price = unitPrice(p);
    lines.push({ id, name: p.name, nameEn: p.nameEn || '', unit: p.unit, mrp: p.mrp, price, qty, amount: price * qty });
  }
  return lines;
}
const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
function takeStock(lines, sign) {
  for (const l of lines) {
    const p = db.products.find((x) => x.id === l.id);
    if (p) p.stock = Math.max(0, p.stock - sign * l.qty);
  }
}

/* ---------- API ---------- */
async function api(req, res, pathname, query) {
  const method = req.method;
  const isWrite = method !== 'GET' && method !== 'HEAD';
  if (isWrite && !String(req.headers['content-type'] || '').startsWith('application/json') && method !== 'DELETE') {
    throw new HttpError(415, 'JSON மட்டும்');
  }

  /* ----- public ----- */
  if (method === 'GET' && pathname === '/api/public') {
    return send(res, 200, { settings: publicSettings(), categories: db.categories, products: publicProducts() });
  }
  if (method === 'POST' && pathname === '/api/orders') {
    const lang = langOf(req);
    const customerSession = sessionFor(req, 'customer');
    if (!customerSession) throw new HttpError(401, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்');
    const b = await readBody(req);
    const name = str(b.name, 60), phone = normalizePhone(b.phone), address = str(b.address, 300), note = str(b.note, 300);
    if (name.length < 2) throw new HttpError(400, msg(lang, 'பெயரை உள்ளிடவும்', 'Please enter your name'));
    if (phone.length < 10) throw new HttpError(400, msg(lang, 'சரியான மொபைல் எண்ணை உள்ளிடவும்', 'Please enter a valid mobile number'));
    if (address.length < 5) throw new HttpError(400, msg(lang, 'முகவரியை உள்ளிடவும்', 'Please enter your address'));
    const lines = buildLines(b.items, { lang });
    const subtotal = sum(lines, 'amount');
    if (subtotal < db.settings.minOrder) throw new HttpError(400, msg(lang, 'குறைந்தபட்ச ஆர்டர் ₹' + db.settings.minOrder, 'Minimum order is ₹' + db.settings.minOrder));
    const order = {
      id: 'ORD-' + pad(++db.counters.order),
      createdAt: new Date().toISOString(),
      status: 'new',
      customerId: customerSession.customerId,
      customer: { name, phone, address },
      note, lines, mrpTotal: lines.reduce((a, l) => a + l.mrp * l.qty, 0), total: subtotal,
    };
    takeStock(lines, 1);
    db.orders.unshift(order);
    saveDb();
    return send(res, 200, { ok: true, order: { id: order.id, total: order.total } });
  }

  /* ----- auth ----- */
  if (method === 'POST' && pathname === '/api/customer/register') {
    const b = await readBody(req);
    const name = str(b.name, 60);
    const phone = normalizePhone(b.phone);
    const email = str(b.email, 254).toLowerCase();
    const password = String(b.password || '');
    if (name.length < 2 || password.length < 8 || password.length > 100) {
      throw new HttpError(400, name.length < 2 ? 'பெயர் மற்றும் கடவுச்சொல் தேவை' : 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்');
    }
    if (phone && (phone.length < 10 || phone.length > 15)) throw new HttpError(400, 'சரியான மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'சரியான மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்');
    if (!phone && !email) throw new HttpError(400, 'சரியான மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்');
    if (db.customers.some((c) => (email && c.email === email) || (phone && c.phone === phone))) {
      throw new HttpError(409, 'இந்த மின்னஞ்சல் அல்லது தொலைபேசி ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது');
    }
    const customer = {
      id: ++db.counters.customer, name, phone, email, address: str(b.address, 300),
      passwordHash: hashPassword(password), createdAt: new Date().toISOString(),
    };
    db.customers.push(customer);
    saveDb();
    return setSessionCookie(res, startSession('customer', customer.id));
  }
  if (method === 'POST' && pathname === '/api/customer/login') {
    const ip = 'customer:' + req.socket.remoteAddress;
    const f = fails.get(ip);
    if (f && f.until > Date.now()) throw new HttpError(429, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்');
    const b = await readBody(req);
    const identifier = str(b.identifier, 254).toLowerCase();
    const customer = identifier.includes('@')
      ? db.customers.find((c) => c.email === identifier)
      : db.customers.find((c) => c.phone === normalizePhone(identifier));
    if (!customer || !checkPassword(b.password, customer.passwordHash)) {
      const n = (f ? f.n : 0) + 1;
      fails.set(ip, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
      throw new HttpError(401, 'உள்நுழைவு விவரங்கள் தவறு');
    }
    fails.delete(ip);
    return setSessionCookie(res, startSession('customer', customer.id));
  }
  if (method === 'POST' && pathname === '/api/customer/logout') {
    const t = parseCookies(req).sid;
    if (t) sessions.delete(t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (method === 'GET' && pathname === '/api/customer/me') {
    const session = sessionFor(req, 'customer');
    const customer = session && db.customers.find((c) => c.id === session.customerId);
    return send(res, 200, customer ? { loggedIn: true, customer: customerView(customer) } : { loggedIn: false });
  }
  if (method === 'GET' && pathname === '/api/customer/orders') {
    const session = sessionFor(req, 'customer');
    if (!session) throw new HttpError(401, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்');
    return send(res, 200, { orders: db.orders.filter((o) => o.customerId === session.customerId) });
  }
  if (method === 'POST' && pathname === '/api/login') {
    const ip = req.socket.remoteAddress;
    const f = fails.get(ip);
    if (f && f.until > Date.now()) throw new HttpError(429, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்');
    const b = await readBody(req);
    if (!checkPassword(b.password, db.settings.adminHash)) {
      const n = (f ? f.n : 0) + 1;
      fails.set(ip, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
      throw new HttpError(401, 'கடவுச்சொல் தவறு');
    }
    fails.delete(ip);
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { role: 'admin', exp: Date.now() + SESSION_MS });
    return setSessionCookie(res, sid);
  }
  if (method === 'POST' && pathname === '/api/logout') {
    const t = parseCookies(req).sid;
    if (t) sessions.delete(t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (method === 'GET' && pathname === '/api/me') {
    return send(res, 200, { loggedIn: !!sessionFor(req, 'admin') });
  }

  /* ----- admin (auth required) ----- */
  if (!pathname.startsWith('/api/admin/')) throw new HttpError(404, 'இல்லை');
  if (!sessionFor(req, 'admin')) throw new HttpError(401, 'உள்நுழைய வேண்டும்');

  if (method === 'GET' && pathname === '/api/admin/data') {
    const { adminHash, ...settings } = db.settings;
    return send(res, 200, {
      settings, categories: db.categories,
      products: db.products.map((p) => ({ ...p, price: unitPrice(p) })),
      orders: db.orders, bills: db.bills,
    });
  }

  // products
  if (method === 'POST' && pathname === '/api/admin/products') {
    const b = await readBody(req);
    const p = cleanProduct(b);
    p.id = ++db.counters.product;
    db.products.push(p);
    saveDb();
    return send(res, 200, { ok: true, product: p });
  }
  let m = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
  if (m) {
    const idx = db.products.findIndex((x) => x.id === Number(m[1]));
    if (idx < 0) throw new HttpError(404, 'பொருள் இல்லை');
    if (method === 'PUT') {
      const b = await readBody(req);
      const previousImage = db.products[idx].image;
      const p = cleanProduct(b, previousImage);
      p.id = db.products[idx].id;
      db.products[idx] = p;
      saveDb();
      if (previousImage && previousImage !== p.image) removeProductImage(previousImage);
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE') {
      const image = db.products[idx].image;
      db.products.splice(idx, 1);
      saveDb();
      removeProductImage(image);
      return send(res, 200, { ok: true });
    }
  }

  // counter bill
  if (method === 'POST' && pathname === '/api/admin/bills') {
    const b = await readBody(req);
    const lines = buildLines(b.items, { activeOnly: false });
    const subtotal = sum(lines, 'amount');
    const extra = Math.min(subtotal, clampInt(b.extraDiscount, 0, 10000000));
    const pay = ['cash', 'upi', 'card'].includes(b.payment) ? b.payment : 'cash';
    const bill = {
      id: 'BILL-' + pad(++db.counters.bill),
      createdAt: new Date().toISOString(),
      customer: { name: str(b.name, 60), phone: str(b.phone, 15) },
      payment: pay, lines, mrpTotal: lines.reduce((a, l) => a + l.mrp * l.qty, 0),
      subtotal, extraDiscount: extra, total: subtotal - extra,
    };
    takeStock(lines, 1);
    db.bills.unshift(bill);
    saveDb();
    return send(res, 200, { ok: true, bill });
  }

  // order status
  m = pathname.match(/^\/api\/admin\/orders\/(ORD-\d+)$/);
  if (m && method === 'PUT') {
    const o = db.orders.find((x) => x.id === m[1]);
    if (!o) throw new HttpError(404, 'ஆர்டர் இல்லை');
    const b = await readBody(req);
    if (!['new', 'confirmed', 'packed', 'delivered', 'cancelled'].includes(b.status)) throw new HttpError(400, 'தவறான நிலை');
    if (o.status === 'delivered' && b.status === 'cancelled') throw new HttpError(400, 'வழங்கப்பட்ட ஆர்டரை ரத்து செய்ய முடியாது');
    if (o.status === 'cancelled' && b.status !== 'cancelled') {
      const canRestore = o.lines.every((line) => {
        const p = db.products.find((x) => x.id === line.id);
        return p && p.stock >= line.qty;
      });
      if (!canRestore) throw new HttpError(400, 'ரத்து செய்யப்பட்ட ஆர்டரை மீண்டும் திறக்க முடியாது');
    }
    if (b.status === 'cancelled' && o.status !== 'cancelled') takeStock(o.lines, -1); // restore stock
    if (o.status === 'cancelled' && b.status !== 'cancelled') takeStock(o.lines, 1);
    o.status = b.status;
    saveDb();
    return send(res, 200, { ok: true });
  }

  // settings
  if (method === 'PUT' && pathname === '/api/admin/settings') {
    const b = await readBody(req);
    const s = db.settings;
    const previousLogo = s.logo || '';
    const nextLogo = b.logoDataUrl
      ? storeImage(b.logoDataUrl, SHOP_IMAGE_DIR, '/shop-images/')
      : b.removeLogo ? '' : previousLogo;
    s.shopName = str(b.shopName, 80) || s.shopName;
    s.tagline = str(b.tagline, 120);
    s.festivalTitle = str(b.festivalTitle, 80);
    s.shopNameEn = str(b.shopNameEn, 80);
    s.taglineEn = str(b.taglineEn, 120);
    s.festivalTitleEn = str(b.festivalTitleEn, 80);
    s.addressEn = str(b.addressEn, 200);
    s.deliveryArea = str(b.deliveryArea, 200);
    s.deliveryInfo = str(b.deliveryInfo, 500);
    s.checkoutNote = str(b.checkoutNote, 500);
    s.checkoutNoteEn = str(b.checkoutNoteEn, 500);
    s.phone = str(b.phone, 30);
    s.whatsapp = str(b.whatsapp, 15).replace(/\D/g, '');
    s.address = str(b.address, 200);
    s.licenseNo = str(b.licenseNo, 60);
    s.gstNo = str(b.gstNo, 30);
    s.discount = clampInt(b.discount, 0, 95);
    s.minOrder = clampInt(b.minOrder, 0, 10000000);
    s.logo = nextLogo;
    saveDb();
    if (previousLogo && previousLogo !== nextLogo) removeStoredImage(previousLogo, '/shop-images/', SHOP_IMAGE_DIR);
    return send(res, 200, { ok: true });
  }
  if (method === 'POST' && pathname === '/api/admin/password') {
    const b = await readBody(req);
    if (!checkPassword(b.current, db.settings.adminHash)) throw new HttpError(400, 'தற்போதைய கடவுச்சொல் தவறு');
    if (str(b.next, 100).length < 6) throw new HttpError(400, 'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள்');
    db.settings.adminHash = hashPassword(String(b.next));
    db.settings.defaultPassword = false;
    saveDb();
    return send(res, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/api/admin/backup') {
    const backup = {
      ...db,
      settings: { ...db.settings, adminHash: undefined },
      customers: db.customers.map(({ passwordHash, ...customer }) => customer),
      productImages: productImageBackup(),
    };
    return send(res, 200, JSON.stringify(backup, null, 2), {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crackers-backup-' + new Date().toISOString().slice(0, 10) + '.json"',
    });
  }

  throw new HttpError(404, 'இல்லை');
}

function cleanProduct(b, existingImage = '') {
  const name = str(b.name, 100);
  if (!name) throw new HttpError(400, 'பெயர் தேவை');
  const mrp = clampInt(b.mrp, 0, 10000000);
  if (mrp <= 0) throw new HttpError(400, 'MRP விலை தேவை');
  let discount = null;
  if (b.discount !== null && b.discount !== undefined && b.discount !== '') discount = clampInt(b.discount, 0, 95);
  if (!db.categories.some((c) => c.id === b.category)) throw new HttpError(400, 'வகை தவறு');
  const product = {
    name, nameEn: str(b.nameEn, 100), category: b.category, emoji: str(b.emoji, 8) || '🎆',
    mrp, discount, unit: str(b.unit, 30) || 'பெட்டி', stock: clampInt(b.stock, 0, 10000000),
    popular: !!b.popular, active: b.active !== false,
  };
  product.image = b.imageDataUrl ? storeProductImage(b.imageDataUrl) : b.removeImage ? '' : existingImage;
  return product;
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const productImage = url.pathname.match(/^\/product-images\/([a-f0-9]{32}\.(?:jpg|png|webp))$/);
    const shopImage = url.pathname.match(/^\/shop-images\/([a-f0-9]{32}\.(?:jpg|png|webp))$/);
    if (productImage && (req.method === 'GET' || req.method === 'HEAD')) readStoredImage(req, res, productImage[1], PRODUCT_IMAGE_DIR);
    else if (shopImage && (req.method === 'GET' || req.method === 'HEAD')) readStoredImage(req, res, shopImage[1], SHOP_IMAGE_DIR);
    else if (url.pathname.startsWith('/api/')) await api(req, res, url.pathname, url.searchParams);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url.pathname);
    else send(res, 405, 'Method not allowed');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: langOf(req) === 'en' ? (EN_ERR[e.message] || e.message) : e.message });
    console.error(e);
    send(res, 500, { error: langOf(req) === 'en' ? EN_ERR['சர்வர் பிழை'] : 'சர்வர் பிழை' });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('\nPort ' + PORT + ' ஏற்கனவே பயன்பாட்டில் உள்ளது. சர்வர் ஏற்கனவே ஓடிக்கொண்டிருக்கலாம் (stop.bat ஓட்டவும்).');
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const h = HOST === '0.0.0.0' ? 'localhost' : HOST === '127.0.0.1' ? 'localhost' : HOST;
  console.log('\n  🎆 பட்டாசு கடை சர்வர் தொடங்கியது');
  console.log('  கடை இணையதளம் : http://' + h + ':' + PORT + '/');
  console.log('  Admin / பில்லிங்  : http://' + h + ':' + PORT + '/admin');
  console.log('  (நிறுத்த: Ctrl+C அல்லது stop.bat)\n');
  try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch { /* ignore */ }
});

process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ } });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveDb(); process.exit(0); });
