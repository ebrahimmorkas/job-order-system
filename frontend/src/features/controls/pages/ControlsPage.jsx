import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import ControlsListPage from './ControlsListPage';
import ControlFormPage from './ControlFormPage';

/**
 * The Controls section: the list (/controls), details (/controls/:id, read only), or the create (/controls/new),
 * copy (/controls/:id/copy) or edit (/controls/:id/edit) screen.
 *
 * @param {Object} props
 * @param {string} props.basePath - '/controls'
 * @param {string[]} props.segments - The address after it
 */
const ControlsPage = ({ basePath, segments }) => {
  const toast = useToast();
  const { navigate, state } = useRouter();
  const { can } = useAccess();
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit', copy: 'clone' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <ControlsListPage
        // The list already knows the limits; opened straight from the address the form asks itself.
        onCreate={(limits) => navigate(`${basePath}/new`, { state: { limits } })}
        onView={(id) => navigate(`${basePath}/${id}`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
      />
    );
  }

  return (
    <ControlFormPage
      // A fresh form for every control / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      // Details: the edit form, read only.
      mode={screen.mode === 'view' ? 'edit' : screen.mode}
      readOnly={screen.mode === 'view'}
      onEdit={can('controls', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
      controlId={screen.id}
      limits={state?.limits ?? null}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default ControlsPage;
