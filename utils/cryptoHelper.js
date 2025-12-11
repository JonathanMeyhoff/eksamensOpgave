// utils/cryptoHelper.js
const crypto = require('crypto');

const secret = process.env.CRYPTO_SECRET;

// Vi afleder en 256-bit nøgle ud fra hemmeligheden (passphrase)
let key = null;
if (!secret) {
  console.warn('CRYPTO_SECRET mangler – kryptering af venteliste bliver no-op (lagrer klartekst).');
} else {
  key = crypto.createHash('sha256').update(String(secret)).digest(); // vores kodeord laves om til en 32 bytes lang kode. Dette er også kendt som en "AES-256-nøglen"
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

  const iv = crypto.randomBytes(12); // Engangsværdien der generer en tilfældig streng på 12 bytes, og samme tekst generer en anderledes Ciphertext

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); // AEC anvendes til at 

  // her krypteres selve dataen, og sættes ind i databasen. (email og telefon nummer) - Det er den sidste streng i databasen
  let encrypted = cipher.update(text, 'utf8', 'base64'); 
  encrypted += cipher.final('base64');


  //En Authentication til at tjekke om dataen er manipuleret med eller ej. 
  const authTag = cipher.getAuthTag();

  // Her laves den endelige streng i databasen. Og er en samling af IV, AuthTag og Encrypted.
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted
  ].join(':');
}


 //Dekrypterer strengen fra encrypt().

function decrypt(data) {
  if (!data) return null;
  if (!key) {
    // fallback – antag at der ligger klartekst
    return data;
  }

  try {
    const [ivB64, tagB64, enc] = data.split(':'); // de tre strenge splittes hver gang den møder ":"

    //laver den krypterede kode tilbage til en binære buffer (to første strenge). 
    const iv = Buffer.from(ivB64, 'base64'); 
    const authTag = Buffer.from(tagB64, 'base64');

    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);//Der skabes en decipher med samme algoritme, nøgle og IV.
    decipher.setAuthTag(authTag); // den tjekker om krypteringen er blevet ændret (manipuleret)

    //Selve dekrypteringen sker her.
    let decrypted = decipher.update(enc, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    
    return decrypted;
  } catch (err) {
    console.error('Decrypt error:', err.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
