const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { MASTER_VALUE_NAME_MAX_LENGTH, CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');

// One option of a Master's dropdown (e.g. "Polishing" in "My Services").
// Its own document, so each value is marked active / inactive / deleted on
// its own and a job order can point at it by id.
const masterValueSchema = new mongoose.Schema({
    masterId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: MASTER_VALUE_NAME_MAX_LENGTH
    },
    // Order inside the dropdown - lowest first.
    precedence: {
        type: Number,
        required: true,
        min: 1
    }
}, {
    timestamps: true
});

// Unique inside one master, ignoring case, among values not deleted.
masterValueSchema.index({ masterId: 1, name: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
// A master's values in order, and counting them for the vendor's limit.
masterValueSchema.index({ masterId: 1, status: 1, precedence: 1 });

masterValueSchema.plugin(auditPlugin);

module.exports = mongoose.model('MasterValue', masterValueSchema);
