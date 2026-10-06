import { useState } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../convex/_generated/api'

export default function Home() {
  const convex = useConvex()
  const [status, setStatus] = useState('Ping')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePing() {
    setPending(true)
    setError(null)

    try {
      const result = await convex.query(api.ping.ping, {})
      setStatus(result)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Convex indisponible')
      setStatus('Ping')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <button onClick={handlePing} disabled={pending} aria-live='polite'>
        {pending ? '...' : status}
      </button>
      {error && <p role='alert'>{error}</p>}
    </main>
  )
}
