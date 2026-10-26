const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const { CONTROL_TYPE_VALUES } = require('../constants/controlConstants');
const { MEASURED_AS_VALUES, PRICE_CHARGED_VALUES } = require('../constants/pricingConstants');

// One choice of a radio group or dropdown. Its own _id, so a job order can
// point at it. A choice of the unit dropdown (isUnit) is a unit (sq ft,
// meter...): how it is measured, its default rate and how its size is
// worked out (rounded up, wastage, minimum).
const optionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    measuredAs: { type: String, enum: MEASURED_AS_VALUES, default: undefined },
    // Filled in as the rate of a new price (null = none).
    rate: { type: Number, min: 0, default: undefined },
    // Each measurement rounded up to this step (ROUND_UP_STEPS; null = not rounded).
    roundUpTo: { type: Number, default: undefined },
    // The smallest size charged for one piece (null = none).
    minimumSize: { type: Number, min: 0, default: undefined },
    // Added to the size, in % (null = none).
    wastagePercent: { type: Number, min: 0, default: undefined }
});

// A field the vendor adds to the job order form: a textfield, textarea,
// checkbox, radio group or dropdown. Feature: isControlsFeatureOn; which types a
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
    // Textfield only (never a price): the answer is the item's quantity, a
    // whole number (QUANTITY_PATTERN). At most one per vendor among controls
    // not deleted. With CompanySettings.priceCalculation rateTimesQuantity
    // every price of the item is its rate x this quantity.
    isQuantity: {
        type: Boolean,
        default: undefined
    },
    // Textfield price, per unit pricing: how it is charged on a per unit item
    // (PRICE_CHARGED: per piece, per unit of size, per running length of the
    // edge). Missing = per unit.
    chargedBy: {
        type: String,
        enum: PRICE_CHARGED_VALUES,
        default: undefined
    },
    // Dropdown only, per unit pricing: its choices are the units (sq ft,
    // meter...) a per unit item is charged in. At most one per vendor among
    // controls not deleted.
    isUnit: {
        type: Boolean,
        default: undefined
    },
    // Shown on a job order item only when a value of this master is picked
    // there (any value, or one of valueIds). null = always shown. Never on
    // the quantity field or the unit dropdown. A master the job order form
    // doesn't offer (inactive, feature off) leaves the control shown.
    showWhen: {
        type: new mongoose.Schema({
            masterId: { type: mongoose.Types.ObjectId, required: true },
            valueIds: { type: [mongoose.Types.ObjectId], default: [] }
        }, { _id: false }),
        default: null
    },
    // Checkbox only: ticked on a new job order.
    defaultChecked: {
        type: Boolean,
        default: false
    },
    // Radio / dropdown only: the choices, in order.
    options: {
        type: [optionSchema],
        default: undefined
    },
    // Radio / dropdown only: the choice picked on a new job order (one of options), or null.
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
