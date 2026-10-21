const express = require('express');
const router = express.Router();
const featureAccessController = require('../controllers/featureAccessController');

// Logged in already (server.js mounts this below authenticate).
router.get('/', featureAccessController.getFeatureAccess);

module.exports = router;
