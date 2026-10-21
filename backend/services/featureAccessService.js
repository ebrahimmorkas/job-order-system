const common = require('../utils/common');
const { FEATURE_FLAG_VALUES } = require('../constants/featureConstants');

// Which features are on for this vendor - on in WebsiteMaster AND in its
// CompanyMaster - so the frontend can hide what is off. No DB read: both
// documents are already on the request (ensureVendorDataCached).
const getFeatureAccess = (websiteMasterData, companyMasterData) => {
    try {
        const featureAccess = {};
        for (const flag of FEATURE_FLAG_VALUES) {
            featureAccess[flag] = websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
        }
        return common.returnResult(true, 200, 'Feature access fetched successfully.', { featureAccess });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getFeatureAccess
};
