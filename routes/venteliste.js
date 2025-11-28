// routes/venteliste.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { sendSms } = require('../utils/twilioClient');
const { sendEmail } = require('../utils/emailClient');

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
  body('phone').optional({ checkFalsy: true }).isString(),
  body('email').optional({ checkFalsy: true }).isEmail(),
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

db.run(
  `INSERT INTO waitlist (experience_id, name, phone, email, status)
   VALUES (?, ?, ?, ?, 'waiting')`,
  [experienceId, name, normalizedPhone || null, email || null],
  async function (err) {
    if (err) {
      console.error('DB insert error:', err);
      return res.status(500).json({ error: 'db_error' });
    }

    console.log('Inserted row id:', this.lastID);

    const createdId = this.lastID;
    res.status(201).json({ id: createdId });

    if (email) {
      const subject = `Du er på ventelisten til oplevelse ${experienceId}`;
      const text = `Hej ${name},

Du er nu på ventelisten til oplevelsen med ID ${experienceId}.
Vi kontakter dig, når der bliver en ledig plads.

Venlig hilsen
Understory Opgave`;

      sendEmail(email, subject, text)
        .then((result) => {
          console.log('EMAIL sendt til', email, 'messageId:', result.messageId);
        })
        .catch((mailErr) => {
          console.error('Fejl ved EMAIL til', email, ':', mailErr.message);
        });
    }
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
      res.json({ waitlist: rows });
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
        for (const row of rows) {
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

          // SMS hvis vi har telefonnummer
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

          // Email hvis vi har email
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

          // Hvis mindst én kanal lykkedes, opdater status til invited
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

        // Når vi er færdige med at sende, laver vi en ekstra optælling af status
        db.all(
          `
          SELECT status, COUNT(*) as count
          FROM waitlist
          WHERE experience_id = ?
          GROUP BY status
          `,
          [experienceId],
          (statsErr, statRows) => {
            if (statsErr) {
              console.error('Fejl ved hentning af stats:', statsErr);
              return res.json({
                status: 'done',
                experienceId,
                summary: {
                  totalWaiting: rows.length,
                  sentOk: successes.length,
                  failed: failures.length,
                  skippedNoPhone: skippedNoPhone.length
                },
                successes,
                failures,
                skippedNoPhone
              });
            }

            const overallStats = {
              waiting: 0,
              invited: 0,
              confirmed: 0,
              declined: 0,
              total: 0
            };

            for (const r of statRows) {
              overallStats[r.status] = r.count;
              overallStats.total += r.count;
            }

            res.json({
              status: 'done',
              experienceId,
              summary: {
                totalWaiting: rows.length,
                sentOk: successes.length,
                failed: failures.length,
                skippedNoPhone: skippedNoPhone.length
              },
              successes,
              failures,
              skippedNoPhone,
              overallStats
            });
          }
        );
      } catch (loopErr) {
        console.error('Generel fejl i notify-all-loop:', loopErr);
        res.status(500).json({ error: 'notify_all_failed', message: loopErr.message });
      }

    }
  );
});

module.exports = router;
