const common = require('../utils/common');
const logger = require('../utils/logger');

// Refuses every request of a feature's routes while the feature is off in
// WebsiteMaster or in the vendor's CompanyMaster - nothing of it can be read
// or changed then.
//   router.use(requireFeature(FEATURE_FLAGS.MASTER_MODULE));
//
// orCompanyFlag: a CompanyMaster switch (FEATURE_READ_OVERRIDES) that lets
// this one route through while the vendor's own feature switch is off. The
// platform-wide (WebsiteMaster) switch still applies.
const requireFeature = (featureFlag, { orCompanyFlag = null } = {}) => async (req, res, next) => {
    try {
        const result = await common.checkFeatureOnOrOff(
            req.vendorId, req.websiteMasterData, req.companyMasterData, featureFlag, featureFlag
        );
        const isOverridden = !result.isSuccess && orCompanyFlag !== null
            && req.websiteMasterData?.[featureFlag] === true && req.companyMasterData?.[orCompanyFlag] === true;
        if (!result.isSuccess && !isOverridden) {
            logger.logInfo(0, 1, 'Feature switched off', { vendorId: req.vendorId, featureFlag });
            return common.sendError(res, result.statusCode, result.message);
        }
        next();
    } catch (error) {
        logger.logException('Exception in requireFeature middleware', error);
    }
};

module.exports = requireFeature;
