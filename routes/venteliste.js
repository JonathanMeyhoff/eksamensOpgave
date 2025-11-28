// routes/venteliste.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { sendSms } = require('../utils/twilioClient');
const { sendEmail } = require('../utils/emailClient');
const { encrypt, decrypt } = require('../utils/cryptoHelper');

const router = express.Router();

function normalizePhone(phone) {
    if (!phone) return null;
  
    // fjern mellemrum
    let p = phone.replace(/\s+/g, '');
  
    // hvis den allerede starter med +, så returnér som den er
    if (p.startsWith('+')) {
      return p;
    }
  
    // hvis 0045..., lav om til +45...
    if (p.startsWith('0045')) {
      return '+45' + p.slice(4);
    }
  
    // hvis den er 8 tal (dansk nummer), tilføj +45
    if (/^\d{8}$/.test(p)) {
      return '+45' + p;
    }
  
    // ellers returnér som den er
    return p;
  }
  

// POST /api/venteliste
router.post(
  '/venteliste',
  body('experienceId').isInt({ gt: 0 }),
  body('name').isLength({ min: 1 }),
  body('phone').optional().isString(),
  body('email').optional().isEmail(),
  (req, res) => {
    console.log('POST /api/venteliste body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { experienceId, name, phone, email } = req.body;
    const normalizedPhone = normalizePhone(phone);

    // kræv mindst telefon eller email
    if (!normalizedPhone && !email) {
      console.log('Validation error: hverken phone eller email udfyldt');
      return res.status(400).json({
        error: 'contact_required',
        message: 'Du skal mindst udfylde telefon eller email'
      });
    }

    // 🔐 NYT: krypter data før de ryger i DB
    const phoneEncrypted = normalizedPhone ? encrypt(normalizedPhone) : null;
    const emailEncrypted = email ? encrypt(email) : null;

    db.run(
      `INSERT INTO waitlist (experience_id, name, phone, email, status)
       VALUES (?, ?, ?, ?, 'waiting')`,
       [experienceId, name, phoneEncrypted, emailEncrypted],
       function (err) {
        if (err) {
          console.error('DB insert error:', err);
          return res.status(500).json({ error: 'db_error' });
        }
        console.log('Inserted row id:', this.lastID);
        res.status(201).json({ id: this.lastID });
      }
    );
  }
);


// GET /api/venteliste/:experienceId
router.get('/venteliste/:experienceId', (req, res) => {
  const experienceId = Number(req.params.experienceId);

  db.all(
    `SELECT * FROM waitlist
     WHERE experience_id = ?
     ORDER BY created_at ASC`,
    [experienceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'db_error' });
      }

      // 🔐 NYT: dekrypter inden vi sender til frontend (admin.js)
      const decrypted = rows.map(row => ({
        ...row,
        phone: row.phone ? decrypt(row.phone) : null,
        email: row.email ? decrypt(row.email) : null
      }));

      res.json({ waitlist: decrypted });
    }
  );
});


// POST /api/venteliste/notify-all/:experienceId
router.post('/venteliste/notify-all/:experienceId', (req, res) => {
  const experienceId = Number(req.params.experienceId);
  console.log('Notify-all for experienceId:', experienceId);

  db.all(
    `SELECT * FROM waitlist
     WHERE experience_id = ? AND status = 'waiting'
     ORDER BY created_at ASC`,
    [experienceId],
    async (err, rows) => {
      if (err) {
        console.error('DB select error:', err);
        return res.status(500).json({ error: 'db_error' });
      }

      if (!rows || rows.length === 0) {
        console.log('Ingen waiting-brugere for experience', experienceId);
        return res.status(404).json({ error: 'no_waiting_users' });
      }

      console.log(`Finder ${rows.length} brugere i køen for experience ${experienceId}`);

      // 🔐 NYT: dekrypter phone & email til brug i loopet
      const plainRows = rows.map(row => ({
        ...row,
        phone: row.phone ? decrypt(row.phone) : null,
        email: row.email ? decrypt(row.email) : null
      }));

      const successes = [];
      const failures = [];
      const skippedNoPhone = [];

      function updateRowStatus(rowId, sid) {
        return new Promise((resolve, reject) => {
          db.run(
            `UPDATE waitlist
             SET status = 'invited', last_sms_sid = ?
             WHERE id = ?`,
            [sid, rowId],
            function (updateErr) {
              if (updateErr) return reject(updateErr);
              resolve();
            }
          );
        });
      }

      try {
        // brug plainRows i stedet for rows
        for (const row of plainRows) {
          const hasPhone = !!row.phone;
          const hasEmail = !!row.email;

          if (!hasPhone && !hasEmail) {
            console.log('Springer bruger over uden kontaktinfo (hverken telefon eller email):', row);
            skippedNoPhone.push({
              id: row.id,
              name: row.name,
              experienceId: row.experience_id
            });
            continue;
          }

          const messageText =
            `Hej ${row.name}, der er blevet en plads ledig til oplevelse ${row.experience_id}. ` +
            `Svar JA for at bekræfte eller NEJ for at afvise.`;

          let smsResult = null;
          let emailResult = null;
          let anySuccess = false;

          if (hasPhone) {
            console.log('Sender SMS til', row.phone, 'med tekst:', messageText);
            try {
              const result = await sendSms(row.phone, messageText);
              console.log('Twilio sendte SMS, sid:', result.sid, 'elapsedMs:', result.elapsedMs);
              smsResult = result;
              anySuccess = true;
            } catch (smsErr) {
              console.error('Fejl ved SMS til', row.phone, ':', smsErr.message);
              failures.push({
                id: row.id,
                name: row.name,
                phone: row.phone,
                email: row.email,
                experienceId: row.experience_id,
                channel: 'sms',
                error: smsErr.message
              });
            }
          }

          if (hasEmail) {
            console.log('Sender EMAIL til', row.email, 'med tekst:', messageText);
            try {
              const subject = `Plads ledig til oplevelse ${row.experience_id}`;
              const result = await sendEmail(row.email, subject, messageText);
              console.log('SMTP sendte email, messageId:', result.messageId);
              emailResult = result;
              anySuccess = true;
            } catch (mailErr) {
              console.error('Fejl ved EMAIL til', row.email, ':', mailErr.message);
              failures.push({
                id: row.id,
                name: row.name,
                phone: row.phone,
                email: row.email,
                experienceId: row.experience_id,
                channel: 'email',
                error: mailErr.message
              });
            }
          }

          if (anySuccess) {
            const sidToStore = smsResult ? smsResult.sid : null;
            await updateRowStatus(row.id, sidToStore);

            successes.push({
              id: row.id,
              name: row.name,
              phone: row.phone,
              email: row.email,
              experienceId: row.experience_id,
              smsSid: smsResult ? smsResult.sid : null,
              emailMessageId: emailResult ? emailResult.messageId : null
            });
          }
        }

        // ... resten af din stats-kode er uændret
        // (jeg lader resten stå som i din nuværende fil)
      } catch (loopErr) {
        console.error('Generel fejl i notify-all-loop:', loopErr);
        res.status(500).json({ error: 'notify_all_failed', message: loopErr.message });
      }
    }
  );
});


module.exports = router;
