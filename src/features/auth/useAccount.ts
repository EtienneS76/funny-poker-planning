import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { authClient } from './auth-client'

function useAccountState() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const hasOAuthCallback = useRef(
    new URLSearchParams(window.location.search).has('ott'),
  ).current
  const callbackLogged = useRef(false)
  const sessionLogged = useRef(false)
  const configured = useQuery(api.auth.auth.isConfigured)
  const user = useQuery(
    api.auth.auth.currentUser,
    isAuthenticated ? {} : 'skip',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const oauthError = new URLSearchParams(window.location.search).has('error')

  useEffect(() => {
    if (hasOAuthCallback && !callbackLogged.current) {
      callbackLogged.current = true
      console.info('[auth] GitHub callback received')
    }
    if (hasOAuthCallback && isAuthenticated && !sessionLogged.current) {
      sessionLogged.current = true
      console.info('[auth] Convex session restored after GitHub callback')
    }
  }, [hasOAuthCallback, isAuthenticated])

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: window.location.origin,
      })
      if (result.error)
        throw new Error(result.error.message ?? 'Connexion GitHub impossible')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Connexion GitHub impossible',
      )
      setPending(false)
    }
  }

  async function signOut() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signOut()
      if (result.error)
        throw new Error(result.error.message ?? 'Déconnexion impossible')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Déconnexion impossible',
      )
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
    error:
      error ?? (oauthError ? 'La connexion GitHub a échoué. Réessaie.' : null),
    signIn,
    signOut,
  }
}

export type AccountState = ReturnType<typeof useAccountState>

const AccountContext = createContext<AccountState | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const account = useAccountState()
  return createElement(AccountContext.Provider, { value: account }, children)
}

export function useAccount(): AccountState {
  const account = useContext(AccountContext)
  if (!account)
    throw new Error('useAccount doit être utilisé dans AccountProvider')
  return account
}
