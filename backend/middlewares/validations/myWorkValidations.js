const Joi = require('joi');
const { jobOrderIdParamSchema, listJobOrdersQuerySchema } = require('./jobOrderValidations');
const { HOLD_REASON_MAX_LENGTH } = require('../../constants/stepConstants');

// Which steps the vendor has is checked in services/myWorkService.js.

// PATCH /api/my-work/:id/step
const stepSchema = Joi.object({
    // The item of the job order the work is on.
    itemId: Joi.string().hex().length(24).required().label('Item')
        .messages({ 'string.hex': 'Item is invalid', 'string.length': 'Item is invalid' }),
    valueId: Joi.string().hex().length(24).required().label('Value')
        .messages({ 'string.hex': 'Value is invalid', 'string.length': 'Value is invalid' }),
    stepKey: Joi.string().max(100).required().label('Step'),
    // In progress only: how much is done.
    percent: Joi.number().integer().min(0).max(100).allow(null).default(null).label('Work done (%)'),
    // Hold only: why.
    holdReason: Joi.string().trim().max(HOLD_REASON_MAX_LENGTH).allow('', null).empty(['', null]).default(null).label('Reason')
});

// GET /api/my-work takes the same search / page / limit as the job order list.
module.exports = {
    jobOrderIdParamSchema,
    listMyWorkQuerySchema: listJobOrdersQuerySchema,
    stepSchema
};
