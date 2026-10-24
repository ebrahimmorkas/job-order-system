import Card from '../../../components/common/Card';
import Button from '../../../components/common/Buttons';
import { useAuth } from '../../auth/hooks/useAuth';
import { useBranding } from '../../branding/hooks/useBranding';
import { useAccess } from '../../access/hooks/useAccess';

/**
 * The first screen after login. A welcome only for now - job order
 * summaries are added here as those modules are built. A user who is given
 * work is pointed to "My work".
 *
 * @param {Object} props
 * @param {(key: string) => void} [props.onNavigate] - Opens another menu item
 */
const DashboardPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const { access } = useAccess();
  const displayName = user?.name || user?.username;
  const hasWork = !access.isOwner && access.hasWork;
  const hasNothing = !access.isOwner && !access.hasWork && Object.keys(access.modules).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {branding.companyName && <p className="mt-1 text-sm text-gray-500">{branding.companyName}</p>}
      </div>
      <Card variant="outlined">
        <p className="text-lg font-semibold text-gray-900">Welcome back{displayName ? `, ${displayName}` : ''}</p>
        {hasWork && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-500">The job orders you are given work on are in My work.</p>
            {onNavigate && <Button size="sm" onClick={() => onNavigate('myWork')}>Open My work</Button>}
          </div>
        )}
        {hasNothing && <p className="mt-1 text-sm text-gray-500">You have no access yet. Please ask the owner to give you a role.</p>}
        {!hasWork && !hasNothing && <p className="mt-1 text-sm text-gray-500">Your job order summary will appear here.</p>}
      </Card>
    </div>
  );
};

export default DashboardPage;
