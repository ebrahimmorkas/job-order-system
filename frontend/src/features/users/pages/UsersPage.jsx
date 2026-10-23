import { useState } from 'react';
import { useToast } from '../../../components/common/Toast';
import UsersListPage from './UsersListPage';
import UserFormPage from './UserFormPage';

/**
 * The Users section: the list, or the create / edit screen.
 * (No router yet - the screen shown is kept here.)
 */
const UsersPage = () => {
  const toast = useToast();
  // { mode: 'list' } | { mode: 'create' } | { mode: 'edit', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  const backToList = () => setScreen({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <UsersListPage
        onCreate={() => setScreen({ mode: 'create' })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
      />
    );
  }

  return (
    <UserFormPage
      // A fresh form for every user / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      userId={screen.id}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default UsersPage;
