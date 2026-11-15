'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..', '..');
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('PostgreSQL transactions keep inventory and bills consistent', {
  skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to a dedicated PostgreSQL test database',
}, async () => {
  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''));
  assert.match(databaseName, /(^|[_-])test($|[_-])/i, 'TEST_DATABASE_URL must point to a dedicated test database');

  const schemaName = 'integration_' + process.pid + '_' + Date.now();
  const quotedSchema = '"' + schemaName + '"';
  const adminClient = new Client({ connectionString: testDatabaseUrl });
  let child;
  let tempDataDir;
  let serverOutput = '';
  let clientConnected = false;
  let schemaCreated = false;

  try {
    await adminClient.connect();
    clientConnected = true;
    await adminClient.query('CREATE SCHEMA ' + quotedSchema);
    schemaCreated = true;

    const scopedUrl = new URL(testDatabaseUrl);
    scopedUrl.searchParams.set('options', '-c search_path=' + schemaName);
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cracker-shop-integration-'));
    const port = await getFreePort();
    child = spawn(process.execPath, [path.join(projectRoot, 'backend', 'server.js')], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: scopedUrl.href,
        DATA_DIR: tempDataDir,
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
    child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

    const baseUrl = 'http://127.0.0.1:' + port;
    await waitForServer(child, baseUrl, () => serverOutput);

    const login = await request(baseUrl, '/api/login', {
      method: 'POST',
      body: { password: 'admin123' },
    });
    assert.equal(login.status, 200);
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    assert.match(cookie, /^adminSid=/);

    const categoriesResponse = await request(baseUrl, '/api/public');
    const categories = (await categoriesResponse.json()).categories;
    assert.ok(categories.length > 0);

    const firstProduct = await createProduct(baseUrl, cookie, categories[0].id, 'Concurrent sale');
    const competingSales = await Promise.all([
      createBill(baseUrl, cookie, firstProduct.id),
      createBill(baseUrl, cookie, firstProduct.id),
    ]);
    assert.deepEqual(competingSales.map((response) => response.status).sort(), [200, 400]);

    const firstProductRow = await adminClient.query(
      'SELECT data FROM ' + quotedSchema + '.shop_products WHERE id = $1',
      [firstProduct.id],
    );
    assert.equal(Number(firstProductRow.rows[0].data.stock), 0);
    const billCountBeforeFailure = await countRows(adminClient, quotedSchema, 'shop_bills');
    assert.equal(billCountBeforeFailure, 1);

    const secondProduct = await createProduct(baseUrl, cookie, categories[0].id, 'Rollback sale');
    const movementCountBeforeFailure = await countRows(adminClient, quotedSchema, 'shop_stock_movements');
    await adminClient.query(`
      CREATE FUNCTION ${quotedSchema}.reject_test_bill() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced integration-test failure';
      END;
      $$;
      CREATE TRIGGER reject_test_bill_insert
      BEFORE INSERT ON ${quotedSchema}.shop_bills
      FOR EACH ROW EXECUTE FUNCTION ${quotedSchema}.reject_test_bill();
    `);

    const failedSale = await createBill(baseUrl, cookie, secondProduct.id);
    assert.equal(failedSale.status, 500);

    const secondProductRow = await adminClient.query(
      'SELECT data FROM ' + quotedSchema + '.shop_products WHERE id = $1',
      [secondProduct.id],
    );
    assert.equal(Number(secondProductRow.rows[0].data.stock), 1);
    assert.equal(await countRows(adminClient, quotedSchema, 'shop_bills'), billCountBeforeFailure);
    assert.equal(await countRows(adminClient, quotedSchema, 'shop_stock_movements'), movementCountBeforeFailure);

    const adminDataResponse = await request(baseUrl, '/api/admin/data', { cookie });
    const adminData = await adminDataResponse.json();
    assert.equal(adminData.products.find((product) => product.id === secondProduct.id).stock, 1);
  } catch (error) {
    error.message += '\nIntegration server output:\n' + serverOutput.slice(-4000);
    throw error;
  } finally {
    if (child) await stopChild(child);
    try {
      if (clientConnected && schemaCreated) {
        await adminClient.query('DROP SCHEMA IF EXISTS ' + quotedSchema + ' CASCADE');
      }
    } finally {
      if (clientConnected) await adminClient.end();
      if (tempDataDir) fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
  }
});

async function createProduct(baseUrl, cookie, category, name) {
  const response = await request(baseUrl, '/api/admin/products', {
    method: 'POST',
    cookie,
    body: { name, category, mrp: 100, stock: 1, unit: 'box' },
  });
  assert.equal(response.status, 200);
  return (await response.json()).product;
}

function createBill(baseUrl, cookie, productId) {
  return request(baseUrl, '/api/admin/bills', {
    method: 'POST',
    cookie,
    body: { items: [{ id: productId, qty: 1 }], payment: 'cash' },
  });
}

function request(baseUrl, pathname, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return fetch(baseUrl + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function countRows(client, quotedSchema, table) {
  const result = await client.query('SELECT COUNT(*)::int AS count FROM ' + quotedSchema + '.' + table);
  return result.rows[0].count;
}

async function getFreePort() {
  const portServer = net.createServer();
  await new Promise((resolve, reject) => {
    portServer.once('error', reject);
    portServer.listen(0, '127.0.0.1', resolve);
  });
  const { port } = portServer.address();
  await new Promise((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(child, baseUrl, getOutput) {
  const timeout = Date.now() + 20000;
  while (Date.now() < timeout) {
    if (child.exitCode !== null) throw new Error('Integration server exited before becoming ready.');
    try {
      const response = await fetch(baseUrl + '/api/public');
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Integration server did not become ready.\n' + getOutput().slice(-4000));
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceTimeout);
      clearTimeout(finishTimeout);
      resolve();
    };
    const forceTimeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    const finishTimeout = setTimeout(finish, 7000);
    child.once('exit', finish);
    child.kill('SIGTERM');
  });
}
