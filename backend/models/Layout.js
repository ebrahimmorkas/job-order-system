const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const {
    LAYOUT_NAME_MIN_LENGTH, LAYOUT_NAME_MAX_LENGTH, PAPER_SIZE_VALUES, ORIENTATIONS, LABEL_DEFAULTS
} = require('../constants/layoutConstants');

// A print layout for job orders (Layout Master). Feature: isLayoutMasterFeatureOn.
// The page and every element are in millimetres from the page's top-left.
const layoutSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: LAYOUT_NAME_MIN_LENGTH,
        maxlength: LAYOUT_NAME_MAX_LENGTH
    },
    paper: {
        // A named size, or 'custom' with the width / height typed in.
        size: { type: String, enum: PAPER_SIZE_VALUES, required: true },
        orientation: { type: String, enum: ORIENTATIONS, default: 'portrait' },
        // The page as printed (orientation already applied).
        widthMm: { type: Number, required: true },
        heightMm: { type: Number, required: true }
    },
    // Which fields show their label when dropped (each can be changed).
    labelDefault: { type: String, enum: LABEL_DEFAULTS, default: 'none' },
    // The header (top) and footer (bottom) bands: what lies inside them is
    // printed on every page. 0 = none.
    headerHeightMm: { type: Number, default: 0 },
    footerHeightMm: { type: Number, default: 0 },
    // The elements, bottom to top: { id, type, x, y, width, height, ... }.
    // Their shape is checked by middlewares/validations/layoutValidations.js
    // and services/layoutService.js.
    elements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Picked in advance when a job order is printed. At most one per vendor.
    isDefault: { type: Boolean, default: false }
}, {
    timestamps: true,
    minimize: false
});

// Unique per vendor, ignoring case, among layouts not deleted.
layoutSchema.index({ vendorId: 1, name: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
// The list, newest first.
layoutSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

layoutSchema.plugin(auditPlugin);

module.exports = mongoose.model('Layout', layoutSchema);
