import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import UsersListPage from './UsersListPage';
import UserFormPage from './UserFormPage';

/**
 * The Users section: the list (/users), details (/users/:id, read only), or the create (/users/new) / edit
 * (/users/:id/edit) screen.
 *
 * @param {Object} props
 * @param {string} props.basePath - '/users'
 * @param {string[]} props.segments - The address after it
 */
const UsersPage = ({ basePath, segments }) => {
  const toast = useToast();
  const { navigate } = useRouter();
  const { can } = useAccess();
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <UsersListPage
        onCreate={() => navigate(`${basePath}/new`)}
        onView={(id) => navigate(`${basePath}/${id}`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
      />
    );
  }

  return (
    <UserFormPage
      // A fresh form for every user / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      // Details: the edit form, read only.
      mode={screen.mode === 'view' ? 'edit' : screen.mode}
      readOnly={screen.mode === 'view'}
      onEdit={can('users', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
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
