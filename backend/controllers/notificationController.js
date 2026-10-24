const notificationService = require('../services/notificationService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// GET /api/notifications
const listNotifications = async (req, res) => {
    try {
        const result = await notificationService.listNotifications({ vendorId: req.vendorId, userId: req.user._id, ...req.query });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the notifications', err);
    }
};

// PATCH /api/notifications/read
const markRead = async (req, res) => {
    try {
        const result = await notificationService.markRead({ vendorId: req.vendorId, userId: req.user._id, ids: req.body.ids });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while marking the notifications read', err);
    }
};

module.exports = {
    listNotifications,
    markRead
};
