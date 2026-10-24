const accessService = require('../services/accessService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// GET /api/access - what the logged-in person may do (the menu and buttons).
const getMyAccess = async (req, res) => {
    try {
        const result = await accessService.getMyAccess({
            vendorId: req.vendorId, user: req.user, websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData
        });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching your access', err);
    }
};

module.exports = {
    getMyAccess
};
