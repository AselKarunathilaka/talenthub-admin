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

module.exports = { validateIntern, validateLogin };
