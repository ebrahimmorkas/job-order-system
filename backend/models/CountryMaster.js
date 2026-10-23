const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { TAX_FIELD_KEY_PATTERN, TAX_FIELD_VALUE_MAX_LENGTH } = require('../constants/taxConstants');

// A registration number a business of this country fills in Company Settings
// > Tax, e.g. India's GSTIN or the UAE's TRN. What the Tax tab shows (and the
// backend checks) comes from here, so a new country needs no new code.
const taxFieldSchema = new mongoose.Schema({
    // Names the value in CompanySettings.taxDetails[].taxFieldValues, e.g. "gstin".
    // Never change it once vendors have filled it in.
    key: {
        type: String,
        required: true,
        trim: true,
        match: TAX_FIELD_KEY_PATTERN
    },
    // e.g. "GSTIN"
    label: {
        type: String,
        required: true,
        trim: true
    },
    // Grey hint text in the box, e.g. "27ABCDE1234F1Z5".
    placeholder: {
        type: String,
        trim: true,
        default: null
    },
    // Needed for the business to count as registered for tax in this country.
    isRequired: {
        type: Boolean,
        default: false
    },
    maxLength: {
        type: Number,
        min: 1,
        max: TAX_FIELD_VALUE_MAX_LENGTH,
        default: TAX_FIELD_VALUE_MAX_LENGTH
    },
    // A regular expression the whole value must match (null = any text), and
    // the message shown when it doesn't. Values are saved in capital letters.
    pattern: {
        type: String,
        default: null
    },
    patternMessage: {
        type: String,
        trim: true,
        default: null
    },
    // The value starts with the tax code of the state of the business address
    // (StateMaster.taxCode) - an Indian GSTIN starts with it, e.g. 27 = Maharashtra.
    startsWithStateTaxCode: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// The countries the platform supports (seeds/seedLocationMasters.js). The
// platform owner gives a vendor some of them (CompanyMaster.assignedCountries);
// its tax system, currency and address rules then apply to that vendor.
// Platform-wide: kept by the platform owner only, never by a vendor.
const countryMasterSchema = new mongoose.Schema({
    // e.g. "India"
    name: {
        type: String,
        required: true,
        trim: true
    },
    // ISO 3166-1 alpha-2, e.g. "IN", "AE".
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    // e.g. "+91"
    phoneCode: {
        type: String,
        required: true,
        trim: true
    },
    currencyId: {
        type: mongoose.Types.ObjectId,
        ref: 'CurrencyMaster',
        required: true
    },
    // What the tax is called here, e.g. "GST", "VAT" - used in the screens'
    // wording ("I am registered for GST").
    taxName: {
        type: String,
        required: true,
        trim: true
    },
    taxFields: {
        type: [taxFieldSchema],
        default: []
    },
    // Where a sale between two states is taxed as one tax instead of the
    // rate's split, its name - India: "IGST" (CGST + SGST within one state).
    // null = the split is the same everywhere (e.g. the UAE).
    interStateTaxLabel: {
        type: String,
        trim: true,
        default: null
    },
    // The postal code of an address here: what it is called ("PIN code",
    // "P.O. Box"), whether it is needed and its form (null = any).
    postalCode: {
        label: { type: String, trim: true, default: 'Postal code' },
        isRequired: { type: Boolean, default: false },
        pattern: { type: String, default: null },
        patternMessage: { type: String, trim: true, default: null }
    },
    // Order in dropdowns - lowest first.
    precedence: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

countryMasterSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('CountryMaster', countryMasterSchema);
