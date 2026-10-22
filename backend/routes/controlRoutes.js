const express = require('express');
const router = express.Router();
const controlController = require('../controllers/controlController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const requireAssignedControls = require('../middlewares/requireAssignedControls');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/controlValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS, FEATURE_READ_OVERRIDES } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate).

// The job order form: any logged-in user of the vendor (empty when no type is
// assigned). Also works while the vendor's controls feature is off, if
// fetchControlsEvenWhenBitIsOff is on.
router.get('/for-job-order',
    requireFeature(FEATURE_FLAGS.CONTROLS, { orCompanyFlag: FEATURE_READ_OVERRIDES.CONTROLS_FOR_JOB_ORDER }),
    controlController.getControlsForJobOrder);

// Everything else: owner only, the feature on, and at least one type assigned.
router.use(authorize(ROLES.OWNER), requireFeature(FEATURE_FLAGS.CONTROLS), requireAssignedControls);

const byId = validate(v.controlIdParamSchema, 'params');

router.get('/', validate(v.listControlsQuerySchema, 'query'), controlController.listControls);
router.post('/', validate(v.controlSchema), controlController.createControl);
// Above '/:id', so "bulk" is never read as an id.
router.post('/bulk', validate(v.bulkControlsSchema), controlController.bulkUpdateControls);

router.get('/:id', byId, controlController.getControl);
router.put('/:id', byId, validate(v.controlSchema), controlController.updateControl);
router.patch('/:id/status', byId, validate(v.statusSchema), controlController.setControlStatus);
router.patch('/:id/move', byId, validate(v.moveSchema), controlController.moveControl);
router.delete('/:id', byId, controlController.deleteControl);

module.exports = router;
