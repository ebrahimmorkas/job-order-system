const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');

// Reachable without logging in (mounted above authenticate in server.js).
// Only ever expose what a logged-out visitor may see.
router.get('/branding', companySettingsController.getBranding);

module.exports = router;
