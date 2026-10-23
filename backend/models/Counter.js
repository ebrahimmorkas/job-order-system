const mongoose = require('mongoose');

// A running number per vendor, e.g. the last automatic job order number
// (key 'jobOrder'). Raised with one atomic $inc, so two job orders made at
// the same moment never get the same number. Not audited (models/plugins/
// auditPlugin.js AUDIT_EXEMPT_MODELS): it changes on every job order, and
// the job orders themselves are.
const counterSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    key: {
        type: String,
        required: true
    },
    seq: {
        type: Number,
        default: 0
    }
});

counterSchema.index({ vendorId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
