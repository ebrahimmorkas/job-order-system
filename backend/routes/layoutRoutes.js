const express = require('express');
const router = express.Router();
const layoutController = require('../controllers/layoutController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/layoutValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Nothing
// works while Layout Master is off on either side.
router.use(requireFeature(FEATURE_FLAGS.LAYOUT_MASTER));

const byId = validate(v.layoutIdParamSchema, 'params');

// Printing a job order: any logged-in user of the vendor.
router.get('/for-print', layoutController.listLayoutsForPrint);
router.get('/for-print/:id', byId, layoutController.getLayoutForPrint);

// Everything else: the owner only.
router.use(authorize(ROLES.OWNER));

// Above '/:id', so "form-data" and "bulk" are never read as an id.
router.get('/form-data', layoutController.getFormData);
router.post('/bulk', validate(v.bulkLayoutsSchema), layoutController.bulkUpdateLayouts);

router.get('/', validate(v.listLayoutsQuerySchema, 'query'), layoutController.listLayouts);
router.post('/', validate(v.layoutSchema), layoutController.createLayout);
router.get('/:id', byId, layoutController.getLayout);
router.put('/:id', byId, validate(v.layoutSchema), layoutController.updateLayout);
router.patch('/:id/default', byId, layoutController.setDefaultLayout);
router.patch('/:id/status', byId, validate(v.statusSchema), layoutController.setLayoutStatus);
router.delete('/:id', byId, layoutController.deleteLayout);

module.exports = router;
