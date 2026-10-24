const serviceStatusService = require('../services/serviceStatusService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// GET /api/public/status - before logging in: is the app under maintenance?
const getPublicStatus = async (req, res) => {
    try {
        return sendResult(res, serviceStatusService.getPublicStatus({
            websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData
        }));
    } catch (err) {
        logException('Error while fetching the status', err);
    }
};

// GET /api/service-status - logged in: what blocks them, and the shop.
const getMyStatus = async (req, res) => {
    try {
        return sendResult(res, serviceStatusService.getMyStatus({
            websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData, companySettingsData: req.companySettingsData, user: req.user
        }));
    } catch (err) {
        logException('Error while fetching your status', err);
    }
};

// PUT /api/service-status/shop - the owner closes or opens the shop.
const updateShop = async (req, res) => {
    try {
        const result = await serviceStatusService.updateShop({ vendorId: req.vendorId, userId: req.user._id, data: req.body });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while saving the shop', err);
    }
};

module.exports = {
    getPublicStatus,
    getMyStatus,
    updateShop
};
