import { useContext } from 'react';
import { AccessContext } from '../context/AccessContext';

/**
 * What the logged-in person may do, from anywhere below <AccessProvider>.
 *
 * Usage:
 *   const { access, can } = useAccess();
 *   can('masters', 'edit')                // the owner: always true
 *   can('jobOrders', ['create', 'edit'])  // any of them
 *   access.isOwner, access.hasWork        // hasWork: show "My work"
 */
export const useAccess = () => {
  const ctx = useContext(AccessContext);

  if (!ctx) {
    throw new Error('useAccess must be used within an <AccessProvider>');
  }

  return ctx;
};

export default useAccess;
