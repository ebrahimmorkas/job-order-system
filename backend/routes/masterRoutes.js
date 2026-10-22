const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/masterValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS, FEATURE_READ_OVERRIDES } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate).

// The job order form: any logged-in user of the vendor. Also works while the
// vendor's master feature is off, if fetchMastersEvenWhenBitIsOff is on.
router.get('/for-job-order',
    requireFeature(FEATURE_FLAGS.MASTER_MODULE, { orCompanyFlag: FEATURE_READ_OVERRIDES.MASTERS_FOR_JOB_ORDER }),
    masterController.getMastersForJobOrder);

// Everything else: owner only, and nothing works while the master feature is
// off on either side.
router.use(authorize(ROLES.OWNER), requireFeature(FEATURE_FLAGS.MASTER_MODULE));

const byId = validate(v.masterIdParamSchema, 'params');
const byValueId = validate(v.valueIdParamSchema, 'params');

router.get('/', validate(v.listMastersQuerySchema, 'query'), masterController.listMasters);
router.post('/', validate(v.createMasterSchema), masterController.createMaster);
// Above '/:id', so "bulk" is never read as an id.
router.post('/bulk', validate(v.bulkMastersSchema), masterController.bulkUpdateMasters);

router.get('/:id', byId, masterController.getMaster);
router.put('/:id', byId, validate(v.updateMasterSchema), masterController.updateMaster);
router.patch('/:id/status', byId, validate(v.statusSchema), masterController.setMasterStatus);
router.patch('/:id/move', byId, validate(v.moveSchema), masterController.moveMaster);
router.patch('/:id/default', byId, validate(v.defaultValueSchema), masterController.setDefaultValue);
router.delete('/:id', byId, masterController.deleteMaster);

// The values popup on the list; everything else about values is saved with the master (PUT /:id).
router.patch('/:id/values/:valueId/status', byValueId, validate(v.statusSchema), masterController.setValueStatus);
router.patch('/:id/values/:valueId/move', byValueId, validate(v.moveSchema), masterController.moveValue);
router.delete('/:id/values/:valueId', byValueId, masterController.deleteValue);

module.exports = router;
