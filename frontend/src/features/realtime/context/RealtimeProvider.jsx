import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RealtimeContext } from './RealtimeContext';
import { REALTIME_EVENTS } from '../events';
import { useAuth } from '../../auth/hooks/useAuth';
import { getAccessToken, renewAccessToken } from '../../../utils/apiClient';

// After the server refused the connection (e.g. the access token expired),
// how long to wait before getting a new token and trying again.
const RETRY_MS = 5000;

// The API on another address (VITE_API_BASE_URL with a host): connect there;
// otherwise this page's own address (/socket.io, like /api).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const SERVER_URL = /^https?:\/\//.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : undefined;

/**
 * Live updates from the server (backend services/realtimeService.js) while
 * logged in: one connection for the whole app, with the access token. Pages
 * listen with useRealtimeEvent(event, handler). Losing the connection
 * reconnects by itself and then tells everyone RECONNECTED (load again).
 */
const RealtimeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // event -> the handlers listening.
  const listenersRef = useRef(new Map());

  const dispatch = useCallback((event, data) => {
    listenersRef.current.get(event)?.forEach((handler) => handler(data));
  }, []);

  const subscribe = useCallback((event, handler) => {
    const listeners = listenersRef.current;
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let socket = null;
    let isClosed = false;
    let retryTimer = null;
    let wasConnected = false;

    // Loaded after logging in, so the login page stays small.
    import('socket.io-client').then(({ io }) => {
      if (isClosed) return;
      // Asked on every (re)connect, so a renewed token is used.
      socket = io(SERVER_URL, { auth: (send) => send({ token: getAccessToken() }) });
      socket.onAny(dispatch);
      socket.on('connect', () => {
        if (wasConnected) dispatch(REALTIME_EVENTS.RECONNECTED, {});
        wasConnected = true;
      });
      socket.on('connect_error', () => {
        // Network trouble: socket.io tries again by itself. Refused by the
        // server: renew the token, then try again.
        if (socket.active) return;
        retryTimer = setTimeout(async () => {
          if (!isClosed && await renewAccessToken()) socket.connect();
        }, RETRY_MS);
      });
    }).catch(() => {
      // No live updates (e.g. offline while loading); the pages still work.
    });

    return () => {
      isClosed = true;
      clearTimeout(retryTimer);
      socket?.disconnect();
    };
  }, [isAuthenticated, dispatch]);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export default RealtimeProvider;
