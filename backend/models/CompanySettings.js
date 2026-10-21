const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');

// The vendor's own settings, set by the vendor from the admin panel - company
// name, logo, which sections to show, etc.
const companySettingsSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    }
}, {
  timestamps: true
});

companySettingsSchema.plugin(auditPlugin);
companySettingsSchema.plugin(cacheInvalidationPlugin, { key: (vendorId) => redisKeys.companySettings(vendorId) });

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
