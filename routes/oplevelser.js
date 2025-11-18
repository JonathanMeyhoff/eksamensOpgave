// routes/oplevelser.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

// GET /api/oplevelser – hent alle oplevelser
router.get('/oplevelser', (req, res) => {
  db.all(
    `SELECT id, title FROM experiences ORDER BY id ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('DB error i GET /oplevelser:', err);
        return res.status(500).json({ error: 'db_error' });
      }
      res.json({ oplevelser: rows });
    }
  );
});

// POST /api/oplevelser – opret ny oplevelse
router.post(
  '/oplevelser',
  body('title').isLength({ min: 1 }).withMessage('title required'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title } = req.body;

    db.run(
      `INSERT INTO experiences (title) VALUES (?)`,
      [title],
      function (err) {
        if (err) {
          console.error('DB error i POST /oplevelser:', err);
          return res.status(500).json({ error: 'db_error' });
        }

        res.status(201).json({ id: this.lastID, title });
      }
    );
  }
);

// PUT /api/oplevelser/:id – opdater titel
router.put(
  '/oplevelser/:id',
  body('title').isLength({ min: 1 }).withMessage('title required'),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title } = req.body;

    db.run(
      `UPDATE experiences SET title = ? WHERE id = ?`,
      [title, id],
      function (err) {
        if (err) {
          console.error('DB error i PUT /oplevelser/:id:', err);
          return res.status(500).json({ error: 'db_error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'not_found' });
        }
        res.json({ id, title });
      }
    );
  }
);

module.exports = router;
