const Joi = require('joi');
const { JOB_ORDER_NUMBER_MAX_LENGTH, CUSTOMER_ADDRESS_MAX_LENGTH, ANSWER_MAX_LENGTH, ASSIGNEES_PER_VALUE_MAX, DURATION_UNITS, DURATION_AMOUNT_MAX, JOB_ORDER_LIST_MAX_PAGE_SIZE, JOB_ORDER_ITEMS_MAX, JOB_NAME_MAX_LENGTH } = require('../../constants/jobOrderConstants');
const { MAX_IMAGES_PER_REQUEST } = require('../../constants/storageConstants');
const { POSTAL_CODE_MAX_LENGTH } = require('../../constants/taxConstants');
const { HOLD_REASON_MAX_LENGTH } = require('../../constants/stepConstants');
const { PRICE_PATTERN } = require('../../constants/controlConstants');
const { CHARGE_BY, CHARGE_BY_VALUES, MEASUREMENT_PATTERN, DISCOUNT_TYPE_VALUES } = require('../../constants/pricingConstants');
const { contact } = require('./customerValidations');

// What the vendor's own masters, controls, countries and rates allow is
// checked in services/jobOrderService.js; only the fixed rules are here.

const objectId = (label) => Joi.string().hex().length(24).label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

// Optional text: '' and null are saved as null.
const optionalText = (label, max) => Joi.string().trim().max(max).allow('', null).empty(['', null]).default(null).label(label);

// An optional amount (at most 2 decimals), typed as text: '' and null = none.
const optionalAmount = (label) => Joi.string().trim().pattern(PRICE_PATTERN).allow('', null).empty(['', null]).default(null).label(label)
    .messages({ 'string.pattern.base': 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50' });

// A measurement of a per unit item: more than 0, at most 3 decimals; empty = 1.
const measurement = (label) => Joi.string().trim().pattern(MEASUREMENT_PATTERN).allow('', null).empty(['', null]).default(null).label(label)
    .custom((value, helpers) => (value !== null && Number(value) <= 0 ? helpers.error('measurement.zero') : value))
    .messages({ 'string.pattern.base': 'Enter a number with at most 3 decimals, e.g. 10 or 2.5', 'measurement.zero': 'Enter a number more than 0' });

const jobOrderIdParamSchema = Joi.object({
    id: objectId('Job order id').required()
});

// GET /api/job-orders
const listJobOrdersQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).allow('').default('').label('Search'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(JOB_ORDER_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// One item of a job order: its job name, the masters, the controls and its images.
const itemSchema = Joi.object({
    // Editing: the saved item this is (null = a new item).
    itemId: objectId('Item').allow(null).default(null),
    name: optionalText('Job name', JOB_NAME_MAX_LENGTH),
    // The values picked in each master (one, or several for a multi-select
    // one) and, for a role master, who is given each picked value's work.
    masters: Joi.array().items(Joi.object({
        masterId: objectId('Master').required(),
        valueIds: Joi.array().items(objectId('Value')).unique().default([]).label('Values'),
        assignments: Joi.array().items(Joi.object({
            valueId: objectId('Value').required(),
            userIds: Joi.array().items(objectId('User')).unique().max(ASSIGNEES_PER_VALUE_MAX).default([]).label('People')
                .messages({ 'array.max': `At most ${ASSIGNEES_PER_VALUE_MAX} people per value` }),
            // How long they have, from when the work was given (null = no deadline).
            completeIn: Joi.object({
                amount: Joi.number().integer().min(1).max(DURATION_AMOUNT_MAX).required().label('Complete in'),
                unit: Joi.string().valid(...DURATION_UNITS).required().label('Unit')
            }).allow(null).default(null).label('Complete in')
        })).unique('valueId').default([]).label('Assigned work')
    })).unique('masterId').default([]).label('Masters'),
    // The answer of each control: text (text field / text area), checked
    // (checkbox) or optionId (radio).
    controls: Joi.array().items(Joi.object({
        controlId: objectId('Control').required(),
        text: Joi.string().max(ANSWER_MAX_LENGTH).allow('', null).default(null).label('Answer'),
        checked: Joi.boolean().default(false).label('Ticked'),
        optionId: objectId('Choice').allow(null).default(null),
        // A price worked out as rate x quantity: the amount typed over it by
        // hand (null = rate x quantity). text is then the rate of one piece.
        total: Joi.string().trim().max(30).allow('', null).empty(['', null]).default(null).label('Total')
    })).unique('controlId').default([]).label('Controls'),
    // Per unit pricing: how the item is charged (per piece without the
    // feature) and, per unit, its measurements (which ones the unit takes is
    // checked in the service).
    chargeBy: Joi.string().valid(...CHARGE_BY_VALUES).default(CHARGE_BY.PIECE).label('How it is charged'),
    measurements: Joi.object({
        length: measurement('Length'),
        width: measurement('Width'),
        height: measurement('Height')
    }).default({ length: null, width: null, height: null }).label('Measurements'),
    // Editing: the job order's images this item keeps (the rest are removed).
    keepImageIds: Joi.array().items(objectId('Image')).unique().default([]).label('Images'),
    // How many of the files in the "images" field of a multipart request
    // are this item's (the files come item after item, in order).
    newImageCount: Joi.number().integer().min(0).max(MAX_IMAGES_PER_REQUEST).default(0).label('New images')
});

// POST /api/job-orders and PUT /api/job-orders/:id
const jobOrderSchema = Joi.object({
    // Only when the owner types the number (CompanySettings.isJobOrderNumberAutoGenerated off).
    jobOrderNumber: optionalText('Job order number', JOB_ORDER_NUMBER_MAX_LENGTH),
    // Each part optional: name, phone and email while the Customers feature
    // is on, the address while it is asked.
    customer: Joi.object({
        ...contact,
        countryId: objectId('Country').allow(null).default(null),
        stateId: objectId('State').allow(null).default(null),
        cityId: objectId('City').allow(null).default(null),
        postalCode: optionalText('Postal code', POSTAL_CODE_MAX_LENGTH),
        address: optionalText('Address', CUSTOMER_ADDRESS_MAX_LENGTH)
    }).default({ name: null, phone: null, email: null, countryId: null, stateId: null, cityId: null, postalCode: null, address: null }).label('Customer'),
    // At least one item (the vendor's own limit is checked in the service).
    items: Joi.array().items(itemSchema).min(1).max(JOB_ORDER_ITEMS_MAX)
        .unique((a, b) => a.itemId !== null && a.itemId === b.itemId).required().label('Items')
        .messages({ 'array.min': 'Add at least one item', 'array.max': `At most ${JOB_ORDER_ITEMS_MAX} items`, 'array.unique': 'An item is sent twice' }),
    // The rate charged (null = the vendor's default rate of the tax country).
    taxId: objectId('Tax rate').allow(null).default(null),
    // When the customer gets it (only while CompanySettings.askDeliveryDate is on).
    deliveryAt: Joi.date().iso().allow(null).default(null).label('Delivery date'),
    // Taken off before tax (only while CompanySettings.allowDiscount is on).
    discount: Joi.object({
        type: Joi.string().valid(...DISCOUNT_TYPE_VALUES).required().label('Discount type'),
        value: optionalAmount('Discount')
    }).allow(null).default(null).label('Discount'),
    // Received with the job order (only while CompanySettings.askAdvance is on).
    advance: optionalAmount('Advance')
});

// PATCH /api/job-orders/:id/step - the job order's own step (which steps the
// vendor has is checked in services/jobOrderService.js).
const jobOrderStepSchema = Joi.object({
    stepKey: Joi.string().max(100).required().label('Step'),
    // In progress only: how much is done.
    percent: Joi.number().integer().min(0).max(100).allow(null).default(null).label('Work done (%)'),
    // Hold only: why.
    holdReason: Joi.string().trim().max(HOLD_REASON_MAX_LENGTH).allow('', null).empty(['', null]).default(null).label('Reason')
});

module.exports = {
    jobOrderStepSchema,
    jobOrderIdParamSchema,
    listJobOrdersQuerySchema,
    jobOrderSchema
};
