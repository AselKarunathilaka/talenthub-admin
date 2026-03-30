const Joi = require("joi");

const validateIntern = (req, res, next) => {
  const schema = Joi.object({
    traineeId: Joi.string().required(),
    traineeName: Joi.string().required(),
    fieldOfSpecialization: Joi.string().required(),
    team: Joi.string().allow(""),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

// Validate daily attendance QR scan request
const validateDailyAttendanceQR = (req, res, next) => {
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    internId: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      success: false,
      message: error.details[0].message 
    });
  }

  next();
};

// Rate limiting middleware for QR scanning to prevent abuse
const rateLimitQRScan = (req, res, next) => {
  const { internId } = req.body;
  const now = Date.now();
  
  // In production, use Redis or database for rate limiting
  // For now, using in-memory storage
  if (!global.scanAttempts) {
    global.scanAttempts = new Map();
  }
  
  const attempts = global.scanAttempts.get(internId) || [];
  
  // Remove attempts older than 1 minute
  const recentAttempts = attempts.filter(timestamp => now - timestamp < 60000);
  
  // Allow maximum 3 attempts per minute
  if (recentAttempts.length >= 3) {
    return res.status(429).json({
      success: false,
      message: "Too many scan attempts. Please wait a moment before trying again."
    });
  }
  
  recentAttempts.push(now);
  global.scanAttempts.set(internId, recentAttempts);
  
  next();
};

module.exports = { 
  validateIntern, 
  validateLogin, 
  validateDailyAttendanceQR,
  rateLimitQRScan
};
