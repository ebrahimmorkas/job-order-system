import { Component } from 'react';
import ErrorPage from './ErrorPage';
import { ServerErrorIcon } from './icons';

/**
 * Around a page loaded on demand (see utils/lazyPage.js): when its code can't
 * be downloaded (the connection dropped, or a new version went online and
 * the old files are gone), shows "Reload" instead of a blank screen.
 * Give it a key per page, so opening another page tries again.
 */
class PageLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ErrorPage
        embedded
        icon={<ServerErrorIcon />}
        title="This page couldn't be loaded"
        description="Check your internet connection and reload the page."
        primaryAction={{ label: 'Reload', onClick: () => window.location.reload() }}
      />
    );
  }
}

export default PageLoadBoundary;
