const myWorkService = require('../services/myWorkService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// Every route here already passed: login, role user, the RBAC feature switch
// and the Joi validation (routes/myWorkRoutes.js).

// GET /api/my-work
const listMyWork = async (req, res) => {
    try {
        const result = await myWorkService.listMyWork({ vendorId: req.vendorId, userId: req.user._id, ...req.query });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching your work', err);
    }
};

// GET /api/my-work/:id
const getMyWorkJobOrder = async (req, res) => {
    try {
        const result = await myWorkService.getMyWorkJobOrder({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the job order', err);
    }
};

module.exports = {
    listMyWork,
    getMyWorkJobOrder
};
