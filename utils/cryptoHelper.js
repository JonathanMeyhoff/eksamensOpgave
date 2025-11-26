// utils/cryptoHelper.js
const crypto = require('crypto');

const secret = process.env.CRYPTO_SECRET;

// Vi afleder en 256-bit nøgle ud fra hemmeligheden (passphrase)
let key = null;
if (!secret) {
  console.warn('CRYPTO_SECRET mangler – kryptering af venteliste bliver no-op (lagrer klartekst).');
} else {
  key = crypto.createHash('sha256').update(String(secret)).digest(); // 32 bytes
}

/**
 * Krypterer en tekststreng med AES-256-GCM.
 * Returnerer en streng: iv:tag:cipher (alle i base64)
 */
function encrypt(text) {
  if (!text) return null;
  if (!key) {
    // fallback hvis CRYPTO_SECRET ikke er sat – vi gemmer bare klartekst
    return text;
  }

  const iv = crypto.randomBytes(12); // 96-bit IV til GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted
  ].join(':');
}

/**
 * Dekrypterer en streng fra encrypt().
 */
function decrypt(payload) {
  if (!payload) return null;
  if (!key) {
    // fallback – antag at der ligger klartekst
    return payload;
  }

  try {
    const [ivB64, tagB64, enc] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(enc, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decrypt error:', err.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
