import Card from '../../../components/common/Card';
import { useAuth } from '../../auth/hooks/useAuth';
import { useBranding } from '../../branding/hooks/useBranding';

/**
 * The first screen after login. A welcome only for now - job order
 * summaries are added here as those modules are built.
 */
const DashboardPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const displayName = user?.name || user?.username;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {branding.companyName && <p className="mt-1 text-sm text-gray-500">{branding.companyName}</p>}
      </div>
      <Card variant="outlined">
        <p className="text-lg font-semibold text-gray-900">Welcome back{displayName ? `, ${displayName}` : ''}</p>
        <p className="mt-1 text-sm text-gray-500">Your job order summary will appear here.</p>
      </Card>
    </div>
  );
};

export default DashboardPage;
