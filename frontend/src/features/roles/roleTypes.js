// Same keys as the backend (constants/rbacConstants.js).

export const ROLE_TYPES = {
  module: {
    label: 'Module role',
    description: 'Gives access to modules - view, details, create, edit, delete - picked per module.',
  },
  master: {
    label: 'Master role',
    description: 'Gives view of whole masters or some of their values, e.g. only "Round cutting".',
  },
};

// The columns of the permissions table, in order.
export const PERMISSIONS = [
  { key: 'view', label: 'View' },
  { key: 'details', label: 'Details' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'assignRole', label: 'Role assignment' },
];

// Module names for the list (the form gets them from the server).
export const MODULE_LABELS = {
  dashboard: 'Dashboard',
  jobOrders: 'Job Orders',
  masters: 'Masters',
  controls: 'Controls',
  users: 'Users',
  roles: 'Role Master',
  companySettings: 'Company Settings',
};
