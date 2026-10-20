import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { authClient } from './auth-client'

type GuestIdentity = {
  id: string
  name: string
}

const GUEST_STORAGE_KEY = 'multivers-poker.guest'

function createGuestIdentity(): GuestIdentity {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return { id, name: `Joueur-${id.slice(0, 4).toUpperCase()}` }
}

function loadGuestIdentity(): GuestIdentity {
  if (typeof window === 'undefined') return createGuestIdentity()

  try {
    const stored = window.localStorage.getItem(GUEST_STORAGE_KEY)
    if (stored) {
      const identity: unknown = JSON.parse(stored)
      if (
        typeof identity === 'object' &&
        identity !== null &&
        'id' in identity &&
        typeof identity.id === 'string' &&
        'name' in identity &&
        typeof identity.name === 'string' &&
        identity.name.trim()
      ) {
        return { id: identity.id, name: identity.name }
      }
    }
  } catch {
    // Use a fresh guest identity if local storage is unavailable or invalid.
  }

  const identity = createGuestIdentity()
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // The current tab can still use the generated identity.
  }
  return identity
}

function useAccountState() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const configured = useQuery(api.auth.auth.isConfigured)
  const user = useQuery(
    api.auth.auth.currentUser,
    isAuthenticated ? {} : 'skip',
  )
  const profile = useQuery(
    api.user.queries.current,
    isAuthenticated ? {} : 'skip',
  )
  const syncCurrentUser = useMutation(api.user.mutations.syncCurrent)
  const saveDisplayName = useMutation(api.user.mutations.updateDisplayName)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guest, setGuest] = useState(loadGuestIdentity)
  const oauthError = new URLSearchParams(window.location.search).has('error')

  useEffect(() => {
    if (!isAuthenticated || !user || profile === undefined) {
      return
    }
    const needsProfileMigration =
      profile === null ||
      profile.createdAt !== undefined ||
      profile.updatedAt !== undefined ||
      profile.starterCaptureBallsGiftedAt === undefined ||
      profile.statistics === null ||
      profile.statistics?.firstConnectedAt !== undefined ||
      profile.statistics?.updatedAt !== undefined
    if (!needsProfileMigration) return

    void syncCurrentUser().catch((syncError: unknown) => {
      setError(
        syncError instanceof Error
          ? syncError.message
          : 'Impossible de synchroniser le profil GitHub.',
      )
    })
  }, [isAuthenticated, profile, syncCurrentUser, user])

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: window.location.href,
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

  function setGuestName(name: string) {
    const identity = { ...guest, name }
    setGuest(identity)
    try {
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(identity))
    } catch {
      // Keep the name in memory for this tab if local storage is unavailable.
    }
  }

  async function updateDisplayName(displayName: string) {
    await saveDisplayName({ displayName })
  }

  return {
    user,
    guestId: guest.id,
    guestName: guest.name,
    setGuestName,
    profile,
    profileId: profile?._id ?? null,
    updateDisplayName,
    isAuthenticated,
    loading:
      isLoading ||
      (isAuthenticated && (user === undefined || profile === undefined)),
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
