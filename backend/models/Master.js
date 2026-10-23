const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const {
    MASTER_NAME_MIN_LENGTH, MASTER_NAME_MAX_LENGTH, MASTER_SHORT_NAME_MAX_LENGTH,
    CASE_INSENSITIVE_COLLATION, LIVE_STATUSES
} = require('../constants/masterConstants');

// A vendor's own dropdown list (e.g. "My Services"), shown on the job order
// form. Its options are MasterValue documents. Feature: isMasterModuleFeatureOn.
const masterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: MASTER_NAME_MIN_LENGTH,
        maxlength: MASTER_NAME_MAX_LENGTH
    },
    shortName: {
        type: String,
        trim: true,
        maxlength: MASTER_SHORT_NAME_MAX_LENGTH,
        default: null
    },
    // The job order can't be saved without a value picked here.
    isRequired: {
        type: Boolean,
        default: false
    },
    // Roles (RBAC): a master role can be given for this master - the whole
    // master or some of its values (models/Role.js).
    isRoleProvided: {
        type: Boolean,
        default: false
    },
    // On the job order: pick several values instead of one.
    isMultiselectAllowed: {
        type: Boolean,
        default: false
    },
    // The value picked in advance on a new job order (an active value of
    // this master), or null for none.
    defaultValueId: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    // Order of the dropdowns on the job order form - lowest first.
    precedence: {
        type: Number,
        required: true,
        min: 1
    }
}, {
    timestamps: true
});

// Unique per vendor, ignoring case, among masters not deleted - a deleted
// master's name / short name can be used again.
masterSchema.index({ vendorId: 1, name: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
masterSchema.index({ vendorId: 1, shortName: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES }, shortName: { $type: 'string' } }
});
// The list, in display order.
masterSchema.index({ vendorId: 1, precedence: 1 });

masterSchema.plugin(auditPlugin);

module.exports = mongoose.model('Master', masterSchema);
