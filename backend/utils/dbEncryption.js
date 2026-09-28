const crypto = require('crypto');
const path = require('path');

// Ensure .env is loaded with an absolute path regardless of cwd
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const algorithm = 'aes-256-cbc';
const fixedIv = Buffer.alloc(16, 0);

// Default key used when encrypting data stored in the database
const DEFAULT_LEGACY_KEY = 'your_super_secret_jwt_key_here';
const FALLBACK_KEY = 'TalentHubSecureSecretKey2026!@#';

/**
 * Returns candidate secrets in priority order for decryption and query generation
 */
function getCandidateSecrets() {
  const secrets = [
    process.env.DB_ENCRYPTION_KEY,
    DEFAULT_LEGACY_KEY,
    process.env.JWT_SECRET,
    FALLBACK_KEY,
  ].filter(Boolean);
  return Array.from(new Set(secrets));
}

function getPrimaryKey() {
  const secret = process.env.DB_ENCRYPTION_KEY || DEFAULT_LEGACY_KEY;
  return crypto.scryptSync(secret, 'salt', 32);
}

function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;

  // Backward compatibility: If already encrypted, return as is
  if (typeof text === 'string' && (text.startsWith('ENC:') || text.startsWith('enc:'))) return text;

  try {
    const key = getPrimaryKey();
    const cipher = crypto.createCipheriv(algorithm, key, fixedIv);
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
  const secrets = getCandidateSecrets();

  for (const s of secrets) {
    try {
      const key = crypto.scryptSync(s, 'salt', 32);
      const decipher = crypto.createDecipheriv(algorithm, key, fixedIv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted !== undefined && decrypted !== null) {
        return decrypted;
      }
    } catch (error) {
      // Try next candidate secret
    }
  }

  // Fallback to returning the original string if all decryptions fail
  return text;
}

/**
 * Returns a list of all potential ciphertext representations (and plaintexts)
 * across all candidate secrets so MongoDB queries reliably match.
 */
function getCandidateCiphertexts(text) {
  if (text === null || text === undefined || text === '') return [];
  const str = String(text).trim();
  const lowerStr = str.toLowerCase();

  const candidates = new Set([str, lowerStr]);
  const secrets = getCandidateSecrets();

  for (const s of secrets) {
    try {
      const k = crypto.scryptSync(s, 'salt', 32);
      const cipher = crypto.createCipheriv(algorithm, k, fixedIv);
      let enc = cipher.update(lowerStr, 'utf8', 'hex');
      enc += cipher.final('hex');
      candidates.add(`enc:${enc}`);
      candidates.add(`ENC:${enc}`);
    } catch (e) {}

    if (str !== lowerStr) {
      try {
        const k = crypto.scryptSync(s, 'salt', 32);
        const cipher = crypto.createCipheriv(algorithm, k, fixedIv);
        let enc = cipher.update(str, 'utf8', 'hex');
        enc += cipher.final('hex');
        candidates.add(`enc:${enc}`);
        candidates.add(`ENC:${enc}`);
      } catch (e) {}
    }
  }

  return Array.from(candidates);
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper to build a MongoDB $or query that matches against either
 * candidate encrypted values or case-insensitive plaintext.
 */
function buildFieldQuery(fieldName, value) {
  if (value === null || value === undefined || value === '') {
    return { [fieldName]: value };
  }
  const str = String(value).trim();
  const lowerStr = str.toLowerCase();
  const candidates = getCandidateCiphertexts(str);
  const escaped = escapeRegex(str);
  const escapedLower = escapeRegex(lowerStr);

  const orConditions = [
    { [fieldName]: { $in: candidates } },
    { [fieldName]: new RegExp(`^${escaped}$`, 'i') },
  ];
  if (escaped !== escapedLower) {
    orConditions.push({ [fieldName]: new RegExp(`^${escapedLower}$`, 'i') });
  }

  return { $or: orConditions };
}

function buildEmailQuery(email) {
  return buildFieldQuery('email', email);
}

module.exports = {
  encrypt,
  decrypt,
  getCandidateCiphertexts,
  buildFieldQuery,
  buildEmailQuery,
};

