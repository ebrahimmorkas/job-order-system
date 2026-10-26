const Joi = require('joi');
const {
    CONTROL_TYPES, CONTROL_TYPE_VALUES, TEXT_CONTROL_TYPES,
    CONTROL_SEARCH_MAX_LENGTH, PRICE_PATTERN, QUANTITY_PATTERN, MIN_RADIO_OPTIONS, CONTROL_LIST_MAX_PAGE_SIZE
} = require('../../constants/controlConstants');
const {
    MEASURED_AS, MEASURED_AS_VALUES, ROUND_UP_STEPS, MEASUREMENT_PATTERN, WASTAGE_MAX, PRICE_CHARGED, PRICE_CHARGED_VALUES
} = require('../../constants/pricingConstants');

// Limits that differ per vendor (CompanyMaster: lengths of the label,
// placeholder, default text and choices, number of radio choices) are checked in services/controlService.js; only the fixed rules
// are here.

const objectId = (label) => Joi.string().hex().length(24).required().label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

const isText = Joi.valid(...TEXT_CONTROL_TYPES);

// ---- params -------------------------------------------------------------
const controlIdParamSchema = Joi.object({
    id: objectId('Control id')
});

// ---- list -----------------------------------------------------------------
// GET /api/controls
const listControlsQuerySchema = Joi.object({
    search: Joi.string().trim().max(CONTROL_SEARCH_MAX_LENGTH).allow('').default('').label('Search'),
    status: Joi.string().valid('A', 'I').label('Status'),
    type: Joi.string().valid(...CONTROL_TYPE_VALUES).label('Type'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(CONTROL_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// ---- create / update --------------------------------------------------------
const defaultText = Joi.string().allow('', null).empty(['', null]).default(null).label('Default text');
// A price text field's default: an amount.
const defaultAmount = Joi.string().trim().pattern(PRICE_PATTERN).allow('', null).empty(['', null]).default(null).label('Default amount')
    .messages({ 'string.pattern.base': 'The default amount must be a number with at most 2 decimals, e.g. 150 or 150.50' });

// A quantity text field's default: a whole number.
const defaultQuantity = Joi.string().trim().pattern(QUANTITY_PATTERN).allow('', null).empty(['', null]).default(null).label('Default quantity')
    .messages({ 'string.pattern.base': 'The default quantity must be a whole number from 1 to 999999' });

// A choice of the unit dropdown is a unit: how it is measured, its default
// rate and how its size is worked out. Kept only on the unit dropdown
// (services/controlService.js).
const unitFields = {
    measuredAs: Joi.string().valid(...MEASURED_AS_VALUES).default(MEASURED_AS.NUMBER).label('Measured as'),
    rate: Joi.string().trim().pattern(PRICE_PATTERN).allow('', null).empty(['', null]).default(null).label('Rate')
        .messages({ 'string.pattern.base': 'The rate must be an amount with at most 2 decimals, e.g. 100 or 12.50' }),
    roundUpTo: Joi.number().valid(...ROUND_UP_STEPS).allow(null).default(null).label('Round up to'),
    minimumSize: Joi.string().trim().pattern(MEASUREMENT_PATTERN).allow('', null).empty(['', null]).default(null).label('Minimum size')
        .messages({ 'string.pattern.base': 'The minimum size must be a number with at most 3 decimals, e.g. 1 or 0.5' }),
    wastagePercent: Joi.number().min(0).max(WASTAGE_MAX).precision(2).allow(null).default(null).label('Wastage (%)')
};

// The choices of a radio group / dropdown, in order. On edit, existing
// choices carry their _id (no _id = a new one). Names differ ignoring case;
// at most one default.
const optionsList = (min) => Joi.array()
    .items(Joi.object({
        _id: objectId('Choice id').optional(),
        name: Joi.string().trim().min(1).required().label('Choice'),
        isDefault: Joi.boolean().default(false).label('Default'),
        ...unitFields
    }))
    .min(min)
    .unique((a, b) => a.name.toLowerCase() === b.name.toLowerCase() || (!!a._id && a._id === b._id))
    .custom((options, helpers) => (options.filter((option) => option.isDefault).length > 1 ? helpers.error('options.oneDefault') : options))
    .label('Choices')
    .messages({
        'array.min': min === 1 ? 'Add at least 1 choice' : `Add at least ${min} choices`,
        'array.unique': 'Each choice must have a different name',
        'options.oneDefault': 'Only one choice can be the default'
    });

// POST /api/controls and PUT /api/controls/:id (the type can't change on edit).
// Fields that don't belong to the control's type are dropped.
const controlSchema = Joi.object({
    type: Joi.string().valid(...CONTROL_TYPE_VALUES).required().label('Type'),
    label: Joi.string().trim().min(1).required().label('Label'),
    isRequired: Joi.boolean().default(false).label('Required'),
    placeholder: Joi.when('type', {
        is: isText,
        then: Joi.string().trim().allow('', null).empty(['', null]).default(null).label('Placeholder'),
        otherwise: Joi.any().strip()
    }),
    defaultText: Joi.when('type', {
        switch: [
            { is: CONTROL_TYPES.TEXTFIELD, then: Joi.when('isPrice', { is: true, then: defaultAmount, otherwise: Joi.when('isQuantity', { is: true, then: defaultQuantity, otherwise: defaultText }) }) },
            { is: CONTROL_TYPES.TEXTAREA, then: defaultText }
        ],
        otherwise: Joi.any().strip()
    }),
    isPrice: Joi.when('type', {
        is: CONTROL_TYPES.TEXTFIELD,
        then: Joi.boolean().default(false).label('Is this going to be price'),
        otherwise: Joi.any().strip()
    }),
    // Only for a price; otherwise always false.
    isPriceIncludedInTax: Joi.when('type', {
        is: CONTROL_TYPES.TEXTFIELD,
        then: Joi.when('isPrice', { is: true, then: Joi.boolean().default(false).label('Include this price in tax'), otherwise: Joi.any().strip() }),
        otherwise: Joi.any().strip()
    }),
    // A quantity is never a price: with isPrice it is always false.
    isQuantity: Joi.when('type', {
        is: CONTROL_TYPES.TEXTFIELD,
        then: Joi.when('isPrice', { is: true, then: Joi.any().strip(), otherwise: Joi.boolean().default(false).label('This is a quantity field') }),
        otherwise: Joi.any().strip()
    }),
    // A price on a per unit item (only used with per unit pricing).
    chargedBy: Joi.when('type', {
        is: CONTROL_TYPES.TEXTFIELD,
        then: Joi.when('isPrice', { is: true, then: Joi.string().valid(...PRICE_CHARGED_VALUES).default(PRICE_CHARGED.UNIT).label('Charged'), otherwise: Joi.any().strip() }),
        otherwise: Joi.any().strip()
    }),
    // The dropdown whose choices are the units (only with per unit pricing).
    isUnit: Joi.when('type', {
        is: CONTROL_TYPES.DROPDOWN,
        then: Joi.boolean().default(false).label('Use this dropdown to pick the pricing unit'),
        otherwise: Joi.any().strip()
    }),
    // "Show only when" a master (any of its values, or some) is picked on the item.
    showWhen: Joi.object({
        masterId: objectId('Master'),
        valueIds: Joi.array().items(objectId('Value')).unique().default([]).label('Values')
    }).allow(null).default(null).label('Show only when'),
    defaultChecked: Joi.when('type', {
        is: CONTROL_TYPES.CHECKBOX,
        then: Joi.boolean().default(false).label('Ticked by default'),
        otherwise: Joi.any().strip()
    }),
    options: Joi.when('type', {
        switch: [
            { is: CONTROL_TYPES.RADIO, then: optionsList(MIN_RADIO_OPTIONS).required() },
            { is: CONTROL_TYPES.DROPDOWN, then: optionsList(1).required() }
        ],
        otherwise: Joi.any().strip()
    })
});

// ---- the rest -----------------------------------------------------------------
const statusSchema = Joi.object({
    isActive: Joi.boolean().required().label('isActive')
});

const moveSchema = Joi.object({
    direction: Joi.string().valid('up', 'down').required().label('Direction')
});

const bulkControlsSchema = Joi.object({
    action: Joi.string().valid('activate', 'deactivate', 'delete').required().label('Action'),
    ids: Joi.array().items(objectId('Control id')).min(1).max(CONTROL_LIST_MAX_PAGE_SIZE).unique().required().label('Controls')
});

module.exports = {
    controlIdParamSchema,
    listControlsQuerySchema,
    controlSchema,
    statusSchema,
    moveSchema,
    bulkControlsSchema
};
