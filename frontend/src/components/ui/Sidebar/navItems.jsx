import { DashboardIcon, JobOrdersIcon, MastersIcon, ControlsIcon, UsersIcon, RolesIcon, CompanySettingsIcon } from './icons';

// The sidebar's default menu. Add each new module here as it is built.
// featureFlag (optional) names a feature that must be on - see
// filterNavItemsByFeatureAccess below.
export const DEFAULT_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { key: 'jobOrders', label: 'Job Orders', icon: JobOrdersIcon },
  { key: 'masters', label: 'Masters', icon: MastersIcon, featureFlag: 'isMasterModuleFeatureOn' },
  { key: 'controls', label: 'Controls', icon: ControlsIcon, featureFlag: 'isControlsFeatureOn' },
  { key: 'users', label: 'Users', icon: UsersIcon, featureFlag: 'isRBACFeatureOn' },
  { key: 'roles', label: 'Role Master', icon: RolesIcon, featureFlag: 'isRBACFeatureOn' },
  { key: 'companySettings', label: 'Company Settings', icon: CompanySettingsIcon },
];

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
