import { useEffect, useState } from 'react';
import { onServerError } from '../../utils/apiClient';
import ErrorPage from './ErrorPage';
import { ServerErrorIcon } from './icons';

/**
 * Covers the whole app with the 500 screen whenever the backend reports an
 * unexpected error (a response from its logException(), which also saved an
 * ErrorLog whose requestId is the reference shown here). Mounted once, around
 * the app, in main.jsx. The page underneath stays mounted, so "Close" returns
 * to it as it was.
 *
 * `details` (the real error message) only comes from a development backend;
 * production sends just the reference.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.homePath]
 */
const ServerErrorScreen = ({ children, homePath = '/' }) => {
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    onServerError(setServerError);
    return () => onServerError(null);
  }, []);

  return (
    <>
      {children}
      {serverError && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="alertdialog" aria-modal="true" aria-labelledby="server-error-title">
          <ErrorPage
            icon={<ServerErrorIcon />}
            code="500"
            titleId="server-error-title"
            title="Something went wrong"
            description="The error has been recorded. Please try again - if it keeps happening, send the reference below to support."
            primaryAction={{ label: 'Try again', onClick: () => window.location.reload() }}
            secondaryAction={{ label: 'Go to home page', onClick: () => { window.location.href = homePath; } }}
          >
            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Error reference</p>
              <p className="mt-1 font-mono text-sm text-slate-800 break-all select-all">{serverError.reference}</p>
              {serverError.details && (
                <pre className="mt-4 rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700 whitespace-pre-wrap break-words">{serverError.details}</pre>
              )}
              <button
                type="button"
                onClick={() => setServerError(null)}
                className="mt-4 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </ErrorPage>
        </div>
      )}
    </>
  );
};

export default ServerErrorScreen;
