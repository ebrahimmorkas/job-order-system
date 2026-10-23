import { useMemo, useState } from 'react';
import Sidebar, { DEFAULT_NAV_ITEMS, filterNavItemsByFeatureAccess } from '../components/ui/Sidebar';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useBranding } from '../features/branding/hooks/useBranding';
import { useConfirmLeave } from '../components/common/UnsavedChanges';
import { useFeatureAccess } from '../features/featureAccess/hooks/useFeatureAccess';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import MastersPage from '../features/masters/pages/MastersPage';
import ControlsPage from '../features/controls/pages/ControlsPage';
import CompanySettingsPage from '../features/companySettings/pages/CompanySettingsPage';
import JobOrdersPage from '../features/jobOrders/pages/JobOrdersPage';
import RolesPage from '../features/roles/pages/RolesPage';

// Sidebar key -> page. Keys without a page yet show a placeholder.
const PAGES = {
  dashboard: DashboardPage,
  jobOrders: JobOrdersPage,
  masters: MastersPage,
  controls: ControlsPage,
  roles: RolesPage,
  companySettings: CompanySettingsPage,
};

/**
 * The logged-in layout: the sidebar (company name + logo from branding, the
 * user and logout) and the selected page beside it.
 */
const AppShell = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const featureAccess = useFeatureAccess();
  // Leaving a page with unsaved changes (menu, logout) asks first.
  const confirmLeave = useConfirmLeave();
  const [activeKey, setActiveKey] = useState('dashboard');
  // Menu items of switched-off features are hidden.
  const navItems = useMemo(() => filterNavItemsByFeatureAccess(DEFAULT_NAV_ITEMS, featureAccess), [featureAccess]);

  const Page = PAGES[activeKey];
  const activeLabel = navItems.find((item) => item.key === activeKey)?.label;

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Sidebar
        brand={branding.companyName || ''}
        logoUrl={branding.logoUrl}
        items={navItems}
        activeKey={activeKey}
        onNavigate={(key) => confirmLeave(() => setActiveKey(key))}
        user={user}
        onLogout={() => confirmLeave(logout)}
      />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        {Page ? <Page featureAccess={featureAccess} /> : <EmptyState title={activeLabel} description="This section is coming soon." />}
      </main>
    </div>
  );
};

export default AppShell;
