const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');

// Logged in already (server.js mounts this below authenticate). Anyone.
router.get('/', accessController.getMyAccess);

module.exports = router;
