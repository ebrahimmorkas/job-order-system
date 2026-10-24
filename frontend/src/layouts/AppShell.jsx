import { Suspense, useEffect, useMemo } from 'react';
import Sidebar, { DEFAULT_NAV_ITEMS, filterNavItemsByFeatureAccess, filterNavItemsByAccess } from '../components/ui/Sidebar';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';
import { NotFoundPage, PageLoadBoundary } from '../components/errors';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useBranding } from '../features/branding/hooks/useBranding';
import { useConfirmLeave } from '../components/common/UnsavedChanges';
import { useFeatureAccess } from '../features/featureAccess/hooks/useFeatureAccess';
import { useAccess } from '../features/access/hooks/useAccess';
import { useRouter, segmentsOf } from '../router';
import { lazyPage } from '../utils/lazyPage';
import ShopClosedBanner from '../features/serviceStatus/components/ShopClosedBanner';
import NotificationBell from '../features/notifications/components/NotificationBell';

// Sidebar key -> page, each loaded the first time it is opened (so the app's
// first load stays small). Keys without a page yet show a placeholder.
const PAGES = {
  dashboard: lazyPage(() => import('../features/dashboard/pages/DashboardPage')),
  myWork: lazyPage(() => import('../features/myWork/pages/MyWorkPage')),
  jobOrders: lazyPage(() => import('../features/jobOrders/pages/JobOrdersPage')),
  masters: lazyPage(() => import('../features/masters/pages/MastersPage')),
  controls: lazyPage(() => import('../features/controls/pages/ControlsPage')),
  users: lazyPage(() => import('../features/users/pages/UsersPage')),
  roles: lazyPage(() => import('../features/roles/pages/RolesPage')),
  layouts: lazyPage(() => import('../features/layouts/pages/LayoutsPage')),
  companySettings: lazyPage(() => import('../features/companySettings/pages/CompanySettingsPage')),
};

/**
 * The logged-in layout: the sidebar (company name + logo from branding, the
 * user and logout) and, beside it, the page of the address - its first part
 * picks the section (/users), the rest the section's screen (/users/123/edit).
 */
const AppShell = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const featureAccess = useFeatureAccess();
  const { access, can } = useAccess();
  const { pathname, navigate } = useRouter();
  // Leaving a page with unsaved changes (menu, logout) asks first.
  const confirmLeave = useConfirmLeave();
  // Menu items of switched-off features, and those the person can't open, are hidden.
  const navItems = useMemo(
    () => filterNavItemsByAccess(filterNavItemsByFeatureAccess(DEFAULT_NAV_ITEMS, featureAccess), access, can),
    [featureAccess, access, can]
  );

  const [first = '', ...segments] = segmentsOf(pathname);
  const section = DEFAULT_NAV_ITEMS.find((item) => item.path === `/${first}`);
  // A section the person can't open (or no longer can) goes to the dashboard.
  const isAllowed = !!section && navItems.some((item) => item.key === section.key);
  const isUnknown = !section || (section.key === 'dashboard' && segments.length > 0);

  useEffect(() => {
    if (!isUnknown && !isAllowed) navigate('/', { replace: true });
  }, [isUnknown, isAllowed, navigate]);

  const goHome = () => navigate('/');
  const Page = isAllowed && !isUnknown ? PAGES[section.key] : null;

  const renderPage = () => {
    if (isUnknown) return <NotFoundPage embedded onGoHome={goHome} />;
    if (!isAllowed) return null;
    if (!Page) return <EmptyState title={section.label} description="This section is coming soon." />;
    return <Page featureAccess={featureAccess} basePath={section.path} segments={segments} />;
  };

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Sidebar
        brand={branding.companyName || ''}
        logoUrl={branding.logoUrl}
        items={navItems}
        activeKey={isAllowed ? section.key : null}
        onNavigate={(key) => confirmLeave(() => navigate(DEFAULT_NAV_ITEMS.find((item) => item.key === key).path))}
        user={user}
        // The next person to log in starts on the dashboard.
        onLogout={() => confirmLeave(() => {
          navigate('/', { replace: true });
          logout();
        })}
      />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="-mt-2 mb-2 flex justify-end">
          <NotificationBell />
        </div>
        {access.isOwner && <ShopClosedBanner />}
        <PageLoadBoundary key={section?.key}>
          <Suspense fallback={<div className="py-24 flex justify-center"><Spinner size="lg" /></div>}>
            {renderPage()}
          </Suspense>
        </PageLoadBoundary>
      </main>
    </div>
  );
};

export default AppShell;
