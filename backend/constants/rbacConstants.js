const { FEATURE_FLAGS } = require('./featureConstants');

// Role Master (models/Role.js). Shared by the model, the Joi validations and
// the service so they can never disagree.
const ROLE_NAME_MIN_LENGTH = 2;
const ROLE_NAME_MAX_LENGTH = 50;
const ROLE_LIST_MAX_PAGE_SIZE = 100;

// A role is one kind, chosen when it is created:
//   module - what a user may do in each module (view / create / edit / delete)
//   master - which master values a user works on (e.g. only "Round cutting"),
//            view only
const ROLE_TYPES = {
    MODULE: 'module',
    MASTER: 'master'
};
const ROLE_TYPE_VALUES = Object.values(ROLE_TYPES);

const PERMISSIONS = {
    VIEW: 'view',
    CREATE: 'create',
    EDIT: 'edit',
    DELETE: 'delete',
    // Users only: may give a role to a user.
    ASSIGN_ROLE: 'assignRole'
};
const PERMISSION_VALUES = Object.values(PERMISSIONS);
const CRUD = [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.DELETE];

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

module.exports = {
    ROLE_NAME_MIN_LENGTH,
    ROLE_NAME_MAX_LENGTH,
    ROLE_LIST_MAX_PAGE_SIZE,
    ROLE_TYPES,
    ROLE_TYPE_VALUES,
    PERMISSIONS,
    PERMISSION_VALUES,
    MODULES,
    MODULE_KEYS
};
