const db = require('../db');

db.all(
  `SELECT id, experience_id, name, phone, status, created_at
   FROM waitlist
   ORDER BY experience_id ASC, created_at ASC`,
  [],
  (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      process.exit(1);
    }
    console.log('=== ALL WAITLIST ENTRIES ===');
    console.log(rows);
    process.exit(0);
  }
);
