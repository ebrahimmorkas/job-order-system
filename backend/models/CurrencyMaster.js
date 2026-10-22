const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');

// The currencies the platform knows (seeds/seedLocationMasters.js), each
// used by one or more countries (CountryMaster.currencyId). Platform-wide:
// kept by the platform owner only, never by a vendor.
const currencyMasterSchema = new mongoose.Schema({
    // e.g. "Indian Rupee"
    name: {
        type: String,
        required: true,
        trim: true
    },
    // ISO 4217, e.g. "INR", "AED".
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    // Shown before an amount, e.g. "₹", "AED".
    symbol: {
        type: String,
        required: true,
        trim: true
    },
    // Amounts are rounded to this many decimals (2 for INR / AED, 3 for KWD).
    decimalPlaces: {
        type: Number,
        required: true,
        min: 0,
        max: 4,
        default: 2
    }
}, {
    timestamps: true
});

currencyMasterSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('CurrencyMaster', currencyMasterSchema);
