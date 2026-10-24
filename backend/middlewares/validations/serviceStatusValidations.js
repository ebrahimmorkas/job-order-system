const Joi = require('joi');
const { SERVICE_MESSAGE_MAX_LENGTH } = require('../../constants/serviceStatusConstants');

// PUT /api/service-status/shop - closing takes an optional message and an
// optional time to open again (ignored when opening).
const shopSchema = Joi.object({
    shopClosed: Joi.boolean().required().label('Shop closed'),
    shopClosedMessage: Joi.string().trim().max(SERVICE_MESSAGE_MAX_LENGTH).allow('', null).default(null).label('Message'),
    estimatedResumeTime: Joi.date().iso().allow(null).default(null).label('Opens again at')
});

module.exports = {
    shopSchema
};
