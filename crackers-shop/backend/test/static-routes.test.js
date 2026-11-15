'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStaticRoute } = require('../routes/static-routes');

test('storefront aliases resolve to the customer entry page', () => {
  for (const pathname of ['/', '/index.html', '/customer', '/customer/']) {
    assert.equal(resolveStaticRoute(pathname), '/customer/index.html');
  }
});

test('admin aliases resolve to the admin dashboard', () => {
  for (const pathname of ['/admin', '/admin.html']) {
    assert.equal(resolveStaticRoute(pathname), '/admin/dashboard.html');
  }
  assert.equal(resolveStaticRoute('/admin/dashboard.html'), '/admin/dashboard.html');
});
