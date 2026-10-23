const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/userValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Owner only,
// and nothing works while RBAC is off on either side.
router.use(authorize(ROLES.OWNER), requireFeature(FEATURE_FLAGS.RBAC));

const byId = validate(v.userIdParamSchema, 'params');

// Above '/:id', so "form-data" and "bulk" are never read as an id.
router.get('/form-data', userController.getFormData);
router.post('/bulk', validate(v.bulkUsersSchema), userController.bulkUpdateUsers);

router.get('/', validate(v.listUsersQuerySchema, 'query'), userController.listUsers);
router.post('/', validate(v.createUserSchema), userController.createUser);
router.get('/:id', byId, userController.getUser);
router.put('/:id', byId, validate(v.updateUserSchema), userController.updateUser);
router.patch('/:id/status', byId, validate(v.statusSchema), userController.setUserStatus);
router.delete('/:id', byId, userController.deleteUser);

module.exports = router;
