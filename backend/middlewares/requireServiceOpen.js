const common = require('../utils/common');
const logger = require('../utils/logger');
const serviceStatusService = require('../services/serviceStatusService');

// Answers 503 with data.block (what the app shows instead: maintenance,
// payment, unavailable, shop closed) when the app is not open for this
// person - see services/serviceStatusService.js. The frontend shows the page
// at once, on whatever request hit it.
//
//   app.use('/api', authenticate, requireServiceOpen)   - logged in
//   router.post('/login', requireServiceOpen, ...)      - logged out: maintenance only
const requireServiceOpen = (req, res, next) => {
    try {
        const block = serviceStatusService.blockOf({
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            user: req.user || null
        });
        if (!block) return next();
        logger.logInfo(0, 1, 'Request blocked', { vendorId: req.vendorId, userId: req.user?._id, state: block.state });
        return common.sendError(res, 503, 'The app is not available right now.', null, { block });
    } catch (error) {
        logger.logException('Exception in requireServiceOpen middleware', error);
    }
};

module.exports = requireServiceOpen;
