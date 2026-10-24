const Joi = require('joi');
const {
    USER_NAME_MIN_LENGTH, USER_NAME_MAX_LENGTH, USERNAME_PATTERN, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH, EMAIL_MAX_LENGTH, PHONE_PATTERN, ADDRESS_MAX_LENGTH, USER_LIST_MAX_PAGE_SIZE,
    DATE_PATTERN, MODULE_KEYS, PERMISSION_VALUES
} = require('../../constants/rbacConstants');

// Which roles / modules / masters the vendor can actually give, the limits
// and the date order are checked in services/userService.js.

const objectId = (label) => Joi.string().hex().length(24).required().label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

// Empty text counts as not given.
const optionalText = (schema) => schema.allow('', null).empty(['', null]).default(null);

// A real calendar day 'YYYY-MM-DD'.
const day = (label) => Joi.string().pattern(DATE_PATTERN).custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : helpers.error('any.invalid');
}).label(label).messages({ 'string.pattern.base': `${label} is not a valid date`, 'any.invalid': `${label} is not a valid date` });

// startDate empty = today (set by the service); endDate empty = no end.
const dates = {
    startDate: optionalText(day('Start date')),
    endDate: optionalText(day('End date'))
};

const details = {
    name: Joi.string().trim().min(USER_NAME_MIN_LENGTH).max(USER_NAME_MAX_LENGTH).required().label('Name'),
    username: Joi.string().trim().lowercase().max(USERNAME_MAX_LENGTH).pattern(USERNAME_PATTERN).required().label('Login username')
        .messages({ 'string.pattern.base': 'Login username must be 3-30 characters: letters, numbers, dot, dash or underscore, starting with a letter' }),
    email: optionalText(Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(EMAIL_MAX_LENGTH).label('Email')),
    phone: optionalText(Joi.string().trim().pattern(PHONE_PATTERN).label('Phone')
        .messages({ 'string.pattern.base': 'Phone must be 10 to 13 digits, optionally starting with +' })),
    address: optionalText(Joi.string().trim().max(ADDRESS_MAX_LENGTH).label('Address'))
};

const access = {
    roles: Joi.array().items(Joi.object({
        roleId: objectId('Role'),
        ...dates
    })).unique('roleId').default([]).label('Roles')
        .messages({ 'array.unique': 'Each role can be given only once' }),
    extraModules: Joi.array().items(Joi.object({
        module: Joi.string().valid(...MODULE_KEYS).required().label('Module'),
        permission: Joi.string().valid(...PERMISSION_VALUES).required().label('Permission'),
        ...dates
    })).unique((a, b) => a.module === b.module && a.permission === b.permission).default([]).label('Extra access')
        .messages({ 'array.unique': 'Each option of a module can be given only once' }),
    extraMasters: Joi.array().items(Joi.object({
        masterId: objectId('Master'),
        isWholeMaster: Joi.boolean().default(false).label('Whole master'),
        valueIds: Joi.array().items(objectId('Value').optional()).unique().default([]).label('Values'),
        ...dates
    })).unique('masterId').default([]).label('Extra masters')
        .messages({ 'array.unique': 'Each master can be added only once' }),
    // Taken away from what the user's roles give.
    revokedModules: Joi.array().items(Joi.object({
        module: Joi.string().valid(...MODULE_KEYS).required().label('Module'),
        permission: Joi.string().valid(...PERMISSION_VALUES).required().label('Permission')
    })).unique((a, b) => a.module === b.module && a.permission === b.permission).default([]).label('Access taken away'),
    revokedMasters: Joi.array().items(Joi.object({
        masterId: objectId('Master'),
        isWholeMaster: Joi.boolean().default(false).label('Whole master'),
        valueIds: Joi.array().items(objectId('Value').optional()).unique().default([]).label('Values')
    })).unique('masterId').default([]).label('Master values taken away')
};

const password = Joi.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).label('Password');

const userIdParamSchema = Joi.object({
    id: objectId('User id')
});

// GET /api/users
const listUsersQuerySchema = Joi.object({
    search: Joi.string().trim().max(EMAIL_MAX_LENGTH).allow('').default('').label('Search'),
    status: Joi.string().valid('A', 'I').label('Status'),
    roleId: Joi.string().hex().length(24).label('Role'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(USER_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// POST /api/users
const createUserSchema = Joi.object({
    ...details,
    password: password.required(),
    ...access
});

// PUT /api/users/:id - password empty = unchanged.
const updateUserSchema = Joi.object({
    ...details,
    password: optionalText(password),
    ...access
});

// PATCH /api/users/:id/status
const statusSchema = Joi.object({
    isActive: Joi.boolean().required().label('isActive')
});

// POST /api/users/bulk
const bulkUsersSchema = Joi.object({
    action: Joi.string().valid('activate', 'deactivate', 'delete').required().label('Action'),
    ids: Joi.array().items(objectId('User id').optional()).min(1).max(USER_LIST_MAX_PAGE_SIZE).unique().required().label('Users')
});

module.exports = {
    userIdParamSchema,
    listUsersQuerySchema,
    createUserSchema,
    updateUserSchema,
    statusSchema,
    bulkUsersSchema
};
