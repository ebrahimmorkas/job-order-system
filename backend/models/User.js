const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { ROLES, ROLE_VALUES } = require('../constants/roleConstants');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { MODULE_KEYS, PERMISSION_VALUES, ADDRESS_MAX_LENGTH } = require('../constants/rbacConstants');

// Dates are calendar days 'YYYY-MM-DD' (see constants/rbacConstants.js);
// endDate null = no end.
const dateRange = {
    startDate: { type: String, required: true },
    endDate: { type: String, default: null }
};

// A Role Master role given to the user.
const assignedRoleSchema = new mongoose.Schema({
    roleId: { type: mongoose.Types.ObjectId, required: true },
    ...dateRange
}, { _id: false });

// Extra access of this user only, on top of the roles: one permission of one
// module, with its own dates.
const extraModuleSchema = new mongoose.Schema({
    module: { type: String, enum: MODULE_KEYS, required: true },
    permission: { type: String, enum: PERMISSION_VALUES, required: true },
    ...dateRange
}, { _id: false });

// Extra access to a role-provided master (view only, like a master role):
// the whole master or some of its values, with its own dates.
const extraMasterSchema = new mongoose.Schema({
    masterId: { type: mongoose.Types.ObjectId, required: true },
    isWholeMaster: { type: Boolean, default: false },
    valueIds: { type: [mongoose.Types.ObjectId], default: [] },
    ...dateRange
}, { _id: false });

const userSchema = mongoose.Schema({
    // Indexed through the { vendorId, username / email / phone_no } indexes below.
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true
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
    // For Google sign-in (not built yet). Add its index together with that
    // feature - indexing it now would store an entry for every user.
    googleId: {
        type: String,
        default: null
    },
    // ----------------------------------------------------------------
    // Required for the owner (seeds/seedUser.js); optional for users.
    phone_no: {
        type: String,
        default: null,
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
    // Required for the owner (seeds/seedUser.js); optional for users.
    email: {
        type: String,
        default: null,
        lowercase: true,
        trim: true
    },
    address: {
        type: String,
        default: null,
        trim: true,
        maxlength: ADDRESS_MAX_LENGTH
    },
    // 'owner' (one per vendor) or 'user' (added in the Users module).
    role: {
        type: String,
        enum: ROLE_VALUES,
        default: ROLES.OWNER,
        required: true,
    },
    // Users only (RBAC).
    assignedRoles: { type: [assignedRoleSchema], default: [] },
    extraModules: { type: [extraModuleSchema], default: [] },
    extraMasters: { type: [extraMasterSchema], default: [] }
}, {
    timestamps: true
});

// Unique per vendor among users not deleted (a deleted user's username,
// email and phone can be used again); email and phone only when given.
// Changing these on an existing database: scripts/syncUserIndexes.js.
const LIVE = { status: { $in: LIVE_STATUSES } };
userSchema.index(
    { vendorId: 1, username: 1 },
    { unique: true, partialFilterExpression: LIVE }
);

userSchema.index(
    { vendorId: 1, email: 1 },
    { unique: true, partialFilterExpression: { ...LIVE, email: { $type: 'string' } } }
);

userSchema.index(
    { vendorId: 1, phone_no: 1 },
    { unique: true, partialFilterExpression: { ...LIVE, phone_no: { $type: 'string' } } }
);

// The users list (newest first), and "which users have this role / master".
userSchema.index({ vendorId: 1, role: 1, status: 1, createdAt: -1 });
userSchema.index({ vendorId: 1, 'assignedRoles.roleId': 1 });
userSchema.index({ vendorId: 1, 'extraMasters.masterId': 1 });

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
