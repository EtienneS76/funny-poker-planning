import { useState } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { authClient } from './auth-client'

export function useAccount() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const configured = useQuery(api.auth.isConfigured)
  const user = useQuery(api.auth.currentUser, isAuthenticated ? {} : 'skip')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const oauthError = new URLSearchParams(window.location.search).has('error')

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: window.location.origin,
      })
      if (result.error) throw new Error(result.error.message ?? 'Connexion GitHub impossible')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connexion GitHub impossible')
      setPending(false)
    }
  }

  async function signOut() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message ?? 'Déconnexion impossible')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Déconnexion impossible')
    } finally {
      setPending(false)
    }
  }

  return {
    user,
    isAuthenticated,
    loading: isLoading || (isAuthenticated && user === undefined),
    configured,
    pending,
    error: error ?? (oauthError ? 'La connexion GitHub a échoué. Réessaie.' : null),
    signIn,
    signOut,
  }
}

export type AccountState = ReturnType<typeof useAccount>