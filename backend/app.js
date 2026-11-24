'use strict';
/*
 * பட்டாசு கடை மென்பொருள் - Crackers Shop Server
 * Node.js 24 LTS. PostgreSQL data with JSON backup files.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const { pool, DATABASE_URL } = require('./config/database');
const seed = require('./models/seed');
const HttpError = require('./middleware/http-error');
const { createEmailSender } = require('./services/email-service');
const { hashPassword, checkPassword } = require('./services/password-service');
const { resolveStaticRoute } = require('./routes/static-routes');
const { isWithinExportDates, orderCategories, calculateStockAdjustment } = require('./utils/data-utils');
const { backupImages } = require('./utils/image-backup');

const PORT = Number(process.env.PORT) || 5280;
const HOST = process.env.HOST || '127.0.0.1'; // localhost only. Use HOST=0.0.0.0 to allow shop LAN.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(PROJECT_ROOT, 'frontend');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PRODUCT_IMAGE_DIR = path.join(DATA_DIR, 'product-images');
const SHOP_IMAGE_DIR = path.join(DATA_DIR, 'shop-images');
const PID_FILE = path.join(DATA_DIR, 'server.pid');
let pidFileOwned = false;

fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
fs.mkdirSync(SHOP_IMAGE_DIR, { recursive: true });

/* ---------- database ---------- */
function defaultDb() {
  return {
    settings: {
      shopName: 'ஸ்ரீ முருகன் பட்டாசு கடை',
      shopNameEn: 'Sri Murugan Crackers Shop',
      tagline: 'தரமான பட்டாசுகள் • நேரடி தொழிற்சாலை விலை',
      taglineEn: 'Quality crackers • Direct factory price',
      phone: '9999999999',
      adminEmail: '',
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
    stockMovements: [],
    counters: { product: seed.products.length, order: 0, bill: 0, customer: 0, stockMovement: 0 },
  };
}

let db;
let persistedDb = null;
let saveQueue = Promise.resolve();

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_state (
      key text PRIMARY KEY,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_categories (
      id text PRIMARY KEY,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_products (
      id bigint PRIMARY KEY,
      category_id text NOT NULL,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_customers (
      id bigint PRIMARY KEY,
      email text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_orders (
      id text PRIMARY KEY,
      customer_id bigint,
      created_at timestamptz NOT NULL,
      status text NOT NULL,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_bills (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_stock_movements (
      id text PRIMARY KEY,
      product_id bigint NOT NULL,
      created_at timestamptz NOT NULL,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_password_resets (
      token_hash text PRIMARY KEY,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS shop_orders_customer_created_idx
      ON shop_orders (customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS shop_orders_created_idx ON shop_orders (created_at DESC);
    CREATE INDEX IF NOT EXISTS shop_bills_created_idx ON shop_bills (created_at DESC);
    CREATE INDEX IF NOT EXISTS shop_stock_movements_created_idx
      ON shop_stock_movements (created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS shop_stock_movements_product_created_idx
      ON shop_stock_movements (product_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS shop_customers_email_idx ON shop_customers (email);
    CREATE INDEX IF NOT EXISTS shop_customers_phone_idx ON shop_customers (phone);
    CREATE UNIQUE INDEX IF NOT EXISTS shop_customers_email_unique_idx
      ON shop_customers (email) WHERE email <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS shop_customers_phone_unique_idx
      ON shop_customers (phone) WHERE phone <> '';
  `);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function syncRows(client, table, keyColumn, current, previous, upsert, params) {
  const oldRows = new Map((previous || []).map((row) => [row.id, row]));
  const nextRows = new Map(current.map((row) => [row.id, row]));
  for (const row of current) {
    const old = oldRows.get(row.id);
    if (!old || !sameJson(old, row)) await client.query(upsert, params(row));
  }
  for (const id of oldRows.keys()) {
    if (!nextRows.has(id)) await client.query('DELETE FROM ' + table + ' WHERE ' + keyColumn + ' = $1', [id]);
  }
}

async function persistSnapshot(snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = persistedDb;
    for (const key of ['settings', 'counters', 'categoryOrder']) {
      const value = key === 'categoryOrder' ? snapshot.categories.map((category) => category.id) : snapshot[key];
      const previousValue = key === 'categoryOrder'
        ? previous && previous.categories.map((category) => category.id)
        : previous && previous[key];
      if (!previous || !sameJson(previousValue, value)) {
        await client.query(
          'INSERT INTO shop_state (key, data) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data',
          [key, JSON.stringify(value)],
        );
      }
    }
    await syncRows(client, 'shop_categories', 'id', snapshot.categories, previous && previous.categories,
      'INSERT INTO shop_categories (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
      (row) => [row.id, JSON.stringify(row)]);
    await syncRows(client, 'shop_products', 'id', snapshot.products, previous && previous.products,
      'INSERT INTO shop_products (id, category_id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, data = EXCLUDED.data',
      (row) => [row.id, row.category, JSON.stringify(row)]);
    await syncRows(client, 'shop_customers', 'id', snapshot.customers, previous && previous.customers,
      'INSERT INTO shop_customers (id, email, phone, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone, data = EXCLUDED.data',
      (row) => [row.id, row.email || '', row.phone || '', JSON.stringify(row)]);
    await syncRows(client, 'shop_orders', 'id', snapshot.orders, previous && previous.orders,
      'INSERT INTO shop_orders (id, customer_id, created_at, status, data) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, created_at = EXCLUDED.created_at, status = EXCLUDED.status, data = EXCLUDED.data',
      (row) => [row.id, row.customerId || null, row.createdAt, row.status, JSON.stringify(row)]);
    await syncRows(client, 'shop_bills', 'id', snapshot.bills, previous && previous.bills,
      'INSERT INTO shop_bills (id, created_at, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, data = EXCLUDED.data',
      (row) => [row.id, row.createdAt, JSON.stringify(row)]);
    const previousMovementIds = new Set((previous && previous.stockMovements || []).map((movement) => movement.id));
    for (const movement of snapshot.stockMovements || []) {
      if (!previousMovementIds.has(movement.id)) {
        await client.query(
          'INSERT INTO shop_stock_movements (id, product_id, created_at, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING',
          [movement.id, movement.productId, movement.createdAt, JSON.stringify(movement)],
        );
      }
    }
    await client.query('COMMIT');
    persistedDb = snapshot;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function saveDb() {
  const snapshot = structuredClone(db);
  const task = saveQueue.then(() => persistSnapshot(snapshot));
  saveQueue = task.catch(() => {
    if (persistedDb && sameJson(db, snapshot)) db = structuredClone(persistedDb);
  });
  return task;
}

function migrateDb() {
  const defaults = defaultDb();
  let changed = false;
  for (const key of ['shopNameEn', 'taglineEn', 'addressEn', 'festivalTitleEn', 'deliveryArea', 'deliveryInfo', 'checkoutNote', 'checkoutNoteEn', 'logo', 'adminEmail']) {
    if (db.settings[key] === undefined) { db.settings[key] = defaults.settings[key]; changed = true; }
  }
  for (const category of db.categories) {
    const sample = seed.categories.find((item) => item.id === category.id);
    if (category.nameEn === undefined && sample) { category.nameEn = sample.nameEn; changed = true; }
  }
  if (!Array.isArray(db.customers)) { db.customers = []; changed = true; }
  if (!db.counters) { db.counters = defaults.counters; changed = true; }
  if (!Array.isArray(db.stockMovements)) { db.stockMovements = []; changed = true; }
  const maxMovementId = Math.max(0, ...db.stockMovements.map((movement) => Number(String(movement.id).replace(/^STK-/, '')) || 0));
  if (!Number.isSafeInteger(db.counters.stockMovement) || db.counters.stockMovement < maxMovementId) {
    db.counters.stockMovement = maxMovementId;
    changed = true;
  }
  for (const product of db.products) {
    if (!Number.isSafeInteger(product.lowStockThreshold) || product.lowStockThreshold < 0) {
      product.lowStockThreshold = 10;
      changed = true;
    }
  }
  const maxCustomerId = Math.max(0, ...db.customers.map((customer) => Number(customer.id) || 0));
  if (!Number.isSafeInteger(db.counters.customer) || db.counters.customer < maxCustomerId) {
    db.counters.customer = maxCustomerId;
    changed = true;
  }
  return changed;
}

async function initializeDatabase() {
  await ensureSchema();
  await pool.query('DELETE FROM admin_password_resets WHERE expires_at <= NOW()');
  const stateResult = await pool.query('SELECT key, data FROM shop_state');
  if (!stateResult.rows.some((row) => row.key === 'settings')) {
    if (fs.existsSync(DB_FILE)) {
      try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (error) {
        throw new Error('Could not read the existing data/db.json for PostgreSQL migration.', { cause: error });
      }
    } else {
      db = defaultDb();
    }
    persistedDb = null;
    migrateDb();
    await saveDb();
    console.log('PostgreSQL initialized' + (fs.existsSync(DB_FILE) ? ' and existing db.json imported.' : '.'));
    return;
  }

  const state = Object.fromEntries(stateResult.rows.map((row) => [row.key, row.data]));
  if (!state.settings || !state.counters) throw new Error('PostgreSQL shop_state is incomplete.');
  const [categoryRows, products, customers, orders, bills, stockMovements] = await Promise.all([
    pool.query('SELECT id, data FROM shop_categories'),
    pool.query('SELECT data FROM shop_products ORDER BY id'),
    pool.query('SELECT data FROM shop_customers ORDER BY id'),
    pool.query('SELECT data FROM shop_orders ORDER BY created_at DESC, id DESC'),
    pool.query('SELECT data FROM shop_bills ORDER BY created_at DESC, id DESC'),
    pool.query('SELECT data FROM shop_stock_movements ORDER BY created_at DESC, id DESC LIMIT 200'),
  ]);
  const categoryOrder = Array.isArray(state.categoryOrder)
    ? state.categoryOrder
    : seed.categories.map((category) => category.id);
  const orderedCategories = orderCategories(categoryRows.rows.map((row) => row.data), categoryOrder);
  db = {
    settings: state.settings,
    counters: state.counters,
    categories: orderedCategories,
    products: products.rows.map((row) => row.data),
    customers: customers.rows.map((row) => row.data),
    orders: orders.rows.map((row) => row.data),
    bills: bills.rows.map((row) => row.data),
    stockMovements: stockMovements.rows.map((row) => row.data),
  };
  persistedDb = structuredClone(db);
  if (migrateDb() || !Array.isArray(state.categoryOrder)) await saveDb();
}

function productImageBackup() {
  const images = [...db.products.map((p) => p.image), db.settings.logo];
  return backupImages(images, PRODUCT_IMAGE_DIR, SHOP_IMAGE_DIR);
}
async function dailyBackup() {
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const f = path.join(BACKUP_DIR, 'db-' + stamp + '.json');
  if (!fs.existsSync(f)) {
    const movements = await pool.query('SELECT data FROM shop_stock_movements ORDER BY created_at, id');
    fs.writeFileSync(f, JSON.stringify({
      ...db,
      stockMovements: movements.rows.map((row) => row.data),
      productImages: productImageBackup(),
    }, null, 2));
  }
  // keep last 30
  const files = fs.readdirSync(BACKUP_DIR).filter((x) => x.startsWith('db-')).sort();
  while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
}

function exportFilters(query) {
  const startDate = query.get('start');
  const endDate = query.get('end');
  const status = query.get('status') || 'all';
  const payment = query.get('payment') || 'all';
  const startOffset = Number(query.get('startOffset') || 0);
  const endOffset = Number(query.get('endOffset') || 0);
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate))) {
    throw new HttpError(400, 'தவறான தேதி வடிகட்டி');
  }
  if (![startOffset, endOffset].every((offset) => Number.isInteger(offset) && Math.abs(offset) <= 840)) {
    throw new HttpError(400, 'தவறான தேதி வடிகட்டி');
  }
  if (startDate && endDate && startDate > endDate) throw new HttpError(400, 'தவறான தேதி வடிகட்டி');
  if (!['all', 'new', 'confirmed', 'packed', 'delivered', 'cancelled'].includes(status)) {
    throw new HttpError(400, 'தவறான நிலை');
  }
  if (!['all', 'cash', 'upi', 'card'].includes(payment)) throw new HttpError(400, 'தவறான கட்டண முறை');
  return { startDate, endDate, startOffset, endOffset, status, payment };
}

function exportRows(filters) {
  const bills = db.bills.filter((bill) =>
    isWithinExportDates(bill, filters) && (filters.payment === 'all' || bill.payment === filters.payment));
  const orders = db.orders.filter((order) =>
    isWithinExportDates(order, filters) && (filters.status === 'all' || order.status === filters.status));
  const itemSummary = (lines) => (lines || []).map((line) =>
    (line.nameEn || line.name) + ' x ' + line.qty).join('; ');
  return { bills, orders, itemSummary };
}

async function createExportWorkbook(filters) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Crackers Shop';
  workbook.created = new Date();
  const { bills, orders, itemSummary } = exportRows(filters);
  const addSheet = (name, columns, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns.map(([header, key, width, numFmt]) => ({
      header, key, width, style: numFmt ? { numFmt } : undefined,
    }));
    sheet.addRows(rows);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(columns.length).address };
    return sheet;
  };
  addSheet('Export Info', [
    ['Filter', 'filter', 28], ['Value', 'value', 34],
  ], [
    { filter: 'Generated at', value: new Date().toISOString() },
    { filter: 'Start date', value: filters.startDate || 'All dates' },
    { filter: 'End date', value: filters.endDate || 'All dates' },
    { filter: 'Order status', value: filters.status },
    { filter: 'Bill payment method', value: filters.payment },
    { filter: 'Other sheets', value: 'Products, Customers, Categories, Settings, and Counters are not date-filtered.' },
  ]);
  addSheet('Bills', [
    ['Bill ID', 'id', 16], ['Date', 'createdAt', 24, 'yyyy-mm-dd hh:mm'], ['Customer', 'customer', 24],
    ['Phone', 'phone', 18], ['Payment', 'payment', 14], ['Subtotal', 'subtotal', 14],
    ['Discount', 'extraDiscount', 14], ['Total', 'total', 14], ['Items', 'items', 60],
  ], bills.map((bill) => ({
    id: bill.id, createdAt: new Date(bill.createdAt), customer: bill.customer?.name || '',
    phone: bill.customer?.phone || '', payment: bill.payment, subtotal: bill.subtotal,
    extraDiscount: bill.extraDiscount, total: bill.total, items: itemSummary(bill.lines),
  })));
  addSheet('Orders', [
    ['Order ID', 'id', 16], ['Date', 'createdAt', 24, 'yyyy-mm-dd hh:mm'], ['Status', 'status', 16],
    ['Customer', 'customer', 24], ['Phone', 'phone', 18], ['Address', 'address', 40],
    ['Note', 'note', 30], ['Total', 'total', 14], ['Items', 'items', 60],
  ], orders.map((order) => ({
    id: order.id, createdAt: new Date(order.createdAt), status: order.status,
    customer: order.customer?.name || '', phone: order.customer?.phone || '',
    address: order.customer?.address || '', note: order.note || '',
    total: order.total, items: itemSummary(order.lines),
  })));
  addSheet('Products', [
    ['ID', 'id', 10], ['Name', 'name', 30], ['Name (English)', 'nameEn', 30],
    ['Category', 'category', 18], ['MRP', 'mrp', 14], ['Discount %', 'discount', 14],
    ['Unit', 'unit', 20], ['Stock', 'stock', 12], ['Active', 'active', 12],
    ['Popular', 'popular', 12], ['Image', 'image', 40],
  ], db.products.map((product) => ({ ...product, image: product.image || '' })));
  addSheet('Customers', [
    ['ID', 'id', 10], ['Name', 'name', 24], ['Phone', 'phone', 18],
    ['Email', 'email', 32], ['Address', 'address', 40], ['Created', 'createdAt', 24, 'yyyy-mm-dd hh:mm'],
  ], db.customers.map(({ passwordHash, ...customer }) => ({
    ...customer, createdAt: customer.createdAt ? new Date(customer.createdAt) : '',
  })));
  addSheet('Categories', [
    ['ID', 'id', 18], ['Name', 'name', 24], ['Name (English)', 'nameEn', 24], ['Emoji', 'emoji', 12],
  ], db.categories);
  const { adminHash, defaultPassword, adminEmail, ...settings } = db.settings;
  addSheet('Settings', [['Setting', 'key', 28], ['Value', 'value', 60]],
    Object.entries(settings).map(([key, value]) => ({ key, value: value === null ? '' : String(value) })));
  addSheet('Counters', [['Counter', 'key', 24], ['Value', 'value', 18]],
    Object.entries(db.counters).map(([key, value]) => ({ key, value })));
  return workbook.xlsx.writeBuffer();
}

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
const SESSION_COOKIE = { admin: 'adminSid', customer: 'customerSid' };
const passwordResetRequests = new Map();
const PASSWORD_RESET_MS = 30 * 60 * 1000;
const customerRegistrationOtps = new Map();
const customerProfileChangeOtps = new Map();
const customerOtpRequestLimits = new Map();
const customerOtpHashKey = crypto.randomBytes(32);
const CUSTOMER_OTP_TTL_MS = 10 * 60 * 1000;
const CUSTOMER_OTP_RESEND_MS = 60 * 1000;
const CUSTOMER_OTP_MAX_ATTEMPTS = 5;
const CUSTOMER_OTP_RATE_WINDOW_MS = 15 * 60 * 1000;

function createEmailMailer(errorMessage) {
  const host = String(process.env.SMTP_HOST || '').trim();
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
  const username = String(process.env.SMTP_USER || '').trim();
  const password = String(process.env.SMTP_PASS || '');
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secureSetting = String(process.env.SMTP_SECURE || '').toLowerCase();
  if (!from || (!resendApiKey && !host) ||
      (host && (!Number.isInteger(port) || port < 1 || port > 65535 ||
        (!!username !== !!password) || (secureSetting && !['true', 'false'].includes(secureSetting))))) {
    throw new HttpError(503, errorMessage);
  }
  return createEmailSender({
    from,
    resendApiKey,
    smtp: {
      host, port,
      secure: secureSetting ? secureSetting === 'true' : port === 465,
      ...(username ? { user: username, pass: password } : {}),
    },
  });
}

function passwordResetMailer(lang = 'ta') {
  let baseUrl;
  try { baseUrl = new URL(process.env.PUBLIC_BASE_URL || ''); }
  catch { throw new HttpError(503, msg(lang, 'கடவுச்சொல் மீட்பு மின்னஞ்சல் அமைக்கப்படவில்லை', 'Password recovery email is not configured')); }
  const localHttp = baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseUrl.hostname);
  if ((baseUrl.protocol !== 'https:' && !localHttp) || baseUrl.username || baseUrl.password) {
    throw new HttpError(503, msg(lang, 'கடவுச்சொல் மீட்பு மின்னஞ்சல் அமைக்கப்படவில்லை', 'Password recovery email is not configured'));
  }
  return {
    ...createEmailMailer(msg(lang, 'கடவுச்சொல் மீட்பு மின்னஞ்சல் அமைக்கப்படவில்லை', 'Password recovery email is not configured')),
    baseUrl,
  };
}

function customerOtpMailer(lang) {
  return createEmailMailer(msg(lang, 'மின்னஞ்சல் சரிபார்ப்பு அமைக்கப்படவில்லை', 'Email verification is not configured'));
}

function customerOtpHash(email, code) {
  return crypto.createHmac('sha256', customerOtpHashKey).update(email + ':' + code).digest();
}

function allowCustomerOtpRequest(ip) {
  const now = Date.now();
  for (const [key, request] of customerOtpRequestLimits) {
    if (request.expiresAt <= now) customerOtpRequestLimits.delete(key);
  }
  const request = customerOtpRequestLimits.get(ip);
  if (request && request.count >= 5) return false;
  customerOtpRequestLimits.set(ip, request
    ? { count: request.count + 1, expiresAt: request.expiresAt }
    : { count: 1, expiresAt: now + CUSTOMER_OTP_RATE_WINDOW_MS });
  return true;
}

async function sendCustomerRegistrationOtp(email, pending, lang) {
  const mailer = customerOtpMailer(lang);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const now = Date.now();
  pending.codeHash = customerOtpHash(email, code);
  pending.expiresAt = now + CUSTOMER_OTP_TTL_MS;
  pending.resendAfter = now + CUSTOMER_OTP_RESEND_MS;
  pending.attempts = 0;
  customerRegistrationOtps.set(email, pending);
  try {
    await mailer.sendMail({
      to: email,
      subject: msg(lang, 'பட்டாசு கடை கணக்கு மின்னஞ்சல் சரிபார்ப்பு', 'Verify your Crackers Shop email'),
      text: msg(lang,
        'உங்கள் மின்னஞ்சல் சரிபார்ப்பு குறியீடு: ' + code + '\nஇந்தக் குறியீடு 10 நிமிடங்களில் காலாவதியாகும். நீங்கள் இதைக் கோரவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கவும்.',
        'Your email verification code is: ' + code + '\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.'),
    });
  } catch (error) {
    customerRegistrationOtps.delete(email);
    console.error('Could not send customer verification email:', error);
    throw new HttpError(503, msg(lang, 'சரிபார்ப்பு மின்னஞ்சலை அனுப்ப முடியவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.', 'Could not send the verification email. Please try again later.'));
  }
}

async function sendCustomerProfileChangeOtp(customerId, email, profile, lang) {
  const mailer = customerOtpMailer(lang);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const pending = {
    email,
    profile: { ...profile },
    codeHash: customerOtpHash(email, code),
    expiresAt: Date.now() + CUSTOMER_OTP_TTL_MS,
    resendAfter: Date.now() + CUSTOMER_OTP_RESEND_MS,
    attempts: 0,
  };
  const previous = customerProfileChangeOtps.get(customerId);
  customerProfileChangeOtps.set(customerId, pending);
  try {
    await mailer.sendMail({
      to: email,
      subject: msg(lang, 'சுயவிவர மாற்றங்களை உறுதிப்படுத்தவும்', 'Confirm your profile changes'),
      text: msg(lang,
        'உங்கள் சுயவிவர மாற்றங்களுக்கான சரிபார்ப்பு குறியீடு: ' + code + '\nஇந்தக் குறியீடு 10 நிமிடங்களில் காலாவதியாகும். நீங்கள் இந்த மாற்றங்களைக் கோரவில்லை என்றால், அவற்றைப் புறக்கணிக்கவும்.',
        'Your profile change verification code is: ' + code + '\nThis code expires in 10 minutes. If you did not request these changes, ignore this email.'),
    });
  } catch (error) {
    if (previous) customerProfileChangeOtps.set(customerId, previous);
    else customerProfileChangeOtps.delete(customerId);
    console.error('Could not send customer profile change verification:', error);
    throw new HttpError(503, msg(lang, 'சரிபார்ப்பு மின்னஞ்சலை அனுப்ப முடியவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.', 'Could not send the verification email. Please try again later.'));
  }
}

function removeExpiredCustomerOtps() {
  const now = Date.now();
  for (const [email, pending] of customerRegistrationOtps) {
    if (pending.expiresAt <= now) customerRegistrationOtps.delete(email);
  }
  for (const [customerId, pending] of customerProfileChangeOtps) {
    if (pending.expiresAt <= now) customerProfileChangeOtps.delete(customerId);
  }
}

function emailChangePendingForAnother(email, customerId) {
  for (const [id, pending] of customerProfileChangeOtps) {
    if (id !== customerId && pending.email === email) return true;
  }
  return false;
}

function allowPasswordResetRequest(ip) {
  const now = Date.now();
  for (const [key, request] of passwordResetRequests) {
    if (request.expiresAt <= now) passwordResetRequests.delete(key);
  }
  const request = passwordResetRequests.get(ip);
  if (request && request.count >= 5) return false;
  passwordResetRequests.set(ip, request
    ? { count: request.count + 1, expiresAt: request.expiresAt }
    : { count: 1, expiresAt: now + 15 * 60 * 1000 });
  return true;
}

async function consumePasswordResetToken(tokenHash) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('shop_admin_password_reset'))");
    const result = await client.query(
      'DELETE FROM admin_password_resets WHERE token_hash = $1 AND expires_at > NOW() RETURNING token_hash',
      [tokenHash],
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('DELETE FROM admin_password_resets');
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function getSession(req, role) {
  const cookieName = SESSION_COOKIE[role];
  const t = cookieName && parseCookies(req)[cookieName];
  const s = t && sessions.get(t);
  if (!s || s.role !== role) return null;
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  s.exp = Date.now() + SESSION_MS;
  return t;
}
function sessionFor(req, role) {
  const sid = getSession(req, role);
  const session = sid && sessions.get(sid);
  return session || null;
}
function setSessionCookie(res, sid, role) {
  const cookieName = SESSION_COOKIE[role];
  return send(res, 200, { ok: true }, { 'Set-Cookie': cookieName + '=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_MS / 1000 });
}
function clearSessionCookie(res, role) {
  const cookieName = SESSION_COOKIE[role];
  return send(res, 200, { ok: true }, { 'Set-Cookie': cookieName + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
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
  'தவறான தேதி வடிகட்டி': 'Invalid date filter',
  'தவறான கட்டண முறை': 'Invalid payment method',
  'தற்போதைய கடவுச்சொல் தவறு': 'Current password is incorrect',
  'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள்': 'New password must be at least 6 characters',
  'வழங்கப்பட்ட ஆர்டரை ரத்து செய்ய முடியாது': 'A delivered order cannot be cancelled',
  'ரத்து செய்யப்பட்ட ஆர்டரை மீண்டும் திறக்க முடியாது': 'Cancelled order cannot be reopened because there is not enough stock',
  'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்': 'Please log in to your customer account',
  'சரியான மின்னஞ்சலை உள்ளிடவும்': 'Enter a valid email address',
  'கடவுச்சொல் மீட்பு மின்னஞ்சல் அமைக்கப்படவில்லை': 'Password reset email is not configured on this server',
  'கடவுச்சொல் மீட்பு இணைப்பு தவறானது அல்லது காலாவதியானது': 'The password reset link is invalid or has expired',
  'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்': 'New password must be at least 6 characters',
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
  pathname = resolveStaticRoute(pathname);
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
  const { adminHash, defaultPassword, adminEmail, ...rest } = db.settings;
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
function recordStockMovement(product, before, after, kind, reason = '', note = '', reference = '') {
  const change = after - before;
  if (!change) return;
  const movement = {
    id: 'STK-' + pad(++db.counters.stockMovement, 8),
    createdAt: new Date().toISOString(),
    productId: product.id,
    productName: product.name,
    change,
    stockBefore: before,
    stockAfter: after,
    kind,
    reason,
    note,
    reference,
  };
  db.stockMovements.unshift(movement);
  if (db.stockMovements.length > 200) db.stockMovements.length = 200;
}
function takeStock(lines, sign, kind, reference) {
  for (const l of lines) {
    const p = db.products.find((x) => x.id === l.id);
    if (p) {
      const before = p.stock;
      p.stock = Math.max(0, p.stock - sign * l.qty);
      recordStockMovement(p, before, p.stock, kind, '', '', reference);
    }
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
    const customer = db.customers.find((item) => item.id === customerSession.customerId);
    if (!customer) throw new HttpError(401, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்');
    const b = await readBody(req);
    const name = str(b.name, 60), phone = normalizePhone(b.phone), address = str(b.address, 300), note = str(b.note, 300);
    if (name.length < 2) throw new HttpError(400, msg(lang, 'பெயரை உள்ளிடவும்', 'Please enter your name'));
    if (phone.length < 10 || phone.length > 15) throw new HttpError(400, msg(lang, 'சரியான மொபைல் எண்ணை உள்ளிடவும்', 'Please enter a valid mobile number'));
    if (address.length < 5) throw new HttpError(400, msg(lang, 'முகவரியை உள்ளிடவும்', 'Please enter your address'));
    if (db.customers.some((item) => item.id !== customer.id && item.phone === phone)) {
      throw new HttpError(409, msg(lang, 'இந்த தொலைபேசி எண் ஏற்கனவே மற்றொரு கணக்கில் பயன்படுத்தப்படுகிறது', 'This phone number is already used by another account'));
    }
    const lines = buildLines(b.items, { lang });
    const subtotal = sum(lines, 'amount');
    if (subtotal < db.settings.minOrder) throw new HttpError(400, msg(lang, 'குறைந்தபட்ச ஆர்டர் ₹' + db.settings.minOrder, 'Minimum order is ₹' + db.settings.minOrder));
    customer.name = name;
    customer.phone = phone;
    customer.address = address;
    const order = {
      id: 'ORD-' + pad(++db.counters.order),
      createdAt: new Date().toISOString(),
      status: 'new',
      customerId: customerSession.customerId,
      customer: { name, phone, address },
      note, lines, mrpTotal: lines.reduce((a, l) => a + l.mrp * l.qty, 0), total: subtotal,
    };
    takeStock(lines, 1, 'online_order', order.id);
    db.orders.unshift(order);
    await saveDb();
    return send(res, 200, { ok: true, order: { id: order.id, total: order.total } });
  }

  /* ----- auth ----- */
  if (method === 'POST' && pathname === '/api/customer/register') {
    const lang = langOf(req);
    const b = await readBody(req);
    const name = str(b.name, 60);
    const email = str(b.email, 254).toLowerCase();
    const password = String(b.password || '');
    const passwordConfirm = String(b.passwordConfirm || '');
    if (name.length < 2) throw new HttpError(400, msg(lang, 'பெயரை உள்ளிடவும்', 'Please enter your name'));
    if (password.length < 8 || password.length > 100) {
      throw new HttpError(400, msg(lang, 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்', 'Password must be at least 8 characters'));
    }
    if (password !== passwordConfirm) throw new HttpError(400, msg(lang, 'கடவுச்சொற்கள் பொருந்தவில்லை', 'Passwords do not match'));
    if (!email) throw new HttpError(400, msg(lang, 'மின்னஞ்சலை உள்ளிடவும்', 'Please enter your email address'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, msg(lang, 'சரியான மின்னஞ்சலை உள்ளிடவும்', 'Enter a valid email address'));
    removeExpiredCustomerOtps();
    if (db.customers.some((customer) => String(customer.email || '').toLowerCase() === email) ||
        Array.from(customerProfileChangeOtps.values()).some((pendingEmail) => pendingEmail.email === email)) {
      throw new HttpError(409, msg(lang, 'இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது', 'This email is already registered'));
    }
    if (customerRegistrationOtps.has(email)) {
      throw new HttpError(409, msg(lang, 'சரிபார்ப்பு குறியீடு ஏற்கனவே அனுப்பப்பட்டுள்ளது. உங்கள் மின்னஞ்சலைப் பார்க்கவும்.', 'A verification code has already been sent. Check your email.'));
    }
    if (!allowCustomerOtpRequest(req.socket.remoteAddress || 'unknown')) {
      throw new HttpError(429, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்');
    }
    const pending = { name, email, passwordHash: hashPassword(password), attempts: 0 };
    try {
      await sendCustomerRegistrationOtp(email, pending, lang);
    } catch (error) {
      customerRegistrationOtps.delete(email);
      throw error;
    }
    return send(res, 200, { ok: true, otpSent: true });
  }
  if (method === 'POST' && pathname === '/api/customer/register/resend') {
    const lang = langOf(req);
    const b = await readBody(req);
    const email = str(b.email, 254).toLowerCase();
    removeExpiredCustomerOtps();
    const pending = customerRegistrationOtps.get(email);
    if (!pending) throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு காலாவதியானது. மீண்டும் பதிவு செய்யவும்.', 'The verification code expired. Please register again.'));
    if (pending.resendAfter > Date.now()) {
      throw new HttpError(429, msg(lang, 'மீண்டும் குறியீடு கோருவதற்கு முன் சிறிது நேரம் காத்திருக்கவும்.', 'Please wait before requesting another code.'));
    }
    if (!allowCustomerOtpRequest(req.socket.remoteAddress || 'unknown')) {
      throw new HttpError(429, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்');
    }
    await sendCustomerRegistrationOtp(email, pending, lang);
    return send(res, 200, { ok: true, otpSent: true });
  }
  if (method === 'POST' && pathname === '/api/customer/register/verify') {
    const lang = langOf(req);
    const b = await readBody(req);
    const email = str(b.email, 254).toLowerCase();
    const code = typeof b.code === 'string' ? b.code : '';
    removeExpiredCustomerOtps();
    const pending = customerRegistrationOtps.get(email);
    if (!pending) throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு காலாவதியானது. மீண்டும் பதிவு செய்யவும்.', 'The verification code expired. Please register again.'));
    const actualHash = customerOtpHash(email, code);
    const codeValid = /^\d{6}$/.test(code) && crypto.timingSafeEqual(pending.codeHash, actualHash);
    if (!codeValid) {
      pending.attempts += 1;
      if (pending.attempts >= CUSTOMER_OTP_MAX_ATTEMPTS) {
        customerRegistrationOtps.delete(email);
        throw new HttpError(429, msg(lang, 'பல தவறான குறியீடுகள். மீண்டும் பதிவு செய்யவும்.', 'Too many incorrect codes. Please register again.'));
      }
      throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு தவறு', 'The verification code is incorrect'));
    }
    if (db.customers.some((customer) => String(customer.email || '').toLowerCase() === email) ||
        Array.from(customerProfileChangeOtps.values()).some((pendingEmail) => pendingEmail.email === email)) {
      customerRegistrationOtps.delete(email);
      throw new HttpError(409, msg(lang, 'இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது', 'This email is already registered'));
    }
    customerRegistrationOtps.delete(email);
    const customer = {
      id: ++db.counters.customer, name: pending.name, phone: '', email, address: '',
      passwordHash: pending.passwordHash, emailVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.customers.push(customer);
    await saveDb();
    return setSessionCookie(res, startSession('customer', customer.id), 'customer');
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
    return setSessionCookie(res, startSession('customer', customer.id), 'customer');
  }
  if (method === 'POST' && pathname === '/api/customer/logout') {
    const t = parseCookies(req)[SESSION_COOKIE.customer];
    if (t) sessions.delete(t);
    return clearSessionCookie(res, 'customer');
  }
  if (method === 'GET' && pathname === '/api/customer/me') {
    const session = sessionFor(req, 'customer');
    const customer = session && db.customers.find((c) => c.id === session.customerId);
    removeExpiredCustomerOtps();
    const pending = customer && customerProfileChangeOtps.get(customer.id);
    return send(res, 200, customer ? {
      loggedIn: true,
      customer: customerView(customer),
      pendingEmail: pending?.email || '',
      pendingProfile: pending ? { ...pending.profile, email: pending.email } : null,
    } : { loggedIn: false });
  }
  if (method === 'PUT' && pathname === '/api/customer/me') {
    const lang = langOf(req);
    const session = sessionFor(req, 'customer');
    if (!session) throw new HttpError(401, msg(lang, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்', 'Please log in to your customer account'));
    const customer = db.customers.find((item) => item.id === session.customerId);
    if (!customer) throw new HttpError(401, msg(lang, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்', 'Please log in to your customer account'));
    const b = await readBody(req);
    const name = str(b.name, 60).trim();
    const email = str(b.email, 254).trim().toLowerCase();
    const phone = normalizePhone(b.phone);
    const address = str(b.address, 300).trim();
    if (name.length < 2) throw new HttpError(400, msg(lang, 'பெயரை உள்ளிடவும்', 'Please enter your name'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, msg(lang, 'சரியான மின்னஞ்சலை உள்ளிடவும்', 'Enter a valid email address'));
    if (phone && (phone.length < 10 || phone.length > 15)) {
      throw new HttpError(400, msg(lang, 'சரியான மொபைல் எண்ணை உள்ளிடவும்', 'Please enter a valid phone number'));
    }
    if (address && address.length < 5) throw new HttpError(400, msg(lang, 'முகவரியை உள்ளிடவும்', 'Please enter a valid address'));
    if (phone && db.customers.some((item) => item.id !== customer.id && item.phone === phone)) {
      throw new HttpError(409, msg(lang, 'இந்த தொலைபேசி எண் ஏற்கனவே மற்றொரு கணக்கில் பயன்படுத்தப்படுகிறது', 'This phone number is already used by another account'));
    }

    removeExpiredCustomerOtps();
    const currentEmail = String(customer.email || '').toLowerCase();
    const profile = { name, phone, address };
    const changed = name !== String(customer.name || '').trim() ||
      email !== currentEmail ||
      phone !== normalizePhone(customer.phone) ||
      address !== String(customer.address || '').trim();
    if (!changed) {
      customerProfileChangeOtps.delete(customer.id);
      return send(res, 200, { ok: true, customer: customerView(customer), verificationRequired: false, pendingEmail: '', pendingProfile: null });
    }

    if (email !== currentEmail &&
        (db.customers.some((item) => item.id !== customer.id && String(item.email || '').toLowerCase() === email) ||
         customerRegistrationOtps.has(email) || emailChangePendingForAnother(email, customer.id))) {
      throw new HttpError(409, msg(lang, 'இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது', 'This email is already in use'));
    }

    let pending = customerProfileChangeOtps.get(customer.id);
    const samePendingChange = pending && pending.email === email && pending.profile &&
      pending.profile.name === profile.name &&
      pending.profile.phone === profile.phone &&
      pending.profile.address === profile.address;
    if (!samePendingChange) {
      if (!allowCustomerOtpRequest(req.socket.remoteAddress || 'unknown')) {
        throw new HttpError(429, msg(lang, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்', 'Too many verification requests. Please try again later'));
      }
      await sendCustomerProfileChangeOtp(customer.id, email, profile, lang);
      pending = customerProfileChangeOtps.get(customer.id);
    }
    return send(res, 200, {
      ok: true,
      customer: customerView(customer),
      verificationRequired: true,
      pendingEmail: pending.email,
      pendingProfile: { ...pending.profile, email: pending.email },
    });
  }
  if (method === 'POST' && pathname === '/api/customer/me/email/verify') {
    const lang = langOf(req);
    const session = sessionFor(req, 'customer');
    if (!session) throw new HttpError(401, msg(lang, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்', 'Please log in to your customer account'));
    const customer = db.customers.find((item) => item.id === session.customerId);
    const pending = customerProfileChangeOtps.get(session.customerId);
    if (!customer) throw new HttpError(401, msg(lang, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்', 'Please log in to your customer account'));
    if (!pending || !pending.profile || pending.expiresAt <= Date.now()) {
      customerProfileChangeOtps.delete(session.customerId);
      throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு காலாவதியானது. மீண்டும் முயற்சிக்கவும்.', 'The verification code expired. Please request a new one.'));
    }
    const b = await readBody(req);
    const code = typeof b.code === 'string' ? b.code : '';
    const actualHash = customerOtpHash(pending.email, code);
    const codeValid = /^\d{6}$/.test(code) && crypto.timingSafeEqual(pending.codeHash, actualHash);
    if (!codeValid) {
      pending.attempts += 1;
      if (pending.attempts >= CUSTOMER_OTP_MAX_ATTEMPTS) {
        customerProfileChangeOtps.delete(session.customerId);
        throw new HttpError(429, msg(lang, 'பல தவறான குறியீடுகள். சுயவிவர மாற்றங்களை மீண்டும் தொடங்கவும்.', 'Too many incorrect codes. Please start the profile change again.'));
      }
      throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு தவறு', 'The verification code is incorrect'));
    }
    if (pending.email !== String(customer.email || '').toLowerCase() &&
        db.customers.some((item) => item.id !== customer.id && String(item.email || '').toLowerCase() === pending.email)) {
      customerProfileChangeOtps.delete(session.customerId);
      throw new HttpError(409, msg(lang, 'இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது', 'This email is already in use'));
    }
    if (pending.profile.phone && db.customers.some((item) => item.id !== customer.id && item.phone === pending.profile.phone)) {
      customerProfileChangeOtps.delete(session.customerId);
      throw new HttpError(409, msg(lang, 'இந்த தொலைபேசி எண் ஏற்கனவே மற்றொரு கணக்கில் பயன்படுத்தப்படுகிறது', 'This phone number is already used by another account'));
    }
    const emailChanged = pending.email !== String(customer.email || '').toLowerCase();
    customer.name = pending.profile.name;
    customer.phone = pending.profile.phone;
    customer.address = pending.profile.address;
    customer.email = pending.email;
    if (emailChanged) customer.emailVerifiedAt = new Date().toISOString();
    customerProfileChangeOtps.delete(session.customerId);
    await saveDb();
    return send(res, 200, { ok: true, customer: customerView(customer), pendingEmail: '' });
  }
  if (method === 'POST' && pathname === '/api/customer/me/email/resend') {
    const lang = langOf(req);
    const session = sessionFor(req, 'customer');
    if (!session) throw new HttpError(401, msg(lang, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்', 'Please log in to your customer account'));
    removeExpiredCustomerOtps();
    const pending = customerProfileChangeOtps.get(session.customerId);
    if (!pending) throw new HttpError(400, msg(lang, 'சரிபார்ப்பு குறியீடு காலாவதியானது. மீண்டும் முயற்சிக்கவும்.', 'The verification code expired. Please request a new one.'));
    if (pending.resendAfter > Date.now()) {
      throw new HttpError(429, msg(lang, 'மீண்டும் குறியீடு கோருவதற்கு முன் சிறிது நேரம் காத்திருக்கவும்.', 'Please wait before requesting another code.'));
    }
    if (!allowCustomerOtpRequest(req.socket.remoteAddress || 'unknown')) {
      throw new HttpError(429, msg(lang, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்', 'Too many verification requests. Please try again later'));
    }
    await sendCustomerProfileChangeOtp(session.customerId, pending.email, pending.profile, lang);
    return send(res, 200, { ok: true, otpSent: true });
  }
  if (method === 'POST' && pathname === '/api/customer/me/email/cancel') {
    const session = sessionFor(req, 'customer');
    if (!session) throw new HttpError(401, 'வாடிக்கையாளர் கணக்கில் உள்நுழைய வேண்டும்');
    customerProfileChangeOtps.delete(session.customerId);
    return send(res, 200, { ok: true });
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
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const configuredEmail = String(db.settings.adminEmail || '').trim().toLowerCase();
    const validEmail = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = checkPassword(b.password, db.settings.adminHash);
    if (!validEmail || (configuredEmail && email !== configuredEmail) || !passwordValid) {
      const n = (f ? f.n : 0) + 1;
      fails.set(ip, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
      throw new HttpError(401, msg(langOf(req), 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு', 'Email or password is incorrect'));
    }
    if (!configuredEmail) {
      db.settings.adminEmail = email;
      await saveDb();
    }
    fails.delete(ip);
    return setSessionCookie(res, startSession('admin'), 'admin');
  }
  if (method === 'POST' && pathname === '/api/logout') {
    const t = parseCookies(req)[SESSION_COOKIE.admin];
    if (t) sessions.delete(t);
    return clearSessionCookie(res, 'admin');
  }
  if (method === 'GET' && pathname === '/api/me') {
    return send(res, 200, { loggedIn: !!sessionFor(req, 'admin') });
  }
  if (method === 'POST' && pathname === '/api/admin/password-reset/request') {
    const b = await readBody(req);
    const email = str(b.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'சரியான மின்னஞ்சலை உள்ளிடவும்');
    if (!allowPasswordResetRequest(req.socket.remoteAddress || 'unknown')) {
      throw new HttpError(429, 'சிறிது நேரம் கழித்து முயற்சிக்கவும்');
    }
    const mailer = passwordResetMailer(langOf(req));
    if (email === String(db.settings.adminEmail || '').toLowerCase()) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = Date.now() + PASSWORD_RESET_MS;
      const resetUrl = new URL('/admin', mailer.baseUrl);
      resetUrl.hash = 'reset=' + token;
      await pool.query('DELETE FROM admin_password_resets WHERE expires_at <= NOW()');
      await pool.query('INSERT INTO admin_password_resets (token_hash, expires_at) VALUES ($1, $2)',
        [tokenHash, new Date(expiresAt)]);
      try {
        await mailer.sendMail({
          to: email,
          subject: 'Crackers Shop admin password reset',
          text: 'Use this link to reset the shop admin password. It expires in 30 minutes:\n\n' +
            resetUrl.href + '\n\nIf you did not request this, ignore this email.',
        });
      } catch (error) {
        await pool.query('DELETE FROM admin_password_resets WHERE token_hash = $1', [tokenHash]);
        console.error('Could not send admin password reset email:', error);
      }
    }
    return send(res, 200, { ok: true });
  }
  if (method === 'POST' && pathname === '/api/admin/password-reset/complete') {
    const b = await readBody(req);
    const token = typeof b.token === 'string' ? b.token : '';
    const nextPassword = typeof b.next === 'string' ? b.next : '';
    if (nextPassword.length < 6 || nextPassword.length > 100) {
      throw new HttpError(400, 'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்');
    }
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new HttpError(400, 'கடவுச்சொல் மீட்பு இணைப்பு தவறானது அல்லது காலாவதியானது');
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (!await consumePasswordResetToken(tokenHash)) {
      throw new HttpError(400, 'கடவுச்சொல் மீட்பு இணைப்பு தவறானது அல்லது காலாவதியானது');
    }
    const previousHash = db.settings.adminHash;
    const previousDefaultPassword = db.settings.defaultPassword;
    db.settings.adminHash = hashPassword(nextPassword);
    db.settings.defaultPassword = false;
    try {
      await saveDb();
    } catch (error) {
      db.settings.adminHash = previousHash;
      db.settings.defaultPassword = previousDefaultPassword;
      throw error;
    }
    for (const [sid, session] of sessions) {
      if (session.role === 'admin') sessions.delete(sid);
    }
    return send(res, 200, { ok: true });
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
      stockMovements: db.stockMovements.slice(0, 50),
    });
  }

  if (method === 'GET' && pathname === '/api/admin/stock-movements') {
    const rawProductId = query.get('productId');
    const rawOffset = query.get('offset');
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 50));
    const offset = rawOffset === null ? 0 : Number(rawOffset);
    const productId = rawProductId === null ? null : Number(rawProductId);
    if (rawProductId !== null && (!/^\d+$/.test(rawProductId) || !Number.isSafeInteger(productId) || productId <= 0)) {
      throw new HttpError(400, 'தவறான பொருள் எண்');
    }
    if (rawOffset !== null && (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 10000000)) {
      throw new HttpError(400, 'தவறான பக்க எண்');
    }
    const result = rawProductId === null
      ? await pool.query('SELECT data FROM shop_stock_movements ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2', [limit, offset])
      : await pool.query('SELECT data FROM shop_stock_movements WHERE product_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [productId, limit, offset]);
    return send(res, 200, { movements: result.rows.map((row) => row.data) });
  }

  // products
  if (method === 'POST' && pathname === '/api/admin/products') {
    const b = await readBody(req);
    const p = cleanProduct(b);
    p.id = ++db.counters.product;
    db.products.push(p);
    if (p.stock > 0) recordStockMovement(p, 0, p.stock, 'opening_stock');
    await saveDb();
    return send(res, 200, { ok: true, product: p });
  }
  let m = pathname.match(/^\/api\/admin\/products\/(\d+)\/stock-adjust$/);
  if (m && method === 'POST') {
    const p = db.products.find((product) => product.id === Number(m[1]));
    if (!p) throw new HttpError(404, 'பொருள் இல்லை');
    const b = await readBody(req);
    const lang = langOf(req);
    let adjustment;
    try {
      adjustment = calculateStockAdjustment(p.stock, b.mode, b.quantity, b.reason);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new HttpError(400, msg(lang, 'சரியான இருப்பு மாற்ற விவரங்களை உள்ளிடவும்', 'Enter a valid stock change and reason'));
    }
    const before = p.stock;
    p.stock = adjustment.stockAfter;
    recordStockMovement(p, before, p.stock, 'manual', b.reason, str(b.note, 200));
    await saveDb();
    return send(res, 200, { ok: true, stock: p.stock });
  }
  m = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
  if (m) {
    const idx = db.products.findIndex((x) => x.id === Number(m[1]));
    if (idx < 0) throw new HttpError(404, 'பொருள் இல்லை');
    if (method === 'PUT') {
      const b = await readBody(req);
      const existingProduct = db.products[idx];
      const previousImage = existingProduct.image;
      const p = cleanProduct(b, existingProduct);
      p.id = existingProduct.id;
      db.products[idx] = p;
      await saveDb();
      if (previousImage && previousImage !== p.image) removeProductImage(previousImage);
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE') {
      const image = db.products[idx].image;
      db.products.splice(idx, 1);
      await saveDb();
      removeProductImage(image);
      return send(res, 200, { ok: true });
    }
  }

  // counter bill
  if (method === 'POST' && pathname === '/api/admin/bills') {
    const b = await readBody(req);
    const lang = langOf(req);
    const name = str(b.name, 60);
    const phone = normalizePhone(b.phone);
    if (name.length < 2) throw new HttpError(400, msg(lang, 'வாடிக்கையாளர் பெயரை உள்ளிடவும்', 'Please enter the customer name'));
    if (phone.length < 10 || phone.length > 15) throw new HttpError(400, msg(lang, 'சரியான மொபைல் எண்ணை உள்ளிடவும்', 'Please enter a valid mobile number'));
    const lines = buildLines(b.items, { activeOnly: false });
    const subtotal = sum(lines, 'amount');
    const extra = Math.min(subtotal, clampInt(b.extraDiscount, 0, 10000000));
    const pay = ['cash', 'upi', 'card'].includes(b.payment) ? b.payment : 'cash';
    const bill = {
      id: 'BILL-' + pad(++db.counters.bill),
      createdAt: new Date().toISOString(),
      customer: { name, phone, address: str(b.address, 300) },
      payment: pay, lines, mrpTotal: lines.reduce((a, l) => a + l.mrp * l.qty, 0),
      subtotal, extraDiscount: extra, total: subtotal - extra,
    };
    takeStock(lines, 1, 'counter_sale', bill.id);
    db.bills.unshift(bill);
    await saveDb();
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
    if (b.status === 'cancelled' && o.status !== 'cancelled') takeStock(o.lines, -1, 'order_cancelled', o.id);
    if (o.status === 'cancelled' && b.status !== 'cancelled') takeStock(o.lines, 1, 'order_reopened', o.id);
    o.status = b.status;
    await saveDb();
    return send(res, 200, { ok: true });
  }

  // settings
  if (method === 'PUT' && pathname === '/api/admin/settings') {
    const b = await readBody(req);
    const s = db.settings;
    const adminEmail = str(b.adminEmail, 254).toLowerCase();
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new HttpError(400, 'சரியான மின்னஞ்சலை உள்ளிடவும்');
    }
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
    s.adminEmail = adminEmail;
    s.whatsapp = str(b.whatsapp, 15).replace(/\D/g, '');
    s.address = str(b.address, 200);
    s.licenseNo = str(b.licenseNo, 60);
    s.gstNo = str(b.gstNo, 30);
    s.discount = clampInt(b.discount, 0, 95);
    s.minOrder = clampInt(b.minOrder, 0, 10000000);
    s.logo = nextLogo;
    await saveDb();
    if (previousLogo && previousLogo !== nextLogo) removeStoredImage(previousLogo, '/shop-images/', SHOP_IMAGE_DIR);
    return send(res, 200, { ok: true });
  }
  if (method === 'POST' && pathname === '/api/admin/password') {
    const b = await readBody(req);
    if (!checkPassword(b.current, db.settings.adminHash)) throw new HttpError(400, 'தற்போதைய கடவுச்சொல் தவறு');
    if (str(b.next, 100).length < 6) throw new HttpError(400, 'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள்');
    db.settings.adminHash = hashPassword(String(b.next));
    db.settings.defaultPassword = false;
    await saveDb();
    return send(res, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/api/admin/export') {
    const filters = exportFilters(query);
    const workbook = await createExportWorkbook(filters);
    const stamp = new Date().toISOString().slice(0, 10);
    return send(res, 200, Buffer.from(workbook), {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="crackers-shop-export-' + stamp + '.xlsx"',
    });
  }
  if (method === 'GET' && pathname === '/api/admin/backup') {
    const movements = await pool.query('SELECT data FROM shop_stock_movements ORDER BY created_at, id');
    const backup = {
      ...db,
      stockMovements: movements.rows.map((row) => row.data),
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

function cleanProduct(b, existingProduct = null) {
  const name = str(b.name, 100);
  if (!name) throw new HttpError(400, 'பெயர் தேவை');
  const mrp = clampInt(b.mrp, 0, 10000000);
  if (mrp <= 0) throw new HttpError(400, 'MRP விலை தேவை');
  let discount = null;
  if (b.discount !== null && b.discount !== undefined && b.discount !== '') discount = clampInt(b.discount, 0, 95);
  if (!db.categories.some((c) => c.id === b.category)) throw new HttpError(400, 'வகை தவறு');
  const lowStockThreshold = b.lowStockThreshold === undefined
    ? (existingProduct ? existingProduct.lowStockThreshold : 10)
    : clampInt(b.lowStockThreshold, 0, 10000000);
  const product = {
    name, nameEn: str(b.nameEn, 100), category: b.category, emoji: str(b.emoji, 8) || '🎆',
    mrp, discount, unit: str(b.unit, 30) || 'பெட்டி',
    stock: existingProduct ? existingProduct.stock : clampInt(b.stock, 0, 10000000),
    lowStockThreshold,
    popular: !!b.popular, active: b.active !== false,
  };
  product.image = b.imageDataUrl ? storeProductImage(b.imageDataUrl) : b.removeImage ? '' : existingProduct ? existingProduct.image : '';
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

async function startServer() {
  if (!DATABASE_URL) throw new Error('PostgreSQL connection is not configured. Set DATABASE_URL or create data/database-url.txt.');
  const emailFrom = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  if (!emailFrom || (!resendApiKey && !smtpHost)) {
    console.warn('Email is not configured. Set RESEND_API_KEY and EMAIL_FROM, or SMTP_HOST and SMTP_FROM (plus SMTP_USER and SMTP_PASS when required).');
  }
  await initializeDatabase();
  dailyBackup().catch((error) => console.error('Could not create daily backup:', error));
  setInterval(() => dailyBackup().catch((error) => console.error('Could not create daily backup:', error)), 6 * 3600 * 1000).unref();
  server.listen(PORT, HOST, () => {
    const h = HOST === '0.0.0.0' ? 'localhost' : HOST === '127.0.0.1' ? 'localhost' : HOST;
    console.log('\n  🎆 பட்டாசு கடை சர்வர் தொடங்கியது');
    console.log('  கடை இணையதளம் : http://' + h + ':' + PORT + '/');
    console.log('  Admin / பில்லிங்  : http://' + h + ':' + PORT + '/admin');
    console.log('  (நிறுத்த: Ctrl+C அல்லது stop.bat)\n');
    try { fs.writeFileSync(PID_FILE, String(process.pid)); pidFileOwned = true; } catch { /* ignore */ }
  });
}

module.exports = { startServer };

process.on('exit', () => {
  if (!pidFileOwned) return;
  try {
    if (fs.readFileSync(PID_FILE, 'utf8') === String(process.pid)) fs.unlinkSync(PID_FILE);
  } catch { /* ignore */ }
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => {
      saveDb()
        .then(() => pool.end())
        .then(() => process.exit(0))
        .catch((error) => { console.error('Could not save PostgreSQL data during shutdown:', error); process.exit(1); });
    });
  });
}
