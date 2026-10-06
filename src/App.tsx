import { ConvexProvider, ConvexReactClient } from 'convex/react'
import Home from './Home'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export default function App() {
  if (!convex) {
    return (
      <main>
        <button
          disabled
          title='Configurer VITE_CONVEX_URL avec yarn dev:convex'
        >
          Ping
        </button>
      </main>
    )
  }

  return (
    <ConvexProvider client={convex}>
      <Home />
    </ConvexProvider>
  )
}
