const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');
const { VALID_STORAGE_PROVIDERS } = require('../constants/storageConstants');
const { SERVICE_MESSAGE_MAX_LENGTH } = require('../constants/serviceStatusConstants');

// Platform-wide switchboard - a single document for the whole website. A
// feature works for a vendor only when it is on here AND in that vendor's
// CompanyMaster (see checkFeatureOnOrOff in utils/common.js). Turning a
// feature off here turns it off for every vendor, whether they paid for it
// or not. Not vendor-scoped, so there is no vendorId.
const websiteMasterSchema = mongoose.Schema({
    // Shown when a feature is switched off here, for every vendor.
    temporaryFeatureOffMessage: {
        type: String,
        trim: true,
        default: 'This feature is temporarily unavailable. Please check back later.'
    },
    // Login rate limiting (services/loginAttemptService.js): after this many
    // failed logins in a row for the same vendor + identifier + IP address,
    // that combination is locked for loginLockoutMinutes. 0 = no limit.
    maxLoginAttempts: {
        type: Number,
        min: 0,
        default: 5
    },
    loginLockoutMinutes: {
        type: Number,
        min: 1,
        default: 15
    },

    // ---- Feature switches (same names in CompanyMaster) --------------------
    isMasterModuleFeatureOn: {
        type: Boolean,
        default: true
    },
    isControlsFeatureOn: {
        type: Boolean,
        default: true
    },
    isTaxFeatureOn: {
        type: Boolean,
        default: true
    },
    isImageUploadFeatureOn: {
        type: Boolean,
        default: true
    },
    isRBACFeatureOn: {
        type: Boolean,
        default: true
    },
    isLayoutMasterFeatureOn: {
        type: Boolean,
        default: true
    },
    isStepFeatureOn: {
        type: Boolean,
        default: true
    },
    isCustomersFeatureOn: {
        type: Boolean,
        default: true
    },
    isPerRatePricingFeatureOn: {
        type: Boolean,
        default: true
    },

    // ---- Maintenance -------------------------------------------------------
    // On: every vendor's app (owners and users, even the login page) shows
    // the maintenance page, with maintenanceMessage when set.
    underMaintenance: {
        type: Boolean,
        default: false
    },
    maintenanceMessage: {
        type: String,
        trim: true,
        maxlength: SERVICE_MESSAGE_MAX_LENGTH,
        default: null
    },

    // ---- Storage ----------------------------------------------------------
    // The platform's default image storage: used (with the platform's own
    // .env account) by every vendor whose CompanyMaster.imageService is not
    // set, and by every vendor while enforceMainImageService is on.
    mainImageService: {
        type: String,
        enum: VALID_STORAGE_PROVIDERS,
        required: true,
        default: 'local'
    },
    enforceMainImageService: {
        type: Boolean,
        default: false
    }
}, {
  timestamps: true
});

// Not vendor-scoped: there is one WebsiteMaster for the whole platform.
websiteMasterSchema.plugin(auditPlugin, { vendorScoped: false });
websiteMasterSchema.plugin(cacheInvalidationPlugin, { key: () => redisKeys.websiteMaster() });

module.exports = mongoose.model('WebsiteMaster', websiteMasterSchema);
