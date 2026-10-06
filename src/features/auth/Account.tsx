import { useEffect, useRef } from 'react'
import { ChevronDown, GitBranch, LogOut } from 'lucide-react'
import type { AccountState } from './useAccount'

export default function Account({ account }: { account: AccountState }) {
  const menu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (menu.current && event.target instanceof Node && !menu.current.contains(event.target)) {
        menu.current.open = false
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false
        menu.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  if (account.loading) return <span className='account-loading' role='status'>Connexion...</span>

  if (!account.isAuthenticated || !account.user) {
    return (
      <button className='pp-button pp-button--github' disabled={account.pending || account.configured !== true} onClick={account.signIn}>
        <GitBranch size={18} aria-hidden='true' />
        {account.pending ? 'Connexion...' : 'Continuer avec GitHub'}
      </button>
    )
  }

  return (
    <details className='profile-menu' ref={menu}>
      <summary className='profile-trigger' aria-label={`Compte GitHub de ${account.user.username}`}>
        <span className='profile-avatar' aria-hidden='true'>
          <span>{account.user.username.slice(0, 1).toUpperCase()}</span>
          {account.user.avatarUrl && <img src={account.user.avatarUrl} alt='' width={32} height={32} onError={event => { event.currentTarget.hidden = true }} />}
        </span>
        <span className='profile-username'>@{account.user.username}</span>
        <ChevronDown size={16} aria-hidden='true' />
      </summary>
      <div className='profile-dropdown'>
        <span className='profile-caption'>Connecté avec GitHub</span>
        <strong className='profile-name'>@{account.user.username}</strong>
        <button className='profile-signout' disabled={account.pending} onClick={account.signOut}>
          <LogOut size={17} aria-hidden='true' />
          {account.pending ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </div>
    </details>
  )
}
