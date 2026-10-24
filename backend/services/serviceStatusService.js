const CompanySettings = require('../models/CompanySettings');
const common = require('../utils/common');
const realtimeService = require('./realtimeService');
const { REALTIME_EVENTS } = require('../constants/notificationConstants');
const { ROLES } = require('../constants/roleConstants');
const { SERVICE_STATES } = require('../constants/serviceStatusConstants');

// Whether the app is open for someone, from the cached vendor data (no DB
// query), in this order:
//   1. WebsiteMaster.underMaintenance - every vendor, everyone, even logged out
//   2. CompanyMaster.underMaintenance - this vendor, everyone, even logged out
//   3. CompanyMaster.paymentNotDone   - logged in: the owner the payment page,
//                                       a user "unavailable" (never why)
//   4. CompanySettings.shopClosed     - a user the shop closed page; the owner
//                                       keeps working (a banner says closed)
// The shop opens by itself at estimatedResumeTime; without one it stays
// closed until the owner opens it.

const textOrNull = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The shop as it is now: closed only until estimatedResumeTime (when set). */
const shopOf = (companySettingsData, now = new Date()) => {
    try {
        const resumeAt = companySettingsData?.estimatedResumeTime ? new Date(companySettingsData.estimatedResumeTime) : null;
        const isClosed = companySettingsData?.shopClosed === true && (!resumeAt || resumeAt > now);
        return {
            isClosed,
            message: isClosed ? textOrNull(companySettingsData.shopClosedMessage) : null,
            resumeAt: isClosed && resumeAt ? resumeAt.toISOString() : null,
            // Without a time it opens only when the owner opens it.
            opensAutomatically: isClosed && !!resumeAt
        };
    } catch (err) {
        throw err;
    }
};

/** Maintenance (platform-wide first, then the vendor's), or null. */
const maintenanceOf = (websiteMasterData, companyMasterData) => {
    try {
        if (websiteMasterData?.underMaintenance === true) {
            return { state: SERVICE_STATES.MAINTENANCE, message: textOrNull(websiteMasterData.maintenanceMessage) };
        }
        if (companyMasterData?.underMaintenance === true) {
            return { state: SERVICE_STATES.MAINTENANCE, message: textOrNull(companyMasterData.maintenanceMessage) };
        }
        return null;
    } catch (err) {
        throw err;
    }
};

/**
 * What blocks this person now, or null when the app is open for them.
 * user null = logged out (only maintenance blocks then).
 *
 * @returns {{ state: string, message: string|null, resumeAt?: string|null, opensAutomatically?: boolean }|null}
 */
const blockOf = ({ websiteMasterData, companyMasterData, companySettingsData, user, now = new Date() }) => {
    try {
        const maintenance = maintenanceOf(websiteMasterData, companyMasterData);
        if (maintenance || !user) return maintenance;
        const isOwner = user.role === ROLES.OWNER;
        if (companyMasterData?.paymentNotDone === true) {
            return isOwner
                ? { state: SERVICE_STATES.PAYMENT_DUE, message: textOrNull(companyMasterData.paymentMessage) }
                : { state: SERVICE_STATES.UNAVAILABLE, message: null };
        }
        const shop = shopOf(companySettingsData, now);
        if (shop.isClosed && !isOwner) {
            return { state: SERVICE_STATES.SHOP_CLOSED, message: shop.message, resumeAt: shop.resumeAt, opensAutomatically: shop.opensAutomatically };
        }
        return null;
    } catch (err) {
        throw err;
    }
};

// GET /api/public/status - before logging in: maintenance only.
const getPublicStatus = ({ websiteMasterData, companyMasterData }) => {
    try {
        return common.returnResult(true, 200, 'Status fetched successfully.', { block: maintenanceOf(websiteMasterData, companyMasterData) });
    } catch (err) {
        throw err;
    }
};

// GET /api/service-status - logged in: what blocks them, and the shop (the
// owner's banner while it is closed).
const getMyStatus = ({ websiteMasterData, companyMasterData, companySettingsData, user }) => {
    try {
        const shop = shopOf(companySettingsData);
        return common.returnResult(true, 200, 'Status fetched successfully.', {
            block: blockOf({ websiteMasterData, companyMasterData, companySettingsData, user }),
            shop: user.role === ROLES.OWNER ? shop : { isClosed: shop.isClosed }
        });
    } catch (err) {
        throw err;
    }
};

// PUT /api/service-status/shop - the owner closes the shop (message and an
// estimated time to open again, both optional) or opens it.
const updateShop = async ({ vendorId, userId, data }) => {
    try {
        if (data.shopClosed && data.estimatedResumeTime && new Date(data.estimatedResumeTime) <= new Date()) {
            return common.returnResult(false, 400, 'The time to open again must be in the future.', {
                errors: [{ field: 'estimatedResumeTime', message: 'Pick a time in the future' }]
            });
        }
        const set = data.shopClosed
            ? { shopClosed: true, shopClosedMessage: data.shopClosedMessage || null, estimatedResumeTime: data.estimatedResumeTime || null }
            : { shopClosed: false, shopClosedMessage: null, estimatedResumeTime: null };
        const settings = await CompanySettings.findOneAndUpdate(
            { vendorId },
            { $set: set },
            { returnDocument: 'after', runValidators: true, projection: { shopClosed: 1, shopClosedMessage: 1, estimatedResumeTime: 1 }, auditUserId: userId }
        ).lean();
        if (!settings) return common.returnResult(false, 404, 'Company settings have not been set up yet.');
        // The users' open pages close (or open) at once.
        realtimeService.toVendor(vendorId, REALTIME_EVENTS.SERVICE_STATUS_CHANGED, {});
        return common.returnResult(true, 200, data.shopClosed ? 'The shop is closed.' : 'The shop is open.', { shop: shopOf(settings) });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    shopOf,
    maintenanceOf,
    blockOf,
    getPublicStatus,
    getMyStatus,
    updateShop
};
