const express = require('express');
const router = express.Router();
const controlController = require('../controllers/controlController');
const requirePermission = require('../middlewares/requirePermission');
const { bulkPermission } = requirePermission;
const requireFeature = require('../middlewares/requireFeature');
const requireAssignedControls = require('../middlewares/requireAssignedControls');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/controlValidations');
const { FEATURE_FLAGS, FEATURE_READ_OVERRIDES } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate).

// The job order form: any logged-in user of the vendor (empty when no type is
// assigned). Also works while the vendor's controls feature is off, if
// fetchControlsEvenWhenBitIsOff is on.
router.get('/for-job-order',
    requireFeature(FEATURE_FLAGS.CONTROLS, { orCompanyFlag: FEATURE_READ_OVERRIDES.CONTROLS_FOR_JOB_ORDER }),
    controlController.getControlsForJobOrder);

// Everything else: the feature on, at least one type assigned, and the owner
// or a user whose roles give the permission.
router.use(requireFeature(FEATURE_FLAGS.CONTROLS), requireAssignedControls);

const can = (permission) => requirePermission('controls', permission);

const byId = validate(v.controlIdParamSchema, 'params');

router.get('/', can('view'), validate(v.listControlsQuerySchema, 'query'), controlController.listControls);
router.post('/', can('create'), validate(v.controlSchema), controlController.createControl);
// Above '/:id', so "bulk" is never read as an id.
router.post('/bulk', can(bulkPermission), validate(v.bulkControlsSchema), controlController.bulkUpdateControls);

router.get('/:id', can('view'), byId, controlController.getControl);
router.put('/:id', can('edit'), byId, validate(v.controlSchema), controlController.updateControl);
router.patch('/:id/status', can('edit'), byId, validate(v.statusSchema), controlController.setControlStatus);
router.patch('/:id/move', can('edit'), byId, validate(v.moveSchema), controlController.moveControl);
router.delete('/:id', can('delete'), byId, controlController.deleteControl);

module.exports = router;
