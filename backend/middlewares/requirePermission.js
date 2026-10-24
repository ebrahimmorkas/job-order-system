const common = require('../utils/common');
const logger = require('../utils/logger');
const accessService = require('../services/accessService');

// Lets a request through only when the logged-in person may do it: the owner
// always; a user when their roles / extra access give the permission (see
// services/accessService.js). The access is worked out once per request
// (req.access).
//   router.get('/', requirePermission('masters', 'view'), ...)
//   router.get('/form-data', requirePermission('jobOrders', ['create', 'edit']), ...)  - any of them
//   router.post('/bulk', requirePermission('masters', bulkPermission), ...)            - from the request
const requirePermission = (module, permissionOf) => async (req, res, next) => {
    try {
        req.access ??= await accessService.accessOf({
            vendorId: req.vendorId, user: req.user, websiteMasterData: req.websiteMasterData, companyMasterData: req.companyMasterData
        });
        const permission = typeof permissionOf === 'function' ? permissionOf(req) : permissionOf;
        if (!accessService.can(req.access, module, permission)) {
            logger.logInfo(0, 1, 'Permission refused', { vendorId: req.vendorId, userId: req.user._id, module, permission });
            return common.sendError(res, 403, 'You do not have permission to do this.');
        }
        next();
    } catch (error) {
        logger.logException('Exception in requirePermission middleware', error);
    }
};

// Bulk actions: deleting needs Delete; marking active / inactive needs Edit.
const bulkPermission = (req) => (req.body?.action === 'delete' ? 'delete' : 'edit');

module.exports = requirePermission;
module.exports.bulkPermission = bulkPermission;
