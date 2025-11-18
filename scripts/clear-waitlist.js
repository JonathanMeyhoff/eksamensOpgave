const db = require('../db');

db.run('DELETE FROM waitlist', [], function (err) {
  if (err) {
    console.error('Fejl ved clearing:', err);
    process.exit(1);
  }
  console.log(`Slettede ${this.changes} rækker fra waitlist`);
  process.exit(0);
});
