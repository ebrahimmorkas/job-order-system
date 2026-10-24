const express = require('express');
const router = express.Router();
const myWorkController = require('../controllers/myWorkController');
const authorize = require('../middlewares/authorize');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/myWorkValidations');
const { ROLES } = require('../constants/roleConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Users only
// (the owner is never given work), and only while RBAC is on.
router.use(authorize(ROLES.USER), requireFeature(FEATURE_FLAGS.RBAC));

router.get('/', validate(v.listMyWorkQuerySchema, 'query'), myWorkController.listMyWork);
router.get('/:id', validate(v.jobOrderIdParamSchema, 'params'), myWorkController.getMyWorkJobOrder);

module.exports = router;
