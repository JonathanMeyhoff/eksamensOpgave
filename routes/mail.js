// routes/mail.js
const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/emailClient');

router.post('/mail', async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({ success: false, message: 'Manglende felter' });
    }

    const result = await sendEmail(to, subject, text);
    console.log('EMAIL sendt:', result.messageId);

    res.json({ success: true, message: 'Email sendt' });
  } catch (error) {
    console.error('Fejl ved EMAIL til', req.body.to, ':', error.message);
    res.status(500).json({ success: false, message: 'Fejl ved afsendelse af mail' });
  }
});

module.exports = router;
