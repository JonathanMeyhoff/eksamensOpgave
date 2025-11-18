// utils/emailClient.js
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM;

if (!host || !port || !user || !pass || !from) {
  console.warn(
    'SMTP konfiguration mangler. Tjek .env for SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM'
  );
}

const transporter = nodemailer.createTransport({
  host,
  port: Number(port),
  secure: Number(port) === 465, // typisk: 465 = true, 587 = false
  auth: {
    user,
    pass
  }
});

async function sendEmail(to, subject, text) {
  if (!host || !port || !user || !pass || !from) {
    throw new Error('SMTP ikke konfigureret korrekt');
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  return {
    messageId: info.messageId
  };
}

module.exports = { sendEmail };
