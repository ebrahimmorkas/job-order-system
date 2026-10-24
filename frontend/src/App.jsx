import { NotFoundPage, StatusErrorPage } from './components/errors'
import Spinner from './components/common/Spinner'
import { useAuth } from './features/auth/hooks/useAuth'
import { useBranding } from './features/branding/hooks/useBranding'
import LoginPage from './features/auth/pages/LoginPage'
import AppShell from './layouts/AppShell'
import AccessProvider from './features/access/context/AccessProvider'

// No router yet: the app lives at "/" - the login screen until logged in,
// then the shell. Any other path is a 404 once logged in.
const App = () => {
  const { isAuthenticated, isLoading } = useAuth()
  const { isLoading: isBrandingLoading, error: brandingError, retry } = useBranding()

  // e.g. 404 "No account is set up for this domain", or the server unreachable.
  if (brandingError) {
    return <StatusErrorPage statusCode={brandingError.statusCode} message={brandingError.message} onRetry={retry} />
  }
  if (isLoading || isBrandingLoading) return <Spinner size="lg" fullScreen />
  if (!isAuthenticated) return <LoginPage />
  if (window.location.pathname !== '/') return <NotFoundPage />
  return (
    <AccessProvider>
      <AppShell />
    </AccessProvider>
  )
}

export default App
