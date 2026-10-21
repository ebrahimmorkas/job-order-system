const mongoose = require('mongoose');

// Failed logins, counted per vendor + identifier + IP address (see
// services/loginAttemptService.js). One document per combination; it deletes
// itself when expiresAt passes (TTL index), and a successful login deletes it
// straight away. The limits come from WebsiteMaster (maxLoginAttempts,
// loginLockoutMinutes).
const loginAttemptSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    // What was typed in the login box (username, email or phone), lowercased.
    identifier: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    failedCount: {
        type: Number,
        default: 0
    },
    // Set once failedCount reaches maxLoginAttempts; logins from this
    // vendor + identifier + IP are refused until then.
    lockedUntil: {
        type: Date,
        default: null
    },
    // MongoDB deletes the document once this passes (its TTL check runs about
    // once a minute, so the service also treats a past expiresAt as gone).
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    }
}, {
    timestamps: true
});

loginAttemptSchema.index({ vendorId: 1, identifier: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
