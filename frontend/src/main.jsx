import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ServerErrorScreen } from './components/errors'
import AuthProvider from './features/auth/context/AuthProvider'
import BrandingProvider from './features/branding/context/BrandingProvider'
import ServiceStatusProvider from './features/serviceStatus/context/ServiceStatusProvider'
import ToastProvider from './components/common/Toast/ToastProvider'
import UnsavedChangesProvider from './components/common/UnsavedChanges/UnsavedChangesProvider'
import { RouterProvider } from './router'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Full-page error for any request that failed on the server (backend logException). */}
    <ServerErrorScreen>
      <BrandingProvider>
        <AuthProvider>
          <ServiceStatusProvider>
            <ToastProvider>
              <UnsavedChangesProvider>
                <RouterProvider>
                  <App />
                </RouterProvider>
              </UnsavedChangesProvider>
            </ToastProvider>
          </ServiceStatusProvider>
        </AuthProvider>
      </BrandingProvider>
    </ServerErrorScreen>
  </StrictMode>,
)
