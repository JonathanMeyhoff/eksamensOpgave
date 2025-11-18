// utils/twilioClient.js
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('Twilio konfiguration mangler. Tjek .env filen.');
}

const client = twilio(accountSid, authToken);

async function sendSms(to, body) {
  const start = Date.now();
  const msg = await client.messages.create({
    to,
    from: fromNumber,
    body
  });
  const elapsedMs = Date.now() - start;
  return { sid: msg.sid, elapsedMs };
}

module.exports = { sendSms };
