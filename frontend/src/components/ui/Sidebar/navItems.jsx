import { DashboardIcon, MyWorkIcon, JobOrdersIcon, CustomersIcon, MastersIcon, ControlsIcon, UsersIcon, RolesIcon, LayoutsIcon, CompanySettingsIcon } from './icons';

// The sidebar's default menu. Add each new module here as it is built.
// path is the section's address; its screens add to it (e.g. /users/new).
// featureFlag (optional) names a feature that must be on - see
// filterNavItemsByFeatureAccess below. Who sees an item - see
// filterNavItemsByAccess below:
//   module    - a Role Master module: needs its View permission
//   ownerOnly - the owner only
//   workOnly  - a user who is given work (master roles)
export const DEFAULT_NAV_ITEMS = [
  { key: 'dashboard', path: '/', label: 'Dashboard', icon: DashboardIcon },
  { key: 'myWork', path: '/my-work', label: 'My work', icon: MyWorkIcon, workOnly: true },
  { key: 'jobOrders', path: '/job-orders', label: 'Job Orders', icon: JobOrdersIcon, module: 'jobOrders' },
  { key: 'customers', path: '/customers', label: 'Customers', icon: CustomersIcon, featureFlag: 'isCustomersFeatureOn', module: 'customers' },
  { key: 'masters', path: '/masters', label: 'Masters', icon: MastersIcon, featureFlag: 'isMasterModuleFeatureOn', module: 'masters' },
  { key: 'controls', path: '/controls', label: 'Controls', icon: ControlsIcon, featureFlag: 'isControlsFeatureOn', module: 'controls' },
  { key: 'users', path: '/users', label: 'Users', icon: UsersIcon, featureFlag: 'isRBACFeatureOn', module: 'users' },
  { key: 'roles', path: '/roles', label: 'Role Master', icon: RolesIcon, featureFlag: 'isRBACFeatureOn', module: 'roles' },
  { key: 'layouts', path: '/layouts', label: 'Layout Master', icon: LayoutsIcon, featureFlag: 'isLayoutMasterFeatureOn', ownerOnly: true },
  { key: 'companySettings', path: '/company-settings', label: 'Company Settings', icon: CompanySettingsIcon, module: 'companySettings' },
];

/**
 * Hides what the logged-in person can't open (see useAccess).
 *
 * @param {Array} items
 * @param {{ isOwner: boolean, hasWork: boolean }} access
 * @param {(module: string, permission: string) => boolean} can
 */
export const filterNavItemsByAccess = (items, access, can) =>
  items.filter((item) => {
    if (item.workOnly) return !access.isOwner && access.hasWork;
    if (item.ownerOnly) return access.isOwner;
    return !item.module || can(item.module, 'view');
  });

/**
 * Hides the items whose featureFlag is switched off for this vendor (off in
 * WebsiteMaster or in the vendor's CompanyMaster). `featureAccess` null means
 * still loading, or the lookup failed: show everything rather than an empty
 * sidebar - the backend refuses a switched-off feature anyway.
 *
 * @param {Array} items
 * @param {Object<string, boolean>|null} featureAccess - { [featureFlag]: isOn }
 */
export const filterNavItemsByFeatureAccess = (items, featureAccess) => {
  if (!featureAccess) return items;
  return items.filter((item) => !item.featureFlag || featureAccess[item.featureFlag] !== false);
};
