import { StatusErrorPage } from './components/errors'
import Spinner from './components/common/Spinner'
import { useAuth } from './features/auth/hooks/useAuth'
import { useBranding } from './features/branding/hooks/useBranding'
import { useServiceStatus } from './features/serviceStatus/hooks/useServiceStatus'
import ServiceStatusPage from './features/serviceStatus/pages/ServiceStatusPage'
import LoginPage from './features/auth/pages/LoginPage'
import AppShell from './layouts/AppShell'
import AccessProvider from './features/access/context/AccessProvider'

// The login screen at any address until logged in (the address is kept, so
// logging in opens the page that was asked for), then the shell, which shows
// the page of the address. While the app isn't open (maintenance, payment,
// shop closed) only that page shows, logged in or not.
const App = () => {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const { isLoading: isBrandingLoading, error: brandingError, retry } = useBranding()
  const { block, isLoading: isStatusLoading, refresh } = useServiceStatus()

  // e.g. 404 "No account is set up for this domain", or the server unreachable.
  if (brandingError) {
    return <StatusErrorPage statusCode={brandingError.statusCode} message={brandingError.message} onRetry={retry} />
  }
  if (isLoading || isBrandingLoading || isStatusLoading) return <Spinner size="lg" fullScreen />
  if (block) return <ServiceStatusPage block={block} onCheckAgain={refresh} onLogout={isAuthenticated ? logout : null} />
  if (!isAuthenticated) return <LoginPage />
  return (
    <AccessProvider>
      <AppShell />
    </AccessProvider>
  )
}

export default App
