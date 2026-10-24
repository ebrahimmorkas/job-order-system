const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const serviceStatusController = require('../controllers/serviceStatusController');

// Reachable without logging in (mounted above authenticate in server.js).
// Only ever expose what a logged-out visitor may see.
router.get('/branding', companySettingsController.getBranding);
// Under maintenance? (the login page shows the maintenance page instead).
router.get('/status', serviceStatusController.getPublicStatus);

module.exports = router;
