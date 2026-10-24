import { lazy, Suspense } from 'react';
import { useToast } from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import JobOrdersListPage from './JobOrdersListPage';
import JobOrderFormPage from './JobOrderFormPage';
import JobOrderViewPage from './JobOrderViewPage';
import { useAccess } from '../../access/hooks/useAccess';

// Printing brings the layout drawing and the PDF / image export - loaded only
// when a job order is printed.
const JobOrderPrintPage = lazy(() => import('./JobOrderPrintPage'));

/**
 * The Job Orders section: the list (/job-orders), a job order's view
 * (/job-orders/:id) or print screen (/job-orders/:id/print), or the create
 * (/job-orders/new) / edit (/job-orders/:id/edit) screen.
 *
 * @param {Object} props
 * @param {Object<string, boolean>|null} props.featureAccess - Printing needs Layout Master
 * @param {string} props.basePath - '/job-orders'
 * @param {string[]} props.segments - The address after it
 */
const JobOrdersPage = ({ featureAccess, basePath, segments }) => {
  const toast = useToast();
  const { can } = useAccess();
  const { navigate } = useRouter();
  const canPrint = featureAccess?.isLayoutMasterFeatureOn !== false;
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit', ...(canPrint ? { print: 'print' } : {}) } });

  const backToList = () => navigate(basePath);
  const openView = (id) => navigate(`${basePath}/${id}`);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <JobOrdersListPage
        onCreate={() => navigate(`${basePath}/new`)}
        onView={openView}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
      />
    );
  }

  if (screen.mode === 'view') {
    return (
      <JobOrderViewPage
        key={screen.id}
        jobOrderId={screen.id}
        onBack={backToList}
        onEdit={can('jobOrders', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
        onPrint={canPrint ? () => navigate(`${basePath}/${screen.id}/print`) : null}
      />
    );
  }

  if (screen.mode === 'print') {
    return (
      <Suspense fallback={<div className="py-24 flex justify-center"><Spinner size="lg" /></div>}>
        <JobOrderPrintPage key={screen.id} jobOrderId={screen.id} onBack={() => openView(screen.id)} />
      </Suspense>
    );
  }

  return (
    <JobOrderFormPage
      // A fresh form for every job order / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      jobOrderId={screen.id}
      onBack={backToList}
      onDone={(message, id) => {
        toast.success(message);
        // In place of the form, so Back doesn't open it again.
        navigate(`${basePath}/${id}`, { replace: true });
      }}
    />
  );
};

export default JobOrdersPage;
