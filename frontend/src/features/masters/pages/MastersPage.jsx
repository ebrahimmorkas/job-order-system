import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import MastersListPage from './MastersListPage';
import MasterFormPage from './MasterFormPage';

/**
 * The Masters section: the list (/masters), details (/masters/:id, read only), or the create (/masters/new),
 * copy (/masters/:id/copy) or edit (/masters/:id/edit) screen.
 *
 * @param {Object} props
 * @param {Object<string, boolean>|null} props.featureAccess
 * @param {string} props.basePath - '/masters'
 * @param {string[]} props.segments - The address after it
 */
const MastersPage = ({ featureAccess, basePath, segments }) => {
  const toast = useToast();
  const { navigate, state } = useRouter();
  const { can } = useAccess();
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit', copy: 'clone' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <MastersListPage
        // The list already knows the limit; opened straight from the address the form asks itself.
        onCreate={(limits) => navigate(`${basePath}/new`, { state: { valuesAllowed: limits?.valuesAllowedPerMaster ?? null } })}
        onView={(id) => navigate(`${basePath}/${id}`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
      />
    );
  }

  return (
    <MasterFormPage
      // A fresh form for every master / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      // Details: the edit form, read only.
      mode={screen.mode === 'view' ? 'edit' : screen.mode}
      readOnly={screen.mode === 'view'}
      onEdit={can('masters', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
      masterId={screen.id}
      valuesAllowed={state && Object.hasOwn(state, 'valuesAllowed') ? state.valuesAllowed : undefined}
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
