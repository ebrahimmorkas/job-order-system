import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import LayoutsListPage from './LayoutsListPage';
import LayoutDesignerPage from './LayoutDesignerPage';

/**
 * The Layout Master section: the list (/layouts), or the designer - create
 * (/layouts/new), copy (/layouts/:id/copy) or edit (/layouts/:id/edit).
 *
 * @param {Object} props
 * @param {string} props.basePath - '/layouts'
 * @param {string[]} props.segments - The address after it
 */
const LayoutsPage = ({ basePath, segments }) => {
  const { navigate } = useRouter();
  const screen = screenOf(segments, { actions: { edit: 'edit', copy: 'clone' } });

  if (!screen) return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <LayoutsListPage
        onCreate={() => navigate(`${basePath}/new`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
        onClone={(id) => navigate(`${basePath}/${id}/copy`)}
      />
    );
  }

  return (
    <LayoutDesignerPage
      // A fresh designer for every layout / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      layoutId={screen.id}
      onBack={() => navigate(basePath)}
    />
  );
};

export default LayoutsPage;
