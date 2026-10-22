const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');

// The states / emirates / provinces of a country (seeds/seedLocationMasters.js),
// picked from a dropdown so no one types them freely. Platform-wide: kept by
// the platform owner only, never by a vendor.
const stateMasterSchema = new mongoose.Schema({
    countryId: {
        type: mongoose.Types.ObjectId,
        ref: 'CountryMaster',
        required: true
    },
    // e.g. "Maharashtra"
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Short code, unique within the country, e.g. "MH" (ISO 3166-2 where there is one).
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    // The state's code in the country's tax system, or null where there is
    // none - India's GST state code, e.g. "27" for Maharashtra (the first two
    // digits of a GSTIN; CountryMaster.taxFields[].startsWithStateTaxCode).
    taxCode: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true
});

stateMasterSchema.index({ countryId: 1, code: 1 }, { unique: true });
// A country's states for its dropdown.
stateMasterSchema.index({ countryId: 1, status: 1, name: 1 });

stateMasterSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('StateMaster', stateMasterSchema);
