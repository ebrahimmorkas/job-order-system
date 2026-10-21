const Joi = require('joi');

// POST /api/auth/login. The identifier is a username, email or phone number.
// The password's own rules are not re-checked here - a wrong password is just
// "Invalid credentials", whatever it looks like.
const loginSchema = Joi.object({
    identifier: Joi.string().trim().max(254).required().label('Username, email or phone number'),
    password: Joi.string().max(128).required().label('Password')
});

module.exports = {
    loginSchema
};
