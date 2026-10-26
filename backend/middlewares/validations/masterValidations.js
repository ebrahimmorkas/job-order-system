const Joi = require('joi');
const {
    MASTER_NAME_MIN_LENGTH, MASTER_NAME_MAX_LENGTH, MASTER_SHORT_NAME_MAX_LENGTH,
    MASTER_VALUE_NAME_MAX_LENGTH, MASTER_LIST_MAX_PAGE_SIZE
} = require('../../constants/masterConstants');

const objectId = (label) => Joi.string().hex().length(24).required().label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

// Same name ignoring case, e.g. "Polishing" and "polishing".
const sameName = (a, b) => a.name.toLowerCase() === b.name.toLowerCase();

const masterName = Joi.string().trim().min(MASTER_NAME_MIN_LENGTH).max(MASTER_NAME_MAX_LENGTH).label('Name');
const shortName = Joi.string().trim().max(MASTER_SHORT_NAME_MAX_LENGTH).allow('', null).empty(['', null]).default(null).label('Short name');
const valueName = Joi.string().trim().min(1).max(MASTER_VALUE_NAME_MAX_LENGTH).label('Value');

// ---- params -------------------------------------------------------------
const masterIdParamSchema = Joi.object({
    id: objectId('Master id')
});

const valueIdParamSchema = Joi.object({
    id: objectId('Master id'),
    valueId: objectId('Value id')
});

// ---- masters ------------------------------------------------------------
// GET /api/masters
const listMastersQuerySchema = Joi.object({
    search: Joi.string().trim().max(MASTER_NAME_MAX_LENGTH).allow('').default('').label('Search'),
    status: Joi.string().valid('A', 'I').label('Status'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(MASTER_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// The values list, in dropdown order. A value's status lets a copy keep
// inactive values inactive. On edit, existing values carry their _id (no
// _id = a new value); the same value can't be listed twice. At most one
// value is the default, and it must be active.
const valuesList = (valueItem) => Joi.array().items(valueItem).min(1).required().label('Values')
    .unique((a, b) => sameName(a, b) || (!!a._id && a._id === b._id))
    .custom((values, helpers) => {
        const defaults = values.filter((value) => value.isDefault);
        if (defaults.length > 1) return helpers.error('values.oneDefault');
        if (defaults.length === 1 && defaults[0].status !== 'A') return helpers.error('values.defaultActive');
        return values;
    })
    .messages({
        'array.min': 'Add at least one value',
        'array.unique': 'Each value must have a different name',
        'values.oneDefault': 'Only one value can be the default',
        'values.defaultActive': 'An inactive value cannot be the default'
    });

const valueFields = {
    name: valueName.required(),
    status: Joi.string().valid('A', 'I').default('A').label('Value status'),
    isDefault: Joi.boolean().default(false).label('Default')
};

// POST /api/masters - the master with its values.
const createMasterSchema = Joi.object({
    name: masterName.required(),
    shortName,
    isRequired: Joi.boolean().default(false).label('Required'),
    isMultiselectAllowed: Joi.boolean().default(false).label('Allow multiple selection'),
    isRoleProvided: Joi.boolean().default(false).label('Role will be provided for this master'),
    values: valuesList(Joi.object(valueFields))
});

// PUT /api/masters/:id - the details and the full values list, saved together.
const updateMasterSchema = Joi.object({
    name: masterName.required(),
    shortName,
    isRequired: Joi.boolean().default(false).label('Required'),
    isMultiselectAllowed: Joi.boolean().required().label('Allow multiple selection'),
    isRoleProvided: Joi.boolean().default(false).label('Role will be provided for this master'),
    values: valuesList(Joi.object({ _id: objectId('Value id').optional(), ...valueFields }))
});

// PATCH /api/masters/:id/status and /api/masters/:id/values/:valueId/status
const statusSchema = Joi.object({
    isActive: Joi.boolean().required().label('isActive')
});

// PATCH /api/masters/:id/default - valueId null = no default.
const defaultValueSchema = Joi.object({
    valueId: objectId('Value id').allow(null)
});

// POST /api/masters/bulk - removeFromRoles: deleting also takes the masters
// out of the roles / users using them (after the alert).
const bulkMastersSchema = Joi.object({
    action: Joi.string().valid('activate', 'deactivate', 'delete').required().label('Action'),
    ids: Joi.array().items(objectId('Master id')).min(1).max(MASTER_LIST_MAX_PAGE_SIZE).unique().required().label('Masters'),
    removeFromRoles: Joi.boolean().default(false).label('Remove from roles')
});

// DELETE /api/masters/:id?removeFromRoles=true
const deleteMasterQuerySchema = Joi.object({
    removeFromRoles: Joi.boolean().default(false).label('Remove from roles')
});

// POST /api/masters/role-usage - the roles / users using these masters.
const roleUsageSchema = Joi.object({
    ids: Joi.array().items(objectId('Master id')).min(1).max(MASTER_LIST_MAX_PAGE_SIZE).unique().required().label('Masters')
});

// PATCH /api/masters/:id/move - one place up or down in the whole list.
const moveSchema = Joi.object({
    direction: Joi.string().valid('up', 'down').required().label('Direction')
});

module.exports = {
    masterIdParamSchema,
    valueIdParamSchema,
    listMastersQuerySchema,
    createMasterSchema,
    updateMasterSchema,
    statusSchema,
    defaultValueSchema,
    bulkMastersSchema,
    deleteMasterQuerySchema,
    roleUsageSchema,
    moveSchema
};
