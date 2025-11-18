const express = require('express');
const { body, validationResult } = require('express-validator');
const { sendSms } = require('../utils/twilioClient');

const router = express.Router();

router.post(
  '/sms-test',
  body('to').isString(),
  body('message').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, message } = req.body;

    try {
      const result = await sendSms(to, message);
      res.json({
        status: 'ok',
        sid: result.sid,
        elapsedMs: result.elapsedMs
      });
    } catch (err) {
      console.error('Twilio fejl:', err.message);
      res.status(500).json({ status: 'twilio_error', message: err.message });
    }
  }
);

module.exports = router;
