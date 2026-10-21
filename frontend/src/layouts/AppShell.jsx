import { useState } from 'react';
import Sidebar, { DEFAULT_NAV_ITEMS } from '../components/ui/Sidebar';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useBranding } from '../features/branding/hooks/useBranding';
import DashboardPage from '../features/dashboard/pages/DashboardPage';

// Sidebar key -> page. Keys without a page yet show a placeholder.
const PAGES = {
  dashboard: DashboardPage,
};

/**
 * The logged-in layout: the sidebar (company name + logo from branding, the
 * user and logout) and the selected page beside it.
 */
const AppShell = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const [activeKey, setActiveKey] = useState('dashboard');

  const Page = PAGES[activeKey];
  const activeLabel = DEFAULT_NAV_ITEMS.find((item) => item.key === activeKey)?.label;

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Sidebar
        brand={branding.companyName || ''}
        logoUrl={branding.logoUrl}
        activeKey={activeKey}
        onNavigate={setActiveKey}
        user={user}
        onLogout={logout}
      />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        {Page ? <Page /> : <EmptyState title={activeLabel} description="This section is coming soon." />}
      </main>
    </div>
  );
};

export default AppShell;
