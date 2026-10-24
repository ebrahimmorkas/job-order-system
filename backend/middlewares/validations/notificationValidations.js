const Joi = require('joi');
const { NOTIFICATION_LIST_LIMIT, NOTIFICATION_LIST_MAX } = require('../../constants/notificationConstants');

// GET /api/notifications - before: the createdAt of the oldest one shown.
const listNotificationsQuerySchema = Joi.object({
    before: Joi.date().iso().default(null).label('Before'),
    limit: Joi.number().integer().min(1).max(NOTIFICATION_LIST_MAX).default(NOTIFICATION_LIST_LIMIT).label('Limit')
});

// PATCH /api/notifications/read - no ids = all of them.
const markReadSchema = Joi.object({
    ids: Joi.array().items(Joi.string().hex().length(24)).max(NOTIFICATION_LIST_MAX).default(null).label('Notifications')
});

module.exports = {
    listNotificationsQuerySchema,
    markReadSchema
};
