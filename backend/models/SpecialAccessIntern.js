const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/dbEncryption');

const specialAccessInternSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    set: encrypt,
    get: decrypt
  },
  internId: {
    type: String,
    required: false,
    set: encrypt,
    get: decrypt
  },
  grantedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { toJSON: { getters: true }, toObject: { getters: true } });

module.exports = mongoose.model('SpecialAccessIntern', specialAccessInternSchema);
