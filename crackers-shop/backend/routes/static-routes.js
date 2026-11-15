'use strict';

function resolveStaticRoute(pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/customer' || pathname === '/customer/') {
    return '/customer/index.html';
  }
  if (pathname === '/admin' || pathname === '/admin.html') return '/admin/dashboard.html';
  return pathname;
}

module.exports = { resolveStaticRoute };
