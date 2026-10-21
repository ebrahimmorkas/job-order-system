const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');

// One document per vendor (a business that bought the product). It exists to
// give every vendor-scoped document its vendorId, and to find the vendor from
// the domain a request arrives on (middlewares/vendorDetection.js). Logins are
// NOT here - every login, whatever its role, is a User (models/User.js).
const vendorSchema = new mongoose.Schema({
    // Exactly the hostname: no "https://", no port, no trailing slash.
    // www.example.com and example.com are different vendors.
    domain: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Only so a person can tell vendors apart in the database.
    name: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
    }
}, {
    timestamps: true
});

// status: 'A' = served, 'I' = switched off, 'D' = deleted (vendorDetection
// serves only 'A'), plus the full change history. Not vendor-scoped itself.
vendorSchema.plugin(auditPlugin, { vendorScoped: false });

module.exports = mongoose.model('Vendor', vendorSchema);
