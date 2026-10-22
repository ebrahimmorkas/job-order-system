const common = require('../utils/common');
const logger = require('../utils/logger');
const { assignedCountryIdsOf } = require('../services/taxSettingsService');

// Refuses the tax settings' requests while no country is assigned to the
// vendor (CompanyMaster.assignedCountries is empty) - the Tax tab is hidden then.
const requireAssignedCountries = (req, res, next) => {
    try {
        if (assignedCountryIdsOf(req.companyMasterData).length === 0) {
            logger.logInfo(0, 1, 'No countries assigned', { vendorId: req.vendorId });
            return common.sendError(res, 403, 'No countries are assigned to your account.');
        }
        next();
    } catch (error) {
        logger.logException('Exception in requireAssignedCountries middleware', error);
    }
};

module.exports = requireAssignedCountries;
