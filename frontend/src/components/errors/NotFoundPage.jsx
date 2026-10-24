import ErrorPage from './ErrorPage';
import { NotFoundIcon } from './icons';

const goHome = () => { window.location.href = '/'; };

/**
 * For a URL the app has no page for.
 *
 * @param {Object} props
 * @param {() => void} [props.onGoHome] - Defaults to a full navigation to "/".
 * @param {boolean} [props.embedded] - Inside the logged-in layout
 */
const NotFoundPage = ({ onGoHome = goHome, embedded = false }) => (
  <ErrorPage
    embedded={embedded}
    icon={<NotFoundIcon />}
    code="404"
    title="Page not found"
    description="This page doesn't exist or has been moved. Check the address, or go back to the home page."
    primaryAction={{ label: 'Go to home page', onClick: onGoHome }}
  />
);

export default NotFoundPage;
