const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// JWT middleware til at beskytte endpoints
function verifyJwt(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'no_token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // fx { userId, email }
    next();
  } catch (err) {
    console.error('JWT verify error:', err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
}


// POST /api/auth/register (bruges kun én gang)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email_and_password_required' });
    }

    const hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password_hash) VALUES (?, ?)`,
      [email, hash],
      function (err) {
        if (err) {
          console.error('DB register error:', err);
          return res.status(500).json({ error: 'db_error' });
        }

        return res.status(201).json({ id: this.lastID, email });
      }
    );
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'db_error' });

    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'invalid_credentials' });

    // JWT-token i cookie
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true
    });

    res.json({ message: 'login_ok' });
  });
});

// GET /api/auth/me – kræver login
router.get('/me', verifyJwt, (req, res) => {
  res.json({
    userId: req.user.userId,
    email: req.user.email
  });
});


module.exports = router;
