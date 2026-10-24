import { useState } from 'react';
import MyWorkListPage from './MyWorkListPage';
import MyWorkViewPage from './MyWorkViewPage';

/**
 * The My work section (users given master values' work): the list, or a job
 * order's read-only view. (No router yet - the screen shown is kept here.)
 */
const MyWorkPage = () => {
  // { mode: 'list' } | { mode: 'view', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  if (screen.mode === 'view') {
    return <MyWorkViewPage key={screen.id} jobOrderId={screen.id} onBack={() => setScreen({ mode: 'list' })} />;
  }
  return <MyWorkListPage onView={(id) => setScreen({ mode: 'view', id })} />;
};

export default MyWorkPage;
