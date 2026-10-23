import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import JobOrdersListPage from './JobOrdersListPage';
import JobOrderFormPage from './JobOrderFormPage';
import JobOrderViewPage from './JobOrderViewPage';
import JobOrderPrintPage from './JobOrderPrintPage';

/**
 * The Job Orders section: the list, a job order's view or print screen, or the
 * create / edit screen. (No router yet - the screen shown is kept here.)
 *
 * @param {Object} props
 * @param {Object<string, boolean>|null} props.featureAccess - Printing needs Layout Master
 */
const JobOrdersPage = ({ featureAccess }) => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create' } | { mode: 'edit' | 'view' | 'print', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  const backToList = () => setScreen({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <JobOrdersListPage
        onCreate={() => setScreen({ mode: 'create' })}
        onView={(id) => setScreen({ mode: 'view', id })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
      />
    );
  }

  if (screen.mode === 'view') {
    return (
      <JobOrderViewPage
        key={screen.id}
        jobOrderId={screen.id}
        onBack={backToList}
        onEdit={() => setScreen({ mode: 'edit', id: screen.id })}
        onPrint={featureAccess?.isLayoutMasterFeatureOn === false ? null : () => setScreen({ mode: 'print', id: screen.id })}
      />
    );
  }

  if (screen.mode === 'print') {
    return <JobOrderPrintPage key={screen.id} jobOrderId={screen.id} onBack={() => setScreen({ mode: 'view', id: screen.id })} />;
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
        setScreen({ mode: 'view', id });
      }}
    />
  );
};

export default JobOrdersPage;
