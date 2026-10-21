const CompanySettings = require('../models/CompanySettings');
const logger = require('../utils/logger');

// The vendor's CompanySettings document, or null if it hasn't been created yet.
const fetchCompanySettingsByVendorId = async (vendorId) => {
    logger.logInfo(null, null, 'Fetching company settings from DB', { vendorId });
    const settings = await CompanySettings.findOne({ vendorId });
    if (!settings) {
        logger.logInfo(0, 1, 'Company settings not found', { vendorId });
        return null;
    }
    logger.logInfo(1, 0, 'Company settings fetched successfully', { vendorId });
    return settings;
};

module.exports = {
    fetchCompanySettingsByVendorId
};
