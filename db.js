const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DB-filen ligger i samme mappe som db.js
const dbPath = path.join(__dirname, 'data.db');
console.log('SQLite DB path:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Oplevelser (kan udbygges senere)
  db.run(`
    CREATE TABLE IF NOT EXISTS experiences(
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL
    )
  `);

  // Venteliste-kø
  db.run(`
    CREATE TABLE IF NOT EXISTS waitlist(
      id INTEGER PRIMARY KEY,
      experience_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sms_sid TEXT
    )
  `);
});

module.exports = db;
