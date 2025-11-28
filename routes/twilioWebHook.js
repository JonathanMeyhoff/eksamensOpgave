// routes/twilioWebHook.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { MessagingResponse } = require('twilio').twiml;
const { decrypt } = require('../utils/cryptoHelper');


// samme normalizePhone som i venteliste.js
function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('0045')) return '+45' + p.slice(4);
  if (/^\d{8}$/.test(p)) return '+45' + p;
  return p;
}

// Twilio sender webhook her: POST /api/twilio/sms
router.post('/sms', (req, res) => {
  const fromRaw = req.body.From;
  const bodyRaw = req.body.Body;

  console.log('Indgående SMS:', fromRaw, bodyRaw);

  const fromPhone = normalizePhone(fromRaw);
  const text = (bodyRaw || '').trim().toLowerCase();

  let newStatus = null;
  if (text === 'ja') newStatus = 'confirmed';
  if (text === 'nej') newStatus = 'declined';

  const twiml = new MessagingResponse();

  if (!newStatus) {
    twiml.message('Svar JA for at bekræfte eller NEJ for at afvise.');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // 🔐 NYT: hent alle relevante rows og match i Node
  db.all(
    `
    SELECT id, experience_id, status, phone
    FROM waitlist
    WHERE status IN ('waiting','invited')
    ORDER BY created_at DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error('DB fejl:', err);
        twiml.message('Der opstod en fejl. Prøv igen senere.');
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      let matchedRow = null;

      for (const row of rows) {
        const phonePlain = row.phone ? decrypt(row.phone) : null;
        if (!phonePlain) continue;

        const norm = normalizePhone(phonePlain);
        if (norm === fromPhone) {
          matchedRow = row;
          break;
        }
      }

      if (!matchedRow) {
        twiml.message('Vi kunne ikke finde din venteliste-tilmelding.');
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      // Opdater status
      db.run(
        `UPDATE waitlist SET status = ? WHERE id = ?`,
        [newStatus, matchedRow.id],
        (updateErr) => {
          if (updateErr) {
            console.error('Opdateringsfejl:', updateErr);
            twiml.message('Fejl ved opdatering.');
            res.type('text/xml');
            return res.send(twiml.toString());
          }

          if (newStatus === 'confirmed') {
            twiml.message('Tak! Du har nu bekræftet din plads.');
          } else {
            twiml.message('Du har nu afvist pladsen.');
          }

          res.type('text/xml');
          res.send(twiml.toString());
        }
      );
    }
  );
});


module.exports = router;
