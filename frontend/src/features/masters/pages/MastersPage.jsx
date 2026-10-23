import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import MastersListPage from './MastersListPage';
import MasterFormPage from './MasterFormPage';

/**
 * The Masters section: the list, or the create / copy / edit screen.
 * (No router yet - the screen shown is kept here.)
 */
const MastersPage = ({ featureAccess }) => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create', valuesAllowed } | { mode: 'edit' | 'clone', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  const backToList = () => setScreen({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <MastersListPage
        onCreate={(limits) => setScreen({ mode: 'create', valuesAllowed: limits?.valuesAllowedPerMaster ?? null })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
        onClone={(id) => setScreen({ mode: 'clone', id })}
      />
    );
  }

  return (
    <MasterFormPage
      // A fresh form for every master / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      masterId={screen.id}
      valuesAllowed={screen.valuesAllowed}
      featureAccess={featureAccess}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default MastersPage;
