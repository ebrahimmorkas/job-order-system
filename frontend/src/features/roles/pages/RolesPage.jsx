import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import RolesListPage from './RolesListPage';
import RoleFormPage from './RoleFormPage';

/**
 * The Role Master section: the list, or the create / copy / edit screen.
 * (No router yet - the screen shown is kept here.)
 */
const RolesPage = () => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create' } | { mode: 'edit' | 'clone', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  const backToList = () => setScreen({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <RolesListPage
        onCreate={() => setScreen({ mode: 'create' })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
        onClone={(id) => setScreen({ mode: 'clone', id })}
      />
    );
  }

  return (
    <RoleFormPage
      // A fresh form for every role / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      roleId={screen.id}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default RolesPage;
