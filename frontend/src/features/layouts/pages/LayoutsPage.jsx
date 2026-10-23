import { useState } from 'react';
import LayoutsListPage from './LayoutsListPage';
import LayoutDesignerPage from './LayoutDesignerPage';

/**
 * The Layout Master section: the list, or the designer (create / copy /
 * edit). (No router yet - the screen shown is kept here.)
 */
const LayoutsPage = () => {
  // { mode: 'list' } | { mode: 'create' } | { mode: 'edit' | 'clone', id }
  const [screen, setScreen] = useState({ mode: 'list' });

  if (screen.mode === 'list') {
    return (
      <LayoutsListPage
        onCreate={() => setScreen({ mode: 'create' })}
        onEdit={(id) => setScreen({ mode: 'edit', id })}
        onClone={(id) => setScreen({ mode: 'clone', id })}
      />
    );
  }

  return (
    <LayoutDesignerPage
      // A fresh designer for every layout / mode.
      key={`${screen.mode}-${screen.id || ''}`}
      mode={screen.mode}
      layoutId={screen.id}
      onBack={() => setScreen({ mode: 'list' })}
    />
  );
};

export default LayoutsPage;
