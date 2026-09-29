const crypto = require('crypto');
require('dotenv').config();

const algorithm = 'aes-256-cbc';
// Use JWT_SECRET as the base for the encryption key, fallback if not present (not recommended for production)
const secret = process.env.JWT_SECRET || 'TalentHubSecureSecretKey2026!@#';
const key = crypto.scryptSync(secret, 'salt', 32);

// We use a fixed IV for deterministic encryption so that we can query exactly (e.g. User.findOne({ email: encrypt(email) }))
// Note: In highly sensitive environments, deterministic encryption can be vulnerable to frequency analysis, 
// but it is required here for searchable fields without using complex blind indexing.
const fixedIv = Buffer.alloc(16, 0); 

function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;
  
  // Backward compatibility: If already encrypted, return as is
  if (typeof text === 'string' && (text.startsWith('ENC:') || text.startsWith('enc:'))) return text;

  try {
    const cipher = crypto.createCipheriv(algorithm, key, fixedIv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

function decrypt(text) {
  if (text === null || text === undefined || text === '') return text;
  
  // Backward compatibility: If not encrypted, return as is (assumes plaintext)
  if (typeof text === 'string' && !(text.startsWith('ENC:') || text.startsWith('enc:'))) return text;

  try {
    const encryptedText = text.slice(4); // Remove prefix
    const decipher = crypto.createDecipheriv(algorithm, key, fixedIv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return text; // Fallback to returning the encrypted string if decryption fails
  }
}

module.exports = {
  encrypt,
  decrypt
};
