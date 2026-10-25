const Joi = require('joi');
const {
    CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_PHONE_PATTERN, CUSTOMER_EMAIL_MAX_LENGTH, CUSTOMER_PHONE_MESSAGE,
    CUSTOMER_LIST_MAX_PAGE_SIZE, CUSTOMER_SEARCH_MAX_LENGTH
} = require('../../constants/customerConstants');
const { CUSTOMER_ADDRESS_MAX_LENGTH } = require('../../constants/jobOrderConstants');
const { POSTAL_CODE_MAX_LENGTH } = require('../../constants/taxConstants');

// The vendor's countries, states and cities are checked in
// services/customerService.js; only the fixed rules are here.

const objectId = (label) => Joi.string().hex().length(24).label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

// Optional text: '' and null are saved as null.
const optionalText = (schema) => schema.allow('', null).empty(['', null]).default(null);

// A customer's name, phone and email - also on the job order (jobOrderValidations).
const contact = {
    name: optionalText(Joi.string().trim().max(CUSTOMER_NAME_MAX_LENGTH).label('Customer name')),
    phone: optionalText(Joi.string().trim().pattern(CUSTOMER_PHONE_PATTERN).label('Phone')
        .messages({ 'string.pattern.base': CUSTOMER_PHONE_MESSAGE })),
    email: optionalText(Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(CUSTOMER_EMAIL_MAX_LENGTH).label('Email'))
};

const customerIdParamSchema = Joi.object({
    id: objectId('Customer id').required()
});

// GET /api/customers
const listCustomersQuerySchema = Joi.object({
    search: Joi.string().trim().max(CUSTOMER_SEARCH_MAX_LENGTH).allow('').default('').label('Search'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(CUSTOMER_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// GET /api/customers/for-job-order
const searchCustomersQuerySchema = Joi.object({
    search: Joi.string().trim().max(CUSTOMER_SEARCH_MAX_LENGTH).allow('').default('').label('Search')
});

// PUT /api/customers/:id
const customerSchema = Joi.object({
    ...contact,
    address: Joi.object({
        countryId: objectId('Country').allow(null).default(null),
        stateId: objectId('State').allow(null).default(null),
        cityId: objectId('City').allow(null).default(null),
        postalCode: optionalText(Joi.string().trim().max(POSTAL_CODE_MAX_LENGTH).label('Postal code')),
        address: optionalText(Joi.string().trim().max(CUSTOMER_ADDRESS_MAX_LENGTH).label('Address'))
    }).default({ countryId: null, stateId: null, cityId: null, postalCode: null, address: null }).label('Address')
});

// POST /api/customers/bulk - delete only.
const bulkCustomersSchema = Joi.object({
    action: Joi.string().valid('delete').required().label('Action'),
    ids: Joi.array().items(objectId('Customer id')).min(1).max(CUSTOMER_LIST_MAX_PAGE_SIZE).unique().required().label('Customers')
});

module.exports = {
    contact,
    customerIdParamSchema,
    listCustomersQuerySchema,
    searchCustomersQuerySchema,
    customerSchema,
    bulkCustomersSchema
};
