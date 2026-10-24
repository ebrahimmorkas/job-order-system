import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import MastersListPage from './MastersListPage';
import MasterFormPage from './MasterFormPage';

/**
 * The Masters section: the list (/masters), or the create (/masters/new),
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
  const screen = screenOf(segments, { actions: { edit: 'edit', copy: 'clone' } });

  const backToList = () => navigate(basePath);

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <MastersListPage
        // The list already knows the limit; opened straight from the address the form asks itself.
        onCreate={(limits) => navigate(`${basePath}/new`, { state: { valuesAllowed: limits?.valuesAllowedPerMaster ?? null } })}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
      />
    );
  }

  return (
    <MasterFormPage
      // A fresh form for every master / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
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
