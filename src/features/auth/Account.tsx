import { useState } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { authClient } from './auth-client'

export default function Account() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const configured = useQuery(api.auth.isConfigured)
  const user = useQuery(api.auth.currentUser, isAuthenticated ? {} : 'skip')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const oauthError = new URLSearchParams(window.location.search).has('error')

  async function handleSignIn() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: window.location.origin,
      })
      if (result.error) {
        throw new Error(result.error.message ?? 'Connexion GitHub impossible')
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Connexion GitHub impossible',
      )
      setPending(false)
    }
  }

  async function handleSignOut() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signOut()
      if (result.error) {
        throw new Error(result.error.message ?? 'Deconnexion impossible')
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Deconnexion impossible',
      )
    } finally {
      setPending(false)
    }
  }

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <p role='status' className='auth-status'>
        Chargement...
      </p>
    )
  }

  return (
    <>
      {isAuthenticated && user ? (
        <section className='account' aria-label='Compte GitHub'>
          {user.avatarUrl && (
            <img
              className='account-avatar'
              src={user.avatarUrl}
              alt=''
              width={80}
              height={80}
            />
          )}
          <span className='account-username'>@{user.username}</span>
          <button disabled={pending} onClick={handleSignOut}>
            Se deconnecter
          </button>
        </section>
      ) : (
        <button
          disabled={pending || configured !== true}
          onClick={handleSignIn}
          title={
            configured === false
              ? 'Configurer GitHub OAuth sur Convex'
              : undefined
          }
        >
          {pending ? 'Connexion...' : 'Se connecter'}
        </button>
      )}
      {configured === false && (
        <p role='status'>Connexion GitHub non configuree.</p>
      )}
      {(error || oauthError) && (
        <p role='alert'>{error ?? 'La connexion GitHub a echoue. Reessaie.'}</p>
      )}
    </>
  )
}
