require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const path = require('path');
const basicAuth = require('basic-auth');

var ventelisteRouter = require('./routes/venteliste');
var twilioRouter = require('./routes/twilioRoute');
var twilioWebhookRouter = require('./routes/twilioWebHook');
var indexRouter = require('./routes/index');
var oplevelserRouter = require('./routes/oplevelser');
require('dotenv').config();

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// statiske filer
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/', indexRouter);
app.use('/api', ventelisteRouter);
app.use('/api', twilioRouter);
app.use('/api/twilio', twilioWebhookRouter);
app.use('/api', oplevelserRouter);

function adminAuth(req, res, next) {
    const user = basicAuth(req);

    if (
        !user ||
        user.name !== process.env.ADMIN_USER ||
        user.pass !== process.env.ADMIN_PASS
    ) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('Authentication required');
    }

    next();
}

app.get('/admin', adminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'backend', 'public', 'admin.html'));
  });
  

module.exports = app;
