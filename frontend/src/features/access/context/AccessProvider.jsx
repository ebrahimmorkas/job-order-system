import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessContext } from './AccessContext';
import * as accessApi from '../api/accessApi';
import Spinner from '../../../components/common/Spinner';
import { StatusErrorPage } from '../../../components/errors';

/**
 * Loads what the logged-in person may do once, before the pages show - so a
 * user never sees a menu item or button they can't use, even for a moment.
 * The backend checks every request anyway.
 */
const AccessProvider = ({ children }) => {
  const [access, setAccess] = useState(null);
  const [error, setError] = useState(null);
  // Bumped by retry() to run the fetch again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    accessApi
      .getMyAccess({ signal: controller.signal })
      .then((data) => setAccess(data.access))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err);
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  // can('masters', 'edit'), or any of several: can('jobOrders', ['create', 'edit']).
  const can = useCallback(
    (module, permissions) => !!access && (access.isOwner || [].concat(permissions).some((p) => (access.modules[module] || []).includes(p))),
    [access]
  );

  const value = useMemo(() => ({ access, can }), [access, can]);

  if (error) return <StatusErrorPage statusCode={error.statusCode} message={error.message} onRetry={retry} />;
  if (!access) return <Spinner size="lg" fullScreen />;
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export default AccessProvider;
