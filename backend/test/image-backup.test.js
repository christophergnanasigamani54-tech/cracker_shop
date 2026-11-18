'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { backupImages } = require('../utils/image-backup');

test('image backups include existing files and warn while skipping missing files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-image-backup-'));
  const productImageDir = path.join(root, 'product-images');
  const shopImageDir = path.join(root, 'shop-images');
  fs.mkdirSync(productImageDir);
  fs.mkdirSync(shopImageDir);
  fs.writeFileSync(path.join(productImageDir, 'existing.jpg'), 'product image');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let result;
  try {
    result = backupImages([
      '/product-images/existing.jpg',
      '/product-images/missing.jpg',
      '/product-images/existing.jpg',
    ], productImageDir, shopImageDir);
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(result, [{
    path: '/product-images/existing.jpg',
    data: Buffer.from('product image').toString('base64'),
  }]);
  assert.deepEqual(warnings, ['Skipping missing image in backup: /product-images/missing.jpg']);
});
