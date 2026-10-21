const CompanyMaster = require('../models/CompanyMaster');
const logger = require('../utils/logger');

// The vendor's CompanyMaster document, or null if it hasn't been created yet
// (run seeds/seedCompanyMaster.js).
const fetchCompanyMasterByVendorId = async (vendorId) => {
    logger.logInfo(null, null, 'Fetching company master data from DB', { vendorId });
    const companyMasterData = await CompanyMaster.findOne({ vendorId });
    if (!companyMasterData) {
        logger.logInfo(0, 1, 'Company master data not found', { vendorId });
        return null;
    }
    logger.logInfo(1, 0, 'Company master data fetched successfully', { vendorId });
    return companyMasterData;
};

module.exports = {
    fetchCompanyMasterByVendorId
};
