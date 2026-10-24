const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const requirePermission = require('../middlewares/requirePermission');
const imageUpload = require('../middlewares/imageUpload');
const requireFeature = require('../middlewares/requireFeature');
const requireAssignedCountries = require('../middlewares/requireAssignedCountries');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/companySettingsValidations');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). The owner,
// or a user whose roles give the permission.
const canView = requirePermission('companySettings', 'view');
const canEdit = requirePermission('companySettings', 'edit');

// General
router.get('/', canView, companySettingsController.getGeneralSettings);
router.put('/general', canEdit, validate(v.generalSettingsSchema), companySettingsController.updateGeneralSettings);
router.put('/job-order', canEdit, validate(v.jobOrderSettingsSchema), companySettingsController.updateJobOrderSettings);
router.put('/logo', canEdit, imageUpload.single('logo'), validate(v.logoUploadSchema, 'body'), companySettingsController.uploadLogo);

// Tax - the tax feature on, and at least one country assigned.
const taxAccess = [requireFeature(FEATURE_FLAGS.TAX), requireAssignedCountries];
router.get('/tax', canView, ...taxAccess, companySettingsController.getTaxSettings);
router.put('/tax/:countryId', canEdit, ...taxAccess, validate(v.countryIdParamSchema, 'params'), validate(v.taxDetailsSchema), companySettingsController.updateTaxDetails);

module.exports = router;
