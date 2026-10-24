import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import MyWorkListPage from './MyWorkListPage';
import MyWorkViewPage from './MyWorkViewPage';

/**
 * The My work section (users given master values' work): the list
 * (/my-work), or a job order's read-only view (/my-work/:id).
 *
 * @param {Object} props
 * @param {string} props.basePath - '/my-work'
 * @param {string[]} props.segments - The address after it
 */
const MyWorkPage = ({ basePath, segments }) => {
  const { navigate } = useRouter();
  const screen = screenOf(segments, { view: true });

  if (!screen || screen.mode === 'create') return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'view') {
    return <MyWorkViewPage key={screen.id} jobOrderId={screen.id} onBack={() => navigate(basePath)} />;
  }
  return <MyWorkListPage onView={(id) => navigate(`${basePath}/${id}`)} />;
};

export default MyWorkPage;
