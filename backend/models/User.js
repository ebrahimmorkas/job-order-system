const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { ROLES, ROLE_VALUES } = require('../constants/roleConstants');

const userSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
    },
    username: {
        type: String,
        required: true,
        lowercase: true
    },
    // bcrypt hash, never the password itself. AuditLog records that it
    // changed but never its value (see models/plugins/auditPlugin.js).
    password: {
        type: String,
        required: false,
        default: null
    },
    // --- Fields added for future "Continue with Google" support ---
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
        required: true
    },
    googleId: {
        type: String,
        default: null,
        index: true,
        sparse: true // allows multiple docs with googleId: null without violating uniqueness if you later add unique: true
    },
    // ----------------------------------------------------------------
    phone_no: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 14
    },
    whatsapp_no: {
        type: String,
        required: false,
        trim: true,
        minlength: 10,
        maxlength: 14
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    // Only 'owner' until the RBAC feature adds more roles (constants/roleConstants.js).
    role: {
        type: String,
        enum: ROLE_VALUES,
        default: ROLES.OWNER,
        required: true,
    }
}, {
    timestamps: true
});

userSchema.index(
    { vendorId: 1, username: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, email: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, phone_no: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, whatsapp_no: 1 },
    {
        unique: true,
        partialFilterExpression: {
            whatsapp_no: { $exists: true, $type: "string" }
        }
    }
);

// status, createdBy, updatedBy, deletedBy... and the full change history.
userSchema.plugin(auditPlugin);

module.exports = mongoose.model('User', userSchema);
