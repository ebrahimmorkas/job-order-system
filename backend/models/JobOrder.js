const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { CASE_INSENSITIVE_COLLATION, LIVE_STATUSES } = require('../constants/masterConstants');
const { JOB_ORDER_NUMBER_MAX_LENGTH, DURATION_UNITS } = require('../constants/jobOrderConstants');
const { FIXED_STEP_VALUES, WORK_TIME_START_VALUES, WORK_TIME_STARTS } = require('../constants/stepConstants');
const { CONTROL_TYPE_VALUES } = require('../constants/controlConstants');

// Names are copied in (not only ids), so a job order keeps showing what was
// picked that day even after a master, value, control, country or rate is
// renamed, changed or deleted.

// How long the people given a value's work have, e.g. { amount: 2, unit: 'days' }.
const durationSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    unit: { type: String, enum: DURATION_UNITS, required: true }
}, { _id: false });

// A step a person moved their work to (names copied in, like everything
// else here). percent: In progress only; holdReason: Hold only.
const stepEntrySchema = new mongoose.Schema({
    key: { type: String, required: true },
    name: { type: String, required: true },
    fixedStep: { type: String, enum: [...FIXED_STEP_VALUES, null], default: null },
    percent: { type: Number, default: null },
    holdReason: { type: String, default: null },
    at: { type: Date, required: true }
}, { _id: false });

// Someone given a value's work, and how far they are.
const assigneeSchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, required: true },
    name: { type: String, required: true },
    // Their first step change (null = not started).
    startedAt: { type: Date, default: null },
    // When the time starts on the first step: their own due time.
    dueAt: { type: Date, default: null },
    // Their current step (null = none yet) and every step so far, oldest first.
    step: { type: stepEntrySchema, default: null },
    history: { type: [stepEntrySchema], default: [] }
}, { _id: false });

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
                type: [assigneeSchema],
                default: []
            },
            // When the work was first given (kept on edit unless completeIn
            // changes), how long they have and so when it is due. All null
            // without people; completeIn / dueAt null = no deadline.
            assignedAt: { type: Date, default: null },
            completeIn: { type: durationSchema, default: null },
            dueAt: { type: Date, default: null },
            // When the completion time starts (CompanySettings.workTimeStartsOn when
            // the clock started): onAssign - dueAt above, for everyone;
            // onFirstStep - each person's own dueAt, from their first step.
            timeStartsOn: { type: String, enum: WORK_TIME_START_VALUES, default: WORK_TIME_STARTS.ON_ASSIGN }
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
    // All optional. Name, phone and email while the Customers feature is on;
    // the address while CompanySettings.askCustomerAddress is on. A copy:
    // editing the saved customer later never changes it.
    customer: {
        name: { type: String, default: null },
        phone: { type: String, default: null },
        email: { type: String, default: null },
        countryId: { type: mongoose.Types.ObjectId, default: null },
        countryName: { type: String, default: null },
        stateId: { type: mongoose.Types.ObjectId, default: null },
        stateName: { type: String, default: null },
        cityId: { type: mongoose.Types.ObjectId, default: null },
        cityName: { type: String, default: null },
        postalCode: { type: String, default: null },
        address: { type: String, default: null }
    },
    // The saved customer (models/Customer.js) with this phone / email, or null.
    customerId: { type: mongoose.Types.ObjectId, default: null },
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
// My work: the job orders a user was given work on, newest first.
jobOrderSchema.index({ vendorId: 1, 'masters.values.assignedTo.userId': 1, status: 1, createdAt: -1 });
// Work that just went past its due time (services/overdueWatcher.js).
jobOrderSchema.index({ status: 1, 'masters.values.dueAt': 1 });
jobOrderSchema.index({ status: 1, 'masters.values.assignedTo.dueAt': 1 });

jobOrderSchema.plugin(auditPlugin);

module.exports = mongoose.model('JobOrder', jobOrderSchema);
