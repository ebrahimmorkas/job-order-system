import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RouterContext } from './RouterContext';
import { useUnsavedChangesGuard } from '../components/common/UnsavedChanges';

// Each history entry carries its position (idx), so a Back / Forward can be
// undone while a page has unsaved changes, and anything a page passed along
// (usr - e.g. the limits the list already knows).
const readLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
  state: window.history.state?.usr ?? null,
  idx: window.history.state?.idx ?? 0,
});

/**
 * The page address: every screen has its own URL, so a refresh (or a link
 * opened in a new tab) stays on it. Leaving through the app goes through
 * confirmLeave as before; the browser's Back / Forward on a page with unsaved
 * changes is put back and asks first too.
 */
const RouterProvider = ({ children }) => {
  const { isDirty, confirmLeave } = useUnsavedChangesGuard();
  const [location, setLocation] = useState(() => {
    if (!Number.isInteger(window.history.state?.idx)) window.history.replaceState({ idx: 0, usr: null }, '');
    return readLocation();
  });
  // The latest location for the listener, without adding it again.
  const locationRef = useRef(location);
  // The popstate of putting a page back - not a move of its own.
  const skipPopRef = useRef(false);

  const apply = useCallback((next) => {
    locationRef.current = next;
    setLocation(next);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (skipPopRef.current) {
        skipPopRef.current = false;
        return;
      }
      const next = readLocation();
      const delta = next.idx - locationRef.current.idx;
      if (delta !== 0 && isDirty()) {
        skipPopRef.current = true;
        window.history.go(-delta);
        confirmLeave(() => window.history.go(delta));
        return;
      }
      apply(next);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [apply, isDirty, confirmLeave]);

  /**
   * Opens another address. Callers leaving a form go through confirmLeave
   * first, as before.
   *
   * @param {string} to - e.g. '/users/123/edit'
   * @param {{ replace?: boolean, state?: Object }} [options]
   */
  const navigate = useCallback((to, { replace = false, state = null } = {}) => {
    const url = new URL(to, window.location.origin);
    const current = locationRef.current;
    // Opening the page you are on adds no history entry.
    const isReplace = replace || (url.pathname === current.pathname && url.search === current.search);
    const idx = isReplace ? current.idx : current.idx + 1;
    window.history[isReplace ? 'replaceState' : 'pushState']({ idx, usr: state }, '', `${url.pathname}${url.search}`);
    apply({ pathname: url.pathname, search: url.search, state, idx });
    window.scrollTo(0, 0);
  }, [apply]);

  const value = useMemo(() => ({ ...location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export default RouterProvider;
