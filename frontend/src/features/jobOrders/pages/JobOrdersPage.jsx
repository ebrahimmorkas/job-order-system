import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import JobOrdersListPage from './JobOrdersListPage';
import JobOrderFormPage from './JobOrderFormPage';
import JobOrderViewPage from './JobOrderViewPage';

/**
 * The Job Orders section: the list, a job order's view, or the create /
 * edit screen. (No router yet - the screen shown is kept here.)
 */
const JobOrdersPage = () => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create' } | { mode: 'edit' | 'view', id }
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
      />
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
        setScreen({ mode: 'view', id });
      }}
    />
  );
};

export default JobOrdersPage;
