const myWorkService = require('../services/myWorkService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

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
        const result = await myWorkService.getMyWorkJobOrder({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData
        });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the job order', err);
    }
};

// PATCH /api/my-work/:id/step
const setMyStep = async (req, res) => {
    try {
        const result = await myWorkService.setMyStep({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, data: req.body,
            websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData
        });
        if (result.isSuccess) logInfo(1, 0, result.message, { vendorId: req.vendorId, jobOrderId: req.params.id });
        else logInfo(0, 1, result.message, { vendorId: req.vendorId, jobOrderId: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while changing the step', err);
    }
};

module.exports = {
    listMyWork,
    getMyWorkJobOrder,
    setMyStep
};
