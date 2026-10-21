const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const companySettingsService = require('../services/companySettingsService');
const companyMasterService = require('../services/companyMasterService');
const websiteMasterService = require('../services/websiteMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const ensureVendorDataCached = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            logger.logInfo(0,1,`Vendor ID not found`);
            return common.sendError(res, 400, `Vendor identification failed`);
        }

        const companySettingsData = await redisService.getOrSet(
            redisKeys.companySettings(vendorId),
            async () => await companySettingsService.fetchCompanySettingsByVendorId(vendorId),
            3600
        );

        const websiteMasterData = await redisService.getOrSet(
            redisKeys.websiteMaster(),
            async () => await websiteMasterService.fetchWebsiteMasterData(),
            3600
        );

        const companyMasterData = await redisService.getOrSet(
            redisKeys.companyMaster(vendorId),
            async () => await companyMasterService.fetchCompanyMasterByVendorId(vendorId),
            3600
        );

        // Both are required: checkFeatureOnOrOff reads every feature flag from
        // them, and would crash on every gated route if either were missing.
        if (!websiteMasterData || !companyMasterData) {
            logger.logWarning('Vendor configuration missing', { vendorId, hasWebsiteMaster: !!websiteMasterData, hasCompanyMaster: !!companyMasterData });
            return common.sendError(res, 500, `Failed to load vendor configuration`);
        }

        req.companySettingsData = companySettingsData;
        req.websiteMasterData = websiteMasterData;
        req.companyMasterData = companyMasterData;
        next();

    } catch (error) {
        // Answers the request with a 500 + error reference itself.
        logger.logException("Exception in ensureVendorDataCached middleware", error);
    }
};

module.exports = ensureVendorDataCached;
