const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');

// How a tax splits on the invoice, e.g. GST 18% = CGST 9% + SGST 9%. Only for
// showing it - the tax itself is always worked out on totalRate.
const taxComponentSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true
    },
    rate: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

// The tax rates of each country (seeds/seedTaxMaster.js), e.g. "GST 18%",
// "VAT 5%". Platform-wide: kept by the platform owner only, never by a vendor.
// Prices are always entered before tax and the tax is added on top.
//
// Never change totalRate / components of a rate in use: when the law changes
// a rate, close the old row (applicableTo) and add a new one, so past job
// orders keep the rate that was actually charged.
const taxMasterSchema = new mongoose.Schema({
    countryId: {
        type: mongoose.Types.ObjectId,
        ref: 'CountryMaster',
        required: true
    },
    // e.g. "GST 18%"
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Unique short code for seeds and lookups, e.g. "IN_GST_18".
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    // Percent of the price, e.g. 18.
    totalRate: {
        type: Number,
        required: true,
        min: 0
    },
    components: {
        type: [taxComponentSchema],
        default: []
    },
    // In force from / until (null = still in force).
    applicableFrom: {
        type: Date,
        required: true
    },
    applicableTo: {
        type: Date,
        default: null
    },
    // Picked in advance for a vendor of this country who hasn't chosen their
    // own default rate (CompanySettings.taxDetails[].defaultTaxId). One per country.
    isDefault: {
        type: Boolean,
        default: false
    },
    // Order in dropdowns - lowest first.
    precedence: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// A country's rates for its dropdown.
taxMasterSchema.index({ countryId: 1, status: 1, precedence: 1 });

taxMasterSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('TaxMaster', taxMasterSchema);
