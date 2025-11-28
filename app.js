require('dotenv').config();

var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');

var ventelisteRouter = require('./routes/venteliste');
var twilioRouter = require('./routes/twilioRoute');
var twilioWebhookRouter = require('./routes/twilioWebHook');
var indexRouter = require('./routes/index');
var oplevelserRouter = require('./routes/oplevelser');
var authRouter = require('./routes/auth');

var app = express();

// ---------------------------------------------------
// Basis-middleware
// ---------------------------------------------------
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ---------------------------------------------------
// JWT-middleware til at beskytte sider
// ---------------------------------------------------
function verifyJwt(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    // Ikke logget ind -> send til login-side
    return res.redirect('/login');
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    console.error('JWT verify error i app.js:', err.message);
    return res.redirect('/login');
  }
}

// ---------------------------------------------------
// Siderelaterede routes (før static)
// ---------------------------------------------------

// Login-side (altid åben)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Beskyt admin med JWT
app.get('/admin', verifyJwt, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Hvis nogen skriver /admin.html direkte
app.get('/admin.html', verifyJwt, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------------------------------------------------
// Statiske filer (brugerSide, css, js osv.)
// ---------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------
// API-routes
// ---------------------------------------------------
app.use('/', indexRouter);
app.use('/api', ventelisteRouter);
app.use('/api', twilioRouter);
app.use('/api/twilio', twilioWebhookRouter);
app.use('/api', oplevelserRouter);
app.use('/api/auth', authRouter);

module.exports = app;

