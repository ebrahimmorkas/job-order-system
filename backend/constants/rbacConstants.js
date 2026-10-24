const { FEATURE_FLAGS } = require('./featureConstants');

// Role Master (models/Role.js). Shared by the model, the Joi validations and
// the service so they can never disagree.
const ROLE_NAME_MIN_LENGTH = 2;
const ROLE_NAME_MAX_LENGTH = 50;
const ROLE_LIST_MAX_PAGE_SIZE = 100;

// A role is one kind, chosen when it is created:
//   module - what a user may do in each module (view / details / create /
//            edit / delete)
//   master - which master values a user works on (e.g. only "Round cutting"),
//            view only
const ROLE_TYPES = {
    MODULE: 'module',
    MASTER: 'master'
};
const ROLE_TYPE_VALUES = Object.values(ROLE_TYPES);

const PERMISSIONS = {
    // The list only.
    VIEW: 'view',
    // Opening one record to read it (a job order's view, a master's form
    // read only...).
    DETAILS: 'details',
    CREATE: 'create',
    EDIT: 'edit',
    DELETE: 'delete',
    // Users only: may give a role to a user.
    ASSIGN_ROLE: 'assignRole'
};
const PERMISSION_VALUES = Object.values(PERMISSIONS);
const CRUD = [PERMISSIONS.VIEW, PERMISSIONS.DETAILS, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.DELETE];

// Permissions that come with another one: anything gives View, and Edit
// gives Details (you can't edit what you can't open). Roles saved before
// Details existed keep working the same way for Edit.
const IMPLIED_PERMISSIONS = {
    [PERMISSIONS.EDIT]: [PERMISSIONS.DETAILS]
};

/** permission plus what comes with it (View always). */
const withImpliedPermissions = (permission) => [PERMISSIONS.VIEW, permission, ...(IMPLIED_PERMISSIONS[permission] || [])];

// The modules a module role can cover, in the order the form lists them,
// with the permissions each one has. featureFlag: offered only while that
// feature is on for the vendor (see roleService.availableModulesOf).
const MODULES = {
    jobOrders: { label: 'Job Orders', permissions: CRUD },
    masters: { label: 'Masters', permissions: CRUD, featureFlag: FEATURE_FLAGS.MASTER_MODULE },
    controls: { label: 'Controls', permissions: CRUD, featureFlag: FEATURE_FLAGS.CONTROLS },
    users: { label: 'Users', permissions: [...CRUD, PERMISSIONS.ASSIGN_ROLE], featureFlag: FEATURE_FLAGS.RBAC },
    roles: { label: 'Role Master', permissions: CRUD, featureFlag: FEATURE_FLAGS.RBAC },
    companySettings: { label: 'Company Settings', permissions: [PERMISSIONS.VIEW, PERMISSIONS.EDIT] }
};
const MODULE_KEYS = Object.keys(MODULES);

// Users (models/User.js, role 'user'). Dates are calendar days 'YYYY-MM-DD';
// a role or extra access works from startDate to endDate, both included
// (endDate null = no end).
const USER_NAME_MIN_LENGTH = 2;
const USER_NAME_MAX_LENGTH = 50;
// Starts with a letter, so it never looks like a phone number or an email
// (login takes any of the three).
const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,29}$/;
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 100;
const PHONE_PATTERN = /^\+?\d{10,13}$/;
const ADDRESS_MAX_LENGTH = 300;
const USER_LIST_MAX_PAGE_SIZE = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
    ROLE_NAME_MIN_LENGTH,
    ROLE_NAME_MAX_LENGTH,
    ROLE_LIST_MAX_PAGE_SIZE,
    ROLE_TYPES,
    ROLE_TYPE_VALUES,
    PERMISSIONS,
    PERMISSION_VALUES,
    IMPLIED_PERMISSIONS,
    withImpliedPermissions,
    MODULES,
    MODULE_KEYS,
    USER_NAME_MIN_LENGTH,
    USER_NAME_MAX_LENGTH,
    USERNAME_PATTERN,
    USERNAME_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    PHONE_PATTERN,
    ADDRESS_MAX_LENGTH,
    USER_LIST_MAX_PAGE_SIZE,
    DATE_PATTERN
};
