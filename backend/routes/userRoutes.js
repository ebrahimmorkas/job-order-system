const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requirePermission = require('../middlewares/requirePermission');
const { bulkPermission } = requirePermission;
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/userValidations');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Nothing
// works while RBAC is off on either side; then the owner, or a user whose
// roles give the permission.
router.use(requireFeature(FEATURE_FLAGS.RBAC));

const can = (permission) => requirePermission('users', permission);

const byId = validate(v.userIdParamSchema, 'params');

// Above '/:id', so "form-data" and "bulk" are never read as an id.
// Details too: the user is shown in their form, read only.
router.get('/form-data', can(['create', 'edit', 'details']), userController.getFormData);
router.post('/bulk', can(bulkPermission), validate(v.bulkUsersSchema), userController.bulkUpdateUsers);

router.get('/', can('view'), validate(v.listUsersQuerySchema, 'query'), userController.listUsers);
router.post('/', can('create'), validate(v.createUserSchema), userController.createUser);
router.get('/:id', can('details'), byId, userController.getUser);
router.put('/:id', can('edit'), byId, validate(v.updateUserSchema), userController.updateUser);
router.patch('/:id/status', can('edit'), byId, validate(v.statusSchema), userController.setUserStatus);
router.delete('/:id', can('delete'), byId, userController.deleteUser);

module.exports = router;
