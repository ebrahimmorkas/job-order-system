const common = require('../utils/common');
const { FEATURE_FLAGS, FEATURE_FLAG_VALUES, FEATURE_READ_OVERRIDES } = require('../constants/featureConstants');

// Which features are on for this vendor - on in WebsiteMaster AND in its
// CompanyMaster - so the frontend can hide what is off. No DB read: both
// documents are already on the request (ensureVendorDataCached).
const getFeatureAccess = (websiteMasterData, companyMasterData) => {
    try {
        const featureAccess = {};
        for (const flag of FEATURE_FLAG_VALUES) {
            featureAccess[flag] = websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
        }
        // Whether the job order form gets the masters (same rule as the route).
        featureAccess.canFetchMastersForJobOrder = featureAccess[FEATURE_FLAGS.MASTER_MODULE]
            || (websiteMasterData?.[FEATURE_FLAGS.MASTER_MODULE] === true
                && companyMasterData?.[FEATURE_READ_OVERRIDES.MASTERS_FOR_JOB_ORDER] === true);
        return common.returnResult(true, 200, 'Feature access fetched successfully.', { featureAccess });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getFeatureAccess
};
