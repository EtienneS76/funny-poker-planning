import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { authClient } from './features/auth/auth-client'
import { AccountProvider } from './features/auth/useAccount'
import Home from './Home'
import { SnackbarProvider } from 'notistack'
import { RefinementRoom } from './features/refinement/RefinementRoom'
import AppErrorBoundary from './components/AppErrorBoundary'
import './styles/index.css'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export default function App() {
  if (!convex || !import.meta.env.VITE_CONVEX_SITE_URL) {
    return (
      <main>
        <p role='alert'>Configurer VITE_CONVEX_URL et VITE_CONVEX_SITE_URL.</p>
      </main>
    )
  }

  return (
    <SnackbarProvider>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <AccountProvider>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/refinement' element={<Navigate to='/' replace />} />
            <Route
              path='/refinement/:refinementSlug'
              element={<RefinementRoom />}
            />
          </Routes>
        </AccountProvider>
      </ConvexBetterAuthProvider>
    </SnackbarProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
