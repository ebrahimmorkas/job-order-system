const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const requirePermission = require('../middlewares/requirePermission');
const { bulkPermission } = requirePermission;
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/roleValidations');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Nothing
// works while RBAC is off on either side; then the owner, or a user whose
// roles give the permission.
router.use(requireFeature(FEATURE_FLAGS.RBAC));

const can = (permission) => requirePermission('roles', permission);

const byId = validate(v.roleIdParamSchema, 'params');

// Above '/:id', so "form-data" and "bulk" are never read as an id.
router.get('/form-data', can(['create', 'edit']), roleController.getFormData);
router.post('/bulk', can(bulkPermission), validate(v.bulkRolesSchema), roleController.bulkUpdateRoles);

router.get('/', can('view'), validate(v.listRolesQuerySchema, 'query'), roleController.listRoles);
router.post('/', can('create'), validate(v.createRoleSchema), roleController.createRole);
router.get('/:id', can('view'), byId, roleController.getRole);
router.put('/:id', can('edit'), byId, validate(v.updateRoleSchema), roleController.updateRole);
router.patch('/:id/status', can('edit'), byId, validate(v.statusSchema), roleController.setRoleStatus);
router.delete('/:id', can('delete'), byId, roleController.deleteRole);

module.exports = router;
