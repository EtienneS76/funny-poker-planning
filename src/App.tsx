import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from './features/auth/auth-client'
import Home from './Home'

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
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <Home />
    </ConvexBetterAuthProvider>
  )
}
