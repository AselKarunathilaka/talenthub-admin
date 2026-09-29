const crypto = require('crypto');
const path = require('path');

// Ensure .env is loaded with an absolute path regardless of cwd
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const algorithm = 'aes-256-cbc';

// Primary encryption secret:
// 1. DB_ENCRYPTION_KEY (configured in deploy.yml and .env)
// 2. Default key used when MongoDB records were originally encrypted
const PRIMARY_SECRET = process.env.DB_ENCRYPTION_KEY || 'your_super_secret_jwt_key_here';
const primaryKey = crypto.scryptSync(PRIMARY_SECRET, 'salt', 32);

// We use a fixed IV for deterministic encryption so that we can query exactly (e.g. User.findOne({ email: encrypt(email) }))
// Note: In highly sensitive environments, deterministic encryption can be vulnerable to frequency analysis, 
// but it is required here for searchable fields without using complex blind indexing.
const fixedIv = Buffer.alloc(16, 0);

// Candidate fallback secrets for backward compatibility when decrypting legacy records
const FALLBACK_SECRETS = [
  'your_super_secret_jwt_key_here',
  process.env.JWT_SECRET,
  'TalentHubSecureSecretKey2026!@#'
].filter(Boolean);

function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;

  // Backward compatibility: If already encrypted, return as is
  if (typeof text === 'string' && (text.startsWith('ENC:') || text.startsWith('enc:'))) return text;

  try {
    const cipher = crypto.createCipheriv(algorithm, primaryKey, fixedIv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
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

  const encryptedText = String(text).slice(4); // Remove prefix

  // 1. Try decrypting with primary key
  try {
    const decipher = crypto.createDecipheriv(algorithm, primaryKey, fixedIv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // 2. Fallback: try candidate secrets
    for (const altSecret of FALLBACK_SECRETS) {
      if (altSecret === PRIMARY_SECRET) continue;
      try {
        const altKey = crypto.scryptSync(altSecret, 'salt', 32);
        const altDecipher = crypto.createDecipheriv(algorithm, altKey, fixedIv);
        let altDecrypted = altDecipher.update(encryptedText, 'hex', 'utf8');
        altDecrypted += altDecipher.final('utf8');
        return altDecrypted;
      } catch (altError) {
        // Continue to next candidate secret
      }
    }
    console.error('Decryption error:', error);
    return text; // Fallback to returning the encrypted string if decryption fails
  }
}

function getCandidateSecrets() {
  return Array.from(new Set([PRIMARY_SECRET, ...FALLBACK_SECRETS]));
}

function getCandidateCiphertexts(text) {
  if (text === null || text === undefined || text === '') return [];
  const str = String(text).trim();
  const lowerStr = str.toLowerCase();
  const candidates = new Set([str, lowerStr, encrypt(str), encrypt(lowerStr)]);
  return Array.from(candidates);
}

function buildFieldQuery(fieldName, value) {
  if (value === null || value === undefined || value === '') {
    return { [fieldName]: value };
  }
  const str = String(value).trim();
  const lowerStr = str.toLowerCase();
  return {
    $or: [
      { [fieldName]: encrypt(str) },
      { [fieldName]: encrypt(lowerStr) },
      { [fieldName]: str },
      { [fieldName]: lowerStr }
    ]
  };
}

function buildEmailQuery(email) {
  return buildFieldQuery('email', email);
}

module.exports = {
  encrypt,
  decrypt,
  getCandidateSecrets,
  getCandidateCiphertexts,
  buildFieldQuery,
  buildEmailQuery
};
