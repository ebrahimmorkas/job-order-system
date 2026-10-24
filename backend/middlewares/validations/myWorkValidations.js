const { jobOrderIdParamSchema, listJobOrdersQuerySchema } = require('./jobOrderValidations');

// GET /api/my-work takes the same search / page / limit as the job order list.
module.exports = {
    jobOrderIdParamSchema,
    listMyWorkQuerySchema: listJobOrdersQuerySchema
};
