const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');

// Per-vendor entitlements, set by the platform owner - e.g. the vendor paid
// for a feature, so it is switched on for them here. A feature works only
// when it is on here AND in WebsiteMaster (see checkFeatureOnOrOff in
// utils/common.js). A new feature flag must be added to both schemas.
const companyMasterSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },
    // Shown when a feature is on in WebsiteMaster but switched off for this
    // vendor - unless checkFeatureOnOrOff is given its own customMessage.
    featureDisabledForVendorMessage: {
        type: String,
        trim: true,
        default: 'This feature is not enabled for your account. Please contact support.'
    }
}, {
  timestamps: true
});

companyMasterSchema.plugin(auditPlugin);
companyMasterSchema.plugin(cacheInvalidationPlugin, { key: (vendorId) => redisKeys.companyMaster(vendorId) });

module.exports = mongoose.model('CompanyMaster', companyMasterSchema);
