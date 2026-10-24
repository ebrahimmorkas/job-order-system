const express = require('express');
const router = express.Router();
const myWorkController = require('../controllers/myWorkController');
const dashboardController = require('../controllers/dashboardController');
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
// Above '/:id', so "summary" is never read as an id. The user's own dashboard.
router.get('/summary', dashboardController.getMySummary);
router.get('/:id', validate(v.jobOrderIdParamSchema, 'params'), myWorkController.getMyWorkJobOrder);
// Moving your work to a step: only while the steps feature is on.
router.patch('/:id/step', requireFeature(FEATURE_FLAGS.STEPS), validate(v.jobOrderIdParamSchema, 'params'), validate(v.stepSchema), myWorkController.setMyStep);

module.exports = router;
