import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ServerErrorScreen } from './components/errors'
import AuthProvider from './features/auth/context/AuthProvider'
import BrandingProvider from './features/branding/context/BrandingProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Full-page error for any request that failed on the server (backend logException). */}
    <ServerErrorScreen>
      <BrandingProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrandingProvider>
    </ServerErrorScreen>
  </StrictMode>,
)
