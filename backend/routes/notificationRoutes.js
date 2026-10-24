const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/notificationValidations');

// Logged in already (server.js mounts this below authenticate). Everyone has
// their own bell; only their own notifications are ever read or changed.
router.get('/', validate(v.listNotificationsQuerySchema, 'query'), notificationController.listNotifications);
router.patch('/read', validate(v.markReadSchema), notificationController.markRead);

module.exports = router;
