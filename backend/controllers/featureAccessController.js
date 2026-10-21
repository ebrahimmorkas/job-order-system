const featureAccessService = require('../services/featureAccessService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// GET /api/feature-access
const getFeatureAccess = async (req, res) => {
    try {
        const result = featureAccessService.getFeatureAccess(req.websiteMasterData, req.companyMasterData);
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching feature access', err);
    }
};

module.exports = {
    getFeatureAccess
};
