import { useCallback, useEffect, useMemo, useState } from 'react';
import { ServiceStatusContext } from './ServiceStatusContext';
import * as serviceStatusApi from '../api/serviceStatusApi';
import { onServiceBlocked } from '../../../utils/apiClient';
import { useAuth } from '../../auth/hooks/useAuth';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';

// While blocked, how often to look whether the app is open again.
const RECHECK_MS = 30 * 1000;
// setTimeout can't wait longer than this (~24.8 days).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Whether the app is open (backend services/serviceStatusService.js): asked
 * once before logging in (maintenance only) and again after; any request the
 * backend refuses with a block shows the page at once. While blocked it looks
 * again every 30 seconds, at the shop's time to open again and whenever the
 * server says it changed, so the page comes and goes by itself.
 */
const ServiceStatusProvider = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [status, setStatus] = useState({ block: null, shop: null });
  const [isLoading, setIsLoading] = useState(true);
  // Bumped by refresh() to ask again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isAuthLoading) return undefined;
    const controller = new AbortController();
    const request = isAuthenticated ? serviceStatusApi.getMyStatus : serviceStatusApi.getPublicStatus;
    request({ signal: controller.signal })
      .then((data) => setStatus({ block: data.block, shop: data.shop || null }))
      // Can't tell (e.g. offline): the app's own requests show what is wrong.
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setIsLoading(false));
    return () => controller.abort();
  }, [isAuthenticated, isAuthLoading, attempt]);

  useEffect(() => {
    onServiceBlocked((block) => setStatus((prev) => ({ ...prev, block })));
    return () => onServiceBlocked(null);
  }, []);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  // The server says something changed (maintenance, payment, the shop): ask now.
  useRealtimeEvent([REALTIME_EVENTS.SERVICE_STATUS_CHANGED, REALTIME_EVENTS.RECONNECTED], refresh);

  // Blocked: look again every so often.
  useEffect(() => {
    if (!status.block) return undefined;
    const timer = setInterval(refresh, RECHECK_MS);
    return () => clearInterval(timer);
  }, [status.block, refresh]);

  // The shop opens by itself at its time: look again just after.
  const resumeAt = status.block?.resumeAt || status.shop?.resumeAt || null;
  useEffect(() => {
    if (!resumeAt) return undefined;
    const wait = new Date(resumeAt).getTime() - Date.now() + 1000;
    if (wait > MAX_TIMEOUT_MS) return undefined;
    const timer = setTimeout(refresh, Math.max(wait, 0));
    return () => clearTimeout(timer);
  }, [resumeAt, refresh]);

  // After the owner closes / opens the shop in Company Settings.
  const setShop = useCallback((shop) => setStatus((prev) => ({ ...prev, shop })), []);

  const value = useMemo(
    () => ({ block: status.block, shop: status.shop, isLoading, refresh, setShop }),
    [status, isLoading, refresh, setShop]
  );

  return <ServiceStatusContext.Provider value={value}>{children}</ServiceStatusContext.Provider>;
};

export default ServiceStatusProvider;
