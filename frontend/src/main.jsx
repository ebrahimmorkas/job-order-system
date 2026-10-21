import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ServerErrorScreen } from './components/errors'
import AuthProvider from './features/auth/context/AuthProvider'
import BrandingProvider from './features/branding/context/BrandingProvider'
import ToastProvider from './components/common/Toast/ToastProvider'
import UnsavedChangesProvider from './components/common/UnsavedChanges/UnsavedChangesProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Full-page error for any request that failed on the server (backend logException). */}
    <ServerErrorScreen>
      <BrandingProvider>
        <AuthProvider>
          <ToastProvider>
            <UnsavedChangesProvider>
              <App />
            </UnsavedChangesProvider>
          </ToastProvider>
        </AuthProvider>
      </BrandingProvider>
    </ServerErrorScreen>
  </StrictMode>,
)
