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
  customers: 'Customers',
  masters: 'Masters',
  controls: 'Controls',
  users: 'Users',
  roles: 'Role Master',
  companySettings: 'Company Settings',
};

// What comes with a permission (same as the backend's IMPLIED_PERMISSIONS):
// Edit gives Details - you can't edit what you can't open.
export const IMPLIED = { edit: ['details'] };

/** permission plus what comes with it (View always). */
export const withImplied = (permission) => ['view', permission, ...(IMPLIED[permission] || [])];

// Giving anything also gives view (and Edit gives Details); taking view away
// takes everything away, and taking Details away takes Edit with it.
// allowed: the module's own permissions (Company Settings has no Details).
export const togglePermission = (permissions, permission, isOn, allowed) => {
  if (!isOn) {
    if (permission === 'view') return [];
    const needing = Object.keys(IMPLIED).filter((key) => IMPLIED[key].includes(permission));
    return permissions.filter((p) => p !== permission && !needing.includes(p));
  }
  const next = new Set([...permissions, ...withImplied(permission)]);
  return PERMISSIONS.map((p) => p.key).filter((p) => next.has(p) && allowed.includes(p));
};
