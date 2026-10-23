const Joi = require('joi');
const {
    ROLE_NAME_MIN_LENGTH, ROLE_NAME_MAX_LENGTH, ROLE_LIST_MAX_PAGE_SIZE, ROLE_TYPE_VALUES, PERMISSION_VALUES, MODULE_KEYS
} = require('../../constants/rbacConstants');

// Which modules / masters / values the vendor can actually use is checked in
// services/roleService.js; only the fixed rules are here.

const objectId = (label) => Joi.string().hex().length(24).required().label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

const roleName = Joi.string().trim().min(ROLE_NAME_MIN_LENGTH).max(ROLE_NAME_MAX_LENGTH).required().label('Role name');

// Module role: per module, the permissions given.
const modules = Joi.array().items(Joi.object({
    module: Joi.string().valid(...MODULE_KEYS).required().label('Module'),
    permissions: Joi.array().items(Joi.string().valid(...PERMISSION_VALUES)).unique().default([]).label('Permissions')
})).unique('module').default([]).label('Modules')
    .messages({ 'array.unique': 'Each module can be added only once' });

// Master role: per master, the whole master or some of its values.
const masters = Joi.array().items(Joi.object({
    masterId: objectId('Master'),
    isWholeMaster: Joi.boolean().default(false).label('Whole master'),
    valueIds: Joi.array().items(objectId('Value').optional()).unique().default([]).label('Values')
})).unique('masterId').default([]).label('Masters')
    .messages({ 'array.unique': 'Each master can be added only once' });

const roleIdParamSchema = Joi.object({
    id: objectId('Role id')
});

// GET /api/roles
const listRolesQuerySchema = Joi.object({
    search: Joi.string().trim().max(ROLE_NAME_MAX_LENGTH).allow('').default('').label('Search'),
    status: Joi.string().valid('A', 'I').label('Status'),
    type: Joi.string().valid(...ROLE_TYPE_VALUES).label('Type'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(ROLE_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// POST /api/roles - the type is chosen here and never changes.
const createRoleSchema = Joi.object({
    name: roleName,
    type: Joi.string().valid(...ROLE_TYPE_VALUES).required().label('Role type'),
    modules,
    masters
});

// PUT /api/roles/:id
const updateRoleSchema = Joi.object({
    name: roleName,
    modules,
    masters
});

// PATCH /api/roles/:id/status
const statusSchema = Joi.object({
    isActive: Joi.boolean().required().label('isActive')
});

// POST /api/roles/bulk
const bulkRolesSchema = Joi.object({
    action: Joi.string().valid('activate', 'deactivate', 'delete').required().label('Action'),
    ids: Joi.array().items(objectId('Role id').optional()).min(1).max(ROLE_LIST_MAX_PAGE_SIZE).unique().required().label('Roles')
});

module.exports = {
    roleIdParamSchema,
    listRolesQuerySchema,
    createRoleSchema,
    updateRoleSchema,
    statusSchema,
    bulkRolesSchema
};
