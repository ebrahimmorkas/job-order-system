const Vendor = require('../models/Vendor');
const logger = require('../utils/logger.js');
const common = require('../utils/common');
const { resolveDomain } = require('../utils/requestDomain');

// Finds the vendor from the domain the request arrived on and sets
// req.vendorId / req.vendorData for everything after it. Only an active
// vendor (status 'A') is served - a switched-off or deleted one gets the same
// 404 as an unknown domain.
const vendorDetection = async (req, res, next) => {
    try {
        const domain = resolveDomain(req.hostname);
        const vendor = await Vendor.findOne({ domain, status: 'A' }).lean();
        if (!vendor) {
            logger.logInfo(0, 1, 'No active vendor for this domain', { domain });
            return common.sendError(res, 404, 'No account is set up for this domain.');
        }
        req.vendorId = vendor._id;
        req.vendorData = vendor;
        next();
    } catch (error) {
        // Answers the request with a 500 + error reference itself.
        logger.logException('Exception in vendorDetection middleware', error);
    }
};

module.exports = vendorDetection;
