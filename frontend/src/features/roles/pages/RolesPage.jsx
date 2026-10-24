import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import RolesListPage from './RolesListPage';
import RoleFormPage from './RoleFormPage';

/**
 * The Role Master section: the list (/roles), or the create (/roles/new),
 * copy (/roles/:id/copy) or edit (/roles/:id/edit) screen.
 *
 * @param {Object} props
 * @param {string} props.basePath - '/roles'
 * @param {string[]} props.segments - The address after it
 */
const RolesPage = ({ basePath, segments }) => {
  const toast = useToast();
  const { navigate } = useRouter();
  const screen = screenOf(segments, { actions: { edit: 'edit', copy: 'clone' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <RolesListPage
        onCreate={() => navigate(`${basePath}/new`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
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
