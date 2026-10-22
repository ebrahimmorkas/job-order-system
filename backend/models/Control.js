const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const { CONTROL_TYPE_VALUES } = require('../constants/controlConstants');

// One choice of a radio group. Its own _id, so a job order can point at it.
const optionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    }
});

// A field the vendor adds to the job order form: a textfield, textarea,
// checkbox or radio group. Feature: isControlsFeatureOn; which types a
// vendor may use: CompanyMaster.assignedControls. Lengths and counts are
// limited by CompanyMaster (checked in services/controlService.js).
const controlSchema = new mongoose.Schema({
    // Never changes after creation.
    type: {
        type: String,
        enum: CONTROL_TYPE_VALUES,
        required: true
    },
    // The question (textfield, textarea, radio) or the checkbox's own text.
    label: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    // The job order can't be saved without it (a checkbox: ticked).
    isRequired: {
        type: Boolean,
        default: false
    },
    // Textfield / textarea only: grey hint text inside the box.
    placeholder: {
        type: String,
        trim: true,
        default: null
    },
    // Textfield / textarea only: filled in on a new job order.
    defaultText: {
        type: String,
        default: null
    },
    // Textfield only: the answer is an amount (PRICE_PATTERN), added to the
    // job order total. Not stored for other types.
    isPrice: {
        type: Boolean,
        default: undefined
    },
    // Textfield price only: tax is charged on this amount.
    isPriceIncludedInTax: {
        type: Boolean,
        default: undefined
    },
    // Checkbox only: ticked on a new job order.
    defaultChecked: {
        type: Boolean,
        default: false
    },
    // Radio only: the choices, in order.
    options: {
        type: [optionSchema],
        default: undefined
    },
    // Radio only: the choice picked on a new job order (one of options), or null.
    defaultOptionId: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    // Order on the job order form - lowest first.
    precedence: {
        type: Number,
        required: true,
        min: 1
    }
}, {
    timestamps: true
});

// Labels are unique per vendor, ignoring case, among controls not deleted.
controlSchema.index({ vendorId: 1, label: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
// The list in display order, and counting per type for the limits.
controlSchema.index({ vendorId: 1, precedence: 1 });
controlSchema.index({ vendorId: 1, type: 1, status: 1 });

controlSchema.plugin(auditPlugin);

module.exports = mongoose.model('Control', controlSchema);
