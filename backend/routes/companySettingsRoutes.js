const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const authorize = require('../middlewares/authorize');
const imageUpload = require('../middlewares/imageUpload');
const validate = require('../middlewares/validate');
const { logoUploadSchema } = require('../middlewares/validations/companySettingsValidations');
const { ROLES } = require('../constants/roleConstants');

// Logged in already (server.js mounts this below authenticate).
router.put('/logo', authorize(ROLES.OWNER), imageUpload.single('logo'), validate(logoUploadSchema, 'body'), companySettingsController.uploadLogo);

module.exports = router;
