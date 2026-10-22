const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const authorize = require('../middlewares/authorize');
const imageUpload = require('../middlewares/imageUpload');
const requireFeature = require('../middlewares/requireFeature');
const requireAssignedCountries = require('../middlewares/requireAssignedCountries');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/companySettingsValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Owner only.
router.use(authorize(ROLES.OWNER));

// General
router.get('/', companySettingsController.getGeneralSettings);
router.put('/general', validate(v.generalSettingsSchema), companySettingsController.updateGeneralSettings);
router.put('/logo', imageUpload.single('logo'), validate(v.logoUploadSchema, 'body'), companySettingsController.uploadLogo);

// Tax - the tax feature on, and at least one country assigned.
const taxAccess = [requireFeature(FEATURE_FLAGS.TAX), requireAssignedCountries];
router.get('/tax', ...taxAccess, companySettingsController.getTaxSettings);
router.put('/tax/:countryId', ...taxAccess, validate(v.countryIdParamSchema, 'params'), validate(v.taxDetailsSchema), companySettingsController.updateTaxDetails);

module.exports = router;
