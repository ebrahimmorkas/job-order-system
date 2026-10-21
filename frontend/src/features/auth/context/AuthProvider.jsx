import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import {
  setAccessToken,
  clearAccessToken,
  onSessionExpired,
  hasSessionHint,
  setSessionHint,
  clearSessionHint,
} from '../../../utils/apiClient';

/**
 * Owns the session: current user, login/logout, and a silent refresh on mount
 * so a page reload stays logged in as long as the refresh-token cookie is
 * still valid.
 *
 * sessionExpiredMessage is set when the session ends on its own (refresh token
 * expired or revoked) - the UI shows it on the login screen and calls
 * clearSessionExpiredMessage once shown.
 */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Starts false (nothing to wait on) unless there's a hint this browser has
  // logged in before, in which case the mount effect below needs to confirm
  // via a silent refresh first.
  const [isLoading, setIsLoading] = useState(() => hasSessionHint());
  // True for the brief window between clicking logout and the browser
  // actually navigating away - without it, clearing `user` re-renders the app
  // as logged out and flashes the login screen before the navigation.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  // Full clear for when the session is actually gone (logout, expired/invalid
  // refresh token) - also drops the hint so future loads don't bother refreshing.
  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    clearSessionHint();
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      setSessionExpiredMessage('Your session has expired. Please log in again.');
    });
    return () => onSessionExpired(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    // No hint that this browser has ever logged in - skip the silent
    // refresh entirely rather than firing a request that's guaranteed to
    // 401 for every first-time/logged-out visitor. (isLoading was already
    // initialized to false above in this case.)
    if (!hasSessionHint()) return;

    (async () => {
      try {
        const data = await authApi.refreshToken();
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (identifier, password) => {
    try {
      const data = await authApi.login(identifier, password);
      setSessionHint();
      setAccessToken(data.accessToken);
      setUser(data.user);
      setSessionExpiredMessage(null);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Best-effort - clear the local session regardless of whether the server call succeeded
    }
    clearSession();
    // A full navigation also resets every page's in-memory state.
    window.location.href = '/';
  }, [clearSession]);

  const clearSessionExpiredMessage = useCallback(() => setSessionExpiredMessage(null), []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: isLoading || isLoggingOut,
      login,
      logout,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
    }),
    [user, isLoading, isLoggingOut, login, logout, sessionExpiredMessage, clearSessionExpiredMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
