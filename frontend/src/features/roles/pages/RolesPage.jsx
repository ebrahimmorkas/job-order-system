import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import RolesListPage from './RolesListPage';
import RoleFormPage from './RoleFormPage';

/**
 * The Role Master section: the list (/roles), details (/roles/:id, read only), or the create (/roles/new),
 * copy (/roles/:id/copy) or edit (/roles/:id/edit) screen.
 *
 * @param {Object} props
 * @param {string} props.basePath - '/roles'
 * @param {string[]} props.segments - The address after it
 */
const RolesPage = ({ basePath, segments }) => {
  const toast = useToast();
  const { navigate } = useRouter();
  const { can } = useAccess();
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit', copy: 'clone' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <RolesListPage
        onCreate={() => navigate(`${basePath}/new`)}
        onView={(id) => navigate(`${basePath}/${id}`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
      />
    );
  }

  return (
    <RoleFormPage
      // A fresh form for every role / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      // Details: the edit form, read only.
      mode={screen.mode === 'view' ? 'edit' : screen.mode}
      readOnly={screen.mode === 'view'}
      onEdit={can('roles', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
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
