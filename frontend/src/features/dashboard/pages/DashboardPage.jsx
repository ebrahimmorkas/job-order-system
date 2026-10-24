import Card from '../../../components/common/Card';
import { useAuth } from '../../auth/hooks/useAuth';
import { useBranding } from '../../branding/hooks/useBranding';
import { useAccess } from '../../access/hooks/useAccess';
import OwnerDashboard from '../components/OwnerDashboard';
import WorkerDashboard from '../components/WorkerDashboard';

/**
 * The first screen after login. The owner - and a user whose roles give
 * Dashboard - sees the whole vendor's work; a user given work sees their
 * own; anyone else a welcome.
 */
const DashboardPage = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const { access, can } = useAccess();
  const displayName = user?.name || user?.username;
  const seesAll = access.isOwner || can('dashboard', 'view');
  const hasWork = !seesAll && access.hasWork;
  const hasNothing = !seesAll && !access.hasWork && Object.keys(access.modules).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back{displayName ? `, ${displayName}` : ''}{branding.companyName ? ` · ${branding.companyName}` : ''}
        </p>
      </div>
      {seesAll && <OwnerDashboard />}
      {hasWork && <WorkerDashboard />}
      {!seesAll && !hasWork && (
        <Card variant="outlined">
          <p className="text-sm text-gray-500">
            {hasNothing ? 'You have no access yet. Please ask the owner to give you a role.' : 'Use the menu to open what your role gives you.'}
          </p>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
