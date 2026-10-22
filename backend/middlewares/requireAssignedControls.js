const common = require('../utils/common');
const logger = require('../utils/logger');
const { assignedTypesOf } = require('../services/controlService');

// Refuses the Controls pages' requests while no control type is assigned to
// the vendor (CompanyMaster.assignedControls = []) - the menu is hidden then.
const requireAssignedControls = (req, res, next) => {
    try {
        if (assignedTypesOf(req.companyMasterData).length === 0) {
            logger.logInfo(0, 1, 'No control types assigned', { vendorId: req.vendorId });
            return common.sendError(res, 403, 'No controls are available for your account.');
        }
        next();
    } catch (error) {
        logger.logException('Exception in requireAssignedControls middleware', error);
    }
};

module.exports = requireAssignedControls;
