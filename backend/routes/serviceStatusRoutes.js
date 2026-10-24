const express = require('express');
const router = express.Router();
const serviceStatusController = require('../controllers/serviceStatusController');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/serviceStatusValidations');
const { ROLES } = require('../constants/roleConstants');

// Logged in already, and reachable while the app is blocked (server.js mounts
// this above requireServiceOpen) - the blocked page asks here.
router.get('/', serviceStatusController.getMyStatus);
// The owner only: a user closing it would lock themselves out.
router.put('/shop', authorize(ROLES.OWNER), validate(v.shopSchema), serviceStatusController.updateShop);

module.exports = router;
