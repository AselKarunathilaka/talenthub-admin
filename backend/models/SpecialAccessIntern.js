const mongoose = require('mongoose');

const specialAccessInternSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  internId: {
    type: String,
    required: false
  },
  grantedAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('SpecialAccessIntern', specialAccessInternSchema);
