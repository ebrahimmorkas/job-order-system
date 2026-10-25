const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_EMAIL_MAX_LENGTH } = require('../constants/customerConstants');
const { CUSTOMER_ADDRESS_MAX_LENGTH } = require('../constants/jobOrderConstants');

// A vendor's customer, saved from the job orders (never created on its own -
// see services/customerService.js). One customer per phone and per email:
// a job order with a phone or email already saved updates that customer.
// Feature: isCustomersFeatureOn.
const customerSchema = new mongoose.Schema({
    name: { type: String, trim: true, maxlength: CUSTOMER_NAME_MAX_LENGTH, default: null },
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: CUSTOMER_EMAIL_MAX_LENGTH, default: null },
    // The newest address given (names copied in, like on a job order).
    address: {
        countryId: { type: mongoose.Types.ObjectId, default: null },
        countryName: { type: String, default: null },
        stateId: { type: mongoose.Types.ObjectId, default: null },
        stateName: { type: String, default: null },
        cityId: { type: mongoose.Types.ObjectId, default: null },
        cityName: { type: String, default: null },
        postalCode: { type: String, default: null },
        address: { type: String, maxlength: CUSTOMER_ADDRESS_MAX_LENGTH, default: null }
    },
    // When a job order last named this customer.
    lastJobOrderAt: { type: Date, default: null }
}, {
    timestamps: true,
    minimize: false
});

// One live customer per phone and per email (a deleted one frees them).
const uniqueWhenGiven = (field) => customerSchema.index({ vendorId: 1, [field]: 1 }, {
    unique: true,
    partialFilterExpression: { status: { $in: LIVE_STATUSES }, [field]: { $type: 'string' } }
});
uniqueWhenGiven('phone');
uniqueWhenGiven('email');
customerSchema.index({ vendorId: 1, status: 1, updatedAt: -1 });

customerSchema.plugin(auditPlugin);

module.exports = mongoose.model('Customer', customerSchema);
