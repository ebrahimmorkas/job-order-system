const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { loginSchema } = require('../middlewares/validations/authValidations');

// No public sign-up: a vendor's owner account is created by seeds/seedUser.js,
// and further users come with the RBAC feature.
router.post('/login', validate(loginSchema, 'body'), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

module.exports = router;
