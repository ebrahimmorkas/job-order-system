const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const {
    ROLE_NAME_MIN_LENGTH, ROLE_NAME_MAX_LENGTH, ROLE_TYPE_VALUES, PERMISSION_VALUES, MODULE_KEYS
} = require('../constants/rbacConstants');

// A role the owner defines (Role Master), given to users later (Users).
// Feature: isRBACFeatureOn. Either a module role (modules) or a master role
// (masters) - see constants/rbacConstants.js.

const moduleAccessSchema = new mongoose.Schema({
    module: { type: String, enum: MODULE_KEYS, required: true },
    // Always includes 'view' when anything else is given.
    permissions: { type: [{ type: String, enum: PERMISSION_VALUES }], default: [] }
}, { _id: false });

const masterAccessSchema = new mongoose.Schema({
    masterId: { type: mongoose.Types.ObjectId, required: true },
    // The whole master, or only valueIds (MasterValue ids of this master).
    isWholeMaster: { type: Boolean, default: false },
    valueIds: { type: [mongoose.Types.ObjectId], default: [] }
}, { _id: false });

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: ROLE_NAME_MIN_LENGTH,
        maxlength: ROLE_NAME_MAX_LENGTH
    },
    // Chosen when the role is created; never changes.
    type: {
        type: String,
        enum: ROLE_TYPE_VALUES,
        required: true
    },
    modules: { type: [moduleAccessSchema], default: [] },
    masters: { type: [masterAccessSchema], default: [] }
}, {
    timestamps: true
});

// Unique per vendor, ignoring case, among roles not deleted.
roleSchema.index({ vendorId: 1, name: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
// The list (newest first) and "which roles use this master".
roleSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
roleSchema.index({ vendorId: 1, 'masters.masterId': 1 });

roleSchema.plugin(auditPlugin);

module.exports = mongoose.model('Role', roleSchema);
