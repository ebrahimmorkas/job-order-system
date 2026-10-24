import { useContext } from 'react';
import { RouterContext } from './RouterContext';

/**
 * The current address and how to move to another one.
 *
 * @returns {{ pathname: string, search: string, state: Object|null, navigate: (to: string, options?: { replace?: boolean, state?: Object }) => void }}
 */
export const useRouter = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within a <RouterProvider>');
  return ctx;
};

export default useRouter;
