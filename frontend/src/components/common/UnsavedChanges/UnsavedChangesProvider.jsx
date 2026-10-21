import { useCallback, useMemo, useRef, useState } from 'react';
import { UnsavedChangesContext } from './UnsavedChangesContext';
import ConfirmDialog from '../ConfirmDialog';

/**
 * Guards against losing unsaved changes. A page with a form reports whether
 * it has unsaved changes (useUnsavedChanges); anything that would leave it
 * (Back, the sidebar, logout) goes through confirmLeave, which asks first.
 * Closing or refreshing the tab is covered by useUnsavedChanges itself.
 */
const UnsavedChangesProvider = ({ children }) => {
  // Refs, not state: reading or flipping them never re-renders the app.
  const isDirtyRef = useRef(false);
  // Set once the user agreed to leave, so the browser's own "Leave site?"
  // prompt doesn't ask a second time (e.g. on logout).
  const isLeavingRef = useRef(false);
  const [pendingAction, setPendingAction] = useState(null);

  const setDirty = useCallback((isDirty) => { isDirtyRef.current = isDirty; }, []);

  const confirmLeave = useCallback((action) => {
    if (!isDirtyRef.current) return action();
    // A function kept in state must be wrapped, or React would call it.
    setPendingAction(() => action);
  }, []);

  const leave = () => {
    const action = pendingAction;
    setPendingAction(null);
    isDirtyRef.current = false;
    isLeavingRef.current = true;
    action();
    isLeavingRef.current = false;
  };

  const value = useMemo(() => ({ setDirty, confirmLeave, isLeavingRef }), [setDirty, confirmLeave]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={!!pendingAction}
        title="Leave without saving?"
        message="Your changes will be lost."
        confirmLabel="Leave"
        onConfirm={leave}
        onCancel={() => setPendingAction(null)}
      />
    </UnsavedChangesContext.Provider>
  );
};

export default UnsavedChangesProvider;
