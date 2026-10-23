const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/roleValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Owner only,
// and nothing works while RBAC is off on either side.
router.use(authorize(ROLES.OWNER), requireFeature(FEATURE_FLAGS.RBAC));

const byId = validate(v.roleIdParamSchema, 'params');

// Above '/:id', so "form-data" and "bulk" are never read as an id.
router.get('/form-data', roleController.getFormData);
router.post('/bulk', validate(v.bulkRolesSchema), roleController.bulkUpdateRoles);

router.get('/', validate(v.listRolesQuerySchema, 'query'), roleController.listRoles);
router.post('/', validate(v.createRoleSchema), roleController.createRole);
router.get('/:id', byId, roleController.getRole);
router.put('/:id', byId, validate(v.updateRoleSchema), roleController.updateRole);
router.patch('/:id/status', byId, validate(v.statusSchema), roleController.setRoleStatus);
router.delete('/:id', byId, roleController.deleteRole);

module.exports = router;
