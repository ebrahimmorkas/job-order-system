import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import ControlsListPage from './ControlsListPage';
import ControlFormPage from './ControlFormPage';

/**
 * The Controls section: the list, or the create / copy / edit screen.
 * (No router yet - the screen shown is kept here.)
 */
const ControlsPage = () => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create', limits } | { mode: 'edit' | 'clone', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  const backToList = () => setScreen({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <ControlsListPage
        onCreate={(limits) => setScreen({ mode: 'create', limits })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
        onClone={(id) => setScreen({ mode: 'clone', id })}
      />
    );
  }

  return (
    <ControlFormPage
      // A fresh form for every control / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      controlId={screen.id}
      limits={screen.limits}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default ControlsPage;
