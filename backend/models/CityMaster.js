const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');

// The cities of a state (seeds/seedLocationMasters.js), picked from a dropdown
// so no one types them freely. Platform-wide: kept by the platform owner only,
// never by a vendor.
const cityMasterSchema = new mongoose.Schema({
    stateId: {
        type: mongoose.Types.ObjectId,
        ref: 'StateMaster',
        required: true
    },
    // Kept here too, so a country's cities are found without the states.
    countryId: {
        type: mongoose.Types.ObjectId,
        ref: 'CountryMaster',
        required: true
    },
    // e.g. "Mumbai"
    name: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

// One city of a name per state; the cities of several states at once.
cityMasterSchema.index({ stateId: 1, name: 1 }, { unique: true });
cityMasterSchema.index({ countryId: 1, status: 1 });

cityMasterSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('CityMaster', cityMasterSchema);
