'use strict';

const nodemailer = require('nodemailer');

function createEmailSender({ from, resendApiKey, smtp = {} }) {
  if (smtp.host) {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
    });
    return {
      from,
      sendMail: (message) => transporter.sendMail({ ...message, from: message.from || from }),
    };
  }

  if (resendApiKey) {
    return {
      from,
      async sendMail(message) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + resendApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: message.from || from,
            to: message.to,
            subject: message.subject,
            text: message.text,
          }),
        });
        await response.text();
        if (!response.ok) {
          throw new Error('Resend email API returned HTTP ' + response.status +
            '. Check the API key and sender configuration.');
        }
      },
    };
  }

  throw new Error('Email sender is not configured.');
}

module.exports = { createEmailSender };
