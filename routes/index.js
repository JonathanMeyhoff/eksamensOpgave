const express = require('express');
const path = require('path');

const router = express.Router();

/* GET home page – send brugerSide.html */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/brugerSide.html'));
});

module.exports = router;
