import ErrorPage from './ErrorPage';
import { NotFoundIcon, ForbiddenIcon, UnauthorizedIcon, ServerErrorIcon, OfflineIcon } from './icons';

const goHome = () => { window.location.href = '/'; };

// apiClient throws statusCode 0 when the request never reached the server.
const STATUS_CONFIG = {
  0: { code: 'OFFLINE', icon: <OfflineIcon />, title: "Can't reach the server", description: 'Check your internet connection and try again.' },
  401: { code: '401', icon: <UnauthorizedIcon />, title: 'Please log in again', description: 'Your session has ended.' },
  403: { code: '403', icon: <ForbiddenIcon />, title: "You don't have access", description: "Your account isn't allowed to open this." },
  404: { code: '404', icon: <NotFoundIcon />, title: 'Not found', description: "What you were looking for doesn't exist or has been removed." },
  429: { code: '429', icon: <ServerErrorIcon />, title: 'Too many attempts', description: 'Please wait a little and try again.' },
  500: { code: '500', icon: <ServerErrorIcon />, title: 'Something went wrong', description: 'Please try again in a moment.' },
};

/**
 * The error screen for a failed API call, picked by its status code (an
 * ApiError's statusCode from utils/apiClient.js). An unknown code shows the
 * 500 screen.
 *
 * @param {Object} props
 * @param {number} [props.statusCode]
 * @param {string} [props.message] - The server's message; replaces the default description.
 * @param {() => void} [props.onRetry] - Shows a "Try again" button.
 * @param {() => void} [props.onGoHome] - Defaults to a full navigation to "/".
 */
const StatusErrorPage = ({ statusCode, message, onRetry, onGoHome = goHome }) => {
  const config = STATUS_CONFIG[statusCode] || STATUS_CONFIG[500];
  return (
    <ErrorPage
      icon={config.icon}
      code={config.code}
      title={config.title}
      description={message || config.description}
      primaryAction={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'Go to home page', onClick: onGoHome }}
    />
  );
};

export default StatusErrorPage;
