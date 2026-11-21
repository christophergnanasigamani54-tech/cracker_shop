'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createEmailSender } = require('../services/email-service');

test('Resend sender sends email over HTTPS using configured sender and API key', async (t) => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, text: async () => '' };
  };
  t.after(() => { global.fetch = originalFetch; });

  const mailer = createEmailSender({ from: 'shop@example.com', resendApiKey: 'test-key' });
  await mailer.sendMail({ to: 'customer@example.com', subject: 'Verify', text: 'Code: 123456' });

  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    from: 'shop@example.com',
    to: 'customer@example.com',
    subject: 'Verify',
    text: 'Code: 123456',
  });
});

test('Resend sender reports rejected requests without exposing response content', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 403,
    text: async () => 'sensitive provider response',
  });
  t.after(() => { global.fetch = originalFetch; });

  const mailer = createEmailSender({ from: 'shop@example.com', resendApiKey: 'test-key' });
  await assert.rejects(mailer.sendMail({
    to: 'customer@example.com',
    subject: 'Verify',
    text: 'Code: 123456',
  }), {
    message: 'Resend email API returned HTTP 403. Check the API key and sender configuration.',
  });
});
