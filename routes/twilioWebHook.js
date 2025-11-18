// routes/twilioWebHook.js
const express = require('express');
const db = require('../db');
const twilio = require('twilio');

const router = express.Router();
const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * Normaliserer telefonnummer så det matcher det vi gemmer i DB
 * (samme logik som i venteliste.js)
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Fjern mellemrum
  let p = phone.replace(/\s+/g, '');

  // Hvis det allerede er +45xxxxxxx
  if (p.startsWith('+')) {
    return p;
  }

  // Hvis det starter med 0045xxxxxx
  if (p.startsWith('0045')) {
    return '+45' + p.slice(4);
  }

  // Hvis det er 8 cifre (dansk nummer uden landekode)
  if (/^\d{8}$/.test(p)) {
    return '+45' + p;
  }

  // Hvis det er 10 cifre og starter med 45...
  if (/^45\d{8}$/.test(p)) {
    return '+' + p;
  }

  // Ellers returnér som det er
  return p;
}

// Twilio webhook – når en bruger svarer på SMS
router.post('/webhook', express.urlencoded({ extended: false }), (req, res) => {
  const rawFrom = req.body.From || '';
  const from = normalizePhone(rawFrom);
  const body = (req.body.Body || '').trim().toUpperCase();

  console.log('Twilio webhook kaldt:', {
    rawFrom,
    normalizedFrom: from,
    body
  });

  // Hvis vi ikke har et gyldigt afsendernummer → svar tomt
  if (!from) {
    const twiml = new MessagingResponse();
    res.type('text/xml').send(twiml.toString());
    return;
  }

  let newStatus;
  let replyText;

  if (body === 'JA') {
    newStatus = 'confirmed';
    replyText =
      'Tak for din bekræftelse – du har nu en plads til oplevelsen. Vi glæder os til at se dig!';
  } else if (body === 'NEJ') {
    newStatus = 'declined';
    replyText =
      'Tak for dit svar – vi giver pladsen videre til næste på ventelisten.';
  } else {
    // Ukendt svar → ingen DB-opdatering, men send en hjælpetekst
    const twiml = new MessagingResponse();
    twiml.message('Jeg forstod ikke dit svar. Svar venligst JA eller NEJ på denne besked.');
    res.type('text/xml').send(twiml.toString());
    return;
  }

  // Opdater rækken(e) for dette telefonnummer
  db.run(
    `
    UPDATE waitlist
    SET status = ?
    WHERE phone = ?
    `,
    [newStatus, from],
    function (err) {
      if (err) {
        console.error('Fejl ved UPDATE i webhook:', err);
        // Ved fejl svarer vi stadig med en høflig besked
        const twiml = new MessagingResponse();
        twiml.message('Der opstod en fejl ved registrering af dit svar. Prøv igen senere.');
        res.type('text/xml').send(twiml.toString());
        return;
      }

      console.log('Webhook UPDATE result:', {
        from,
        newStatus,
        changedRows: this.changes
      });

      const twiml = new MessagingResponse();
      twiml.message(replyText);
      res.type('text/xml').send(twiml.toString());
    }
  );
});

module.exports = router;
