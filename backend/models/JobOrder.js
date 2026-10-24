const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const { JOB_ORDER_NUMBER_MAX_LENGTH } = require('../constants/jobOrderConstants');
const { CONTROL_TYPE_VALUES } = require('../constants/controlConstants');

// Names are copied in (not only ids), so a job order keeps showing what was
// picked that day even after a master, value, control, country or rate is
// renamed, changed or deleted.

const pickedMasterSchema = new mongoose.Schema({
    masterId: { type: mongoose.Types.ObjectId, required: true },
    name: { type: String, required: true },
    shortName: { type: String, default: null },
    values: {
        type: [{
            _id: false,
            valueId: { type: mongoose.Types.ObjectId, required: true },
            name: { type: String, required: true },
            // The users given this value's work (a role master only); names copied in.
            assignedTo: {
                type: [{ _id: false, userId: { type: mongoose.Types.ObjectId, required: true }, name: { type: String, required: true } }],
                default: []
            }
        }],
        default: []
    }
}, { _id: false });

const answeredControlSchema = new mongoose.Schema({
    controlId: { type: mongoose.Types.ObjectId, required: true },
    type: { type: String, enum: CONTROL_TYPE_VALUES, required: true },
    label: { type: String, required: true },
    // Text field / text area: the answer (a price: the amount as typed).
    text: { type: String, default: null },
    // Checkbox: ticked.
    checked: { type: Boolean, default: null },
    // Radio: the choice picked.
    optionId: { type: mongoose.Types.ObjectId, default: null },
    optionName: { type: String, default: null },
    // A price text field: its amount (added to the total) and whether tax is charged on it.
    isPrice: { type: Boolean, default: false },
    isPriceIncludedInTax: { type: Boolean, default: false },
    amount: { type: Number, default: null }
}, { _id: false });

// The vendor's job orders. Any logged-in user of the vendor makes them.
// status: 'A' = active, 'D' = cancelled (kept, hidden from the list).
const jobOrderSchema = new mongoose.Schema({
    // JO-0001... when the app makes it, else typed by the owner. Unique per
    // vendor (ignoring case) among job orders not cancelled.
    jobOrderNumber: {
        type: String,
        required: true,
        trim: true,
        maxlength: JOB_ORDER_NUMBER_MAX_LENGTH
    },
    // Asked only while CompanySettings.askCustomerAddress is on; all optional.
    customer: {
        countryId: { type: mongoose.Types.ObjectId, default: null },
        countryName: { type: String, default: null },
        stateId: { type: mongoose.Types.ObjectId, default: null },
        stateName: { type: String, default: null },
        cityId: { type: mongoose.Types.ObjectId, default: null },
        cityName: { type: String, default: null },
        postalCode: { type: String, default: null },
        address: { type: String, default: null }
    },
    masters: { type: [pickedMasterSchema], default: [] },
    controls: { type: [answeredControlSchema], default: [] },
    // The currency of the tax country (null when there is none).
    currency: {
        code: { type: String, default: null },
        symbol: { type: String, default: null },
        decimalPlaces: { type: Number, default: 2 }
    },
    // The sum of every price.
    subtotal: { type: Number, default: 0 },
    tax: {
        // Charged on this job order; when not, reason says why (null = no price to tax).
        isApplied: { type: Boolean, default: false },
        reason: { type: String, default: null },
        countryId: { type: mongoose.Types.ObjectId, default: null },
        countryName: { type: String, default: null },
        taxId: { type: mongoose.Types.ObjectId, default: null },
        name: { type: String, default: null },
        totalRate: { type: Number, default: null },
        // How it is shown, e.g. CGST 9% + SGST 9%, or IGST 18% between two states.
        components: {
            type: [{ _id: false, label: String, rate: Number, amount: Number }],
            default: []
        },
        // The prices tax is charged on, and the tax itself.
        taxableAmount: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
    },
    total: { type: Number, default: 0 },
    // Photos added to the job order (ImageAsset ids, with their address).
    images: {
        type: [{ _id: false, imageId: { type: mongoose.Types.ObjectId, required: true }, url: { type: String, required: true } }],
        default: []
    }
}, {
    timestamps: true
});

jobOrderSchema.index({ vendorId: 1, jobOrderNumber: 1 }, {
    unique: true,
    collation: CASE_INSENSITIVE_COLLATION,
    partialFilterExpression: { status: { $in: LIVE_STATUSES } }
});
// The list, newest first.
jobOrderSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

jobOrderSchema.plugin(auditPlugin);

module.exports = mongoose.model('JobOrder', jobOrderSchema);
