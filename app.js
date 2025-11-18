require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var ventelisteRouter = require('./routes/venteliste');
var twilioRouter = require('./routes/twilioRoute');
var twilioWebhookRouter = require('./routes/twilioWebHook');
var indexRouter = require('./routes/index');
var oplevelserRouter = require('./routes/oplevelser');

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

module.exports = app;
