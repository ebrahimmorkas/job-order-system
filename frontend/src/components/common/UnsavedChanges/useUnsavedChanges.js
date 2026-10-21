import { useContext, useEffect } from 'react';
import { UnsavedChangesContext } from './UnsavedChangesContext';

const useGuard = () => {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChanges must be used within an <UnsavedChangesProvider>');
  return ctx;
};

/**
 * For a page with a form: while `isDirty`, leaving through the app asks first
 * (via the returned confirmLeave) and closing / refreshing the tab shows the
 * browser's own "Leave site?" prompt (browsers don't allow custom text there).
 *
 *   const confirmLeave = useUnsavedChanges(isDirty);
 *   <Button onClick={() => confirmLeave(onBack)}>Back</Button>
 *
 * @returns {(action: () => void) => void} confirmLeave
 */
export const useUnsavedChanges = (isDirty) => {
  const { setDirty, confirmLeave, isLeavingRef } = useGuard();

  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  // Listens only while there is something to lose.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (e) => {
      if (isLeavingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isLeavingRef]);

  return confirmLeave;
};

/**
 * For whatever navigates away (the sidebar, logout): runs `action` at once,
 * or after the user agrees to drop the current page's unsaved changes.
 */
export const useConfirmLeave = () => useGuard().confirmLeave;

export default useUnsavedChanges;
