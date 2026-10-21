const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');

// The vendor's own settings, set by the vendor - company name, logo, what the
// login page says, etc. Cached in Redis with the other vendor data
// (ensureVendorDataCached), so reading it costs no DB query.
const companySettingsSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true
    },
    // Shown on the login page, in the sidebar and as the browser tab title.
    companyName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    // Optional line under the company name on the login page.
    loginTagline: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
    },
    // The current logo. url is kept here so showing the logo needs no extra
    // query; imageId is its ImageAsset, needed to replace or delete the file.
    logo: {
        url: { type: String, default: null },
        imageId: { type: mongoose.Types.ObjectId, ref: 'ImageAsset', default: null }
    }
}, {
  timestamps: true
});

companySettingsSchema.plugin(auditPlugin);
companySettingsSchema.plugin(cacheInvalidationPlugin, { key: (vendorId) => redisKeys.companySettings(vendorId) });

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
