const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const requirePermission = require('../middlewares/requirePermission');

// Logged in already (server.js mounts this below authenticate). The owner,
// or a user whose roles give Dashboard.
router.get('/', requirePermission('dashboard', 'view'), dashboardController.getDashboard);

module.exports = router;
