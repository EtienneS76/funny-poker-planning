import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BarChart3,
  Backpack,
  Check,
  ChevronDown,
  GitBranch,
  LogOut,
  Pencil,
} from 'lucide-react'
import { useAppSnackbar } from '../../components/AppSnackbar'
import { AccountStatisticsModal } from './AccountStatisticsModal'
import ModalInventory from '../../components/ModalInventory'
import { AvatarFrame } from '../avatar/AvatarFrame'
import type { AccountState } from './useAccount'

export default function Account({ account }: { account: AccountState }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const [editingGuestName, setEditingGuestName] = useState(false)
  const [guestNameDraft, setGuestNameDraft] = useState(account.guestName)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [statisticsOpen, setStatisticsOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const snackbar = useAppSnackbar()

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (
        menu.current &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      ) {
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

  if (account.loading)
    return (
      <span className='account-loading' role='status'>
        Connexion...
      </span>
    )

  if (!account.isAuthenticated || !account.user) {
    return (
      <details className='profile-menu' ref={menu}>
        <summary
          className='profile-trigger'
          aria-label={`Profil invité ${account.guestName}`}
        >
          <span className='profile-avatar' aria-hidden='true'>
            {account.guestName.slice(0, 1).toUpperCase()}
          </span>
          <span className='profile-username'>@{account.guestName}</span>
          <ChevronDown size={16} aria-hidden='true' />
        </summary>
        <div className='profile-dropdown'>
          <span className='profile-caption'>Session invitée</span>
          <strong className='profile-name'>@{account.guestName}</strong>
          {editingGuestName ? (
            <form
              className='profile-edit-form'
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                const name = guestNameDraft.trim()
                if (!name) return
                account.setGuestName(name)
                setEditingGuestName(false)
              }}
            >
              <label htmlFor='guest-name'>Pseudo</label>
              <input
                id='guest-name'
                autoFocus
                required
                maxLength={36}
                value={guestNameDraft}
                onChange={(event) => setGuestNameDraft(event.target.value)}
              />
              <button className='profile-signout' type='submit'>
                <Check size={17} aria-hidden='true' />
                Enregistrer
              </button>
            </form>
          ) : (
            <button
              className='profile-signout'
              onClick={() => {
                setGuestNameDraft(account.guestName)
                setEditingGuestName(true)
              }}
            >
              <Pencil size={17} aria-hidden='true' />
              Changer mon pseudo
            </button>
          )}
          <button
            className='profile-signout'
            disabled={account.pending || account.configured !== true}
            onClick={account.signIn}
          >
            <GitBranch size={17} aria-hidden='true' />
            {account.pending ? 'Connexion...' : 'Me connecter avec GitHub'}
          </button>
        </div>
      </details>
    )
  }

  const displayName = account.profile?.displayName ?? account.user.username
  const statistics = account.profile?.statistics

  return (
    <>
      <details className='profile-menu' ref={menu}>
        <summary
          className='profile-trigger'
          aria-label={`Compte GitHub de ${displayName}`}
        >
          <AvatarFrame
            frameId={account.profile?.avatarFrameId}
            className='profile-avatar-frame avatar-frame--compact'
          >
            <span className='profile-avatar' aria-hidden='true'>
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
              {account.user.avatarUrl && (
                <img
                  src={account.user.avatarUrl}
                  alt=''
                  width={32}
                  height={32}
                  onError={(event) => {
                    event.currentTarget.hidden = true
                  }}
                />
              )}
            </span>
          </AvatarFrame>
          <span className='profile-username'>@{displayName}</span>
          <ChevronDown size={16} aria-hidden='true' />
        </summary>
        <div className='profile-dropdown'>
          <span className='profile-caption'>Connecté avec GitHub</span>
          <strong className='profile-name'>@{displayName}</strong>
          <details className='profile-submenu'>
            <summary className='profile-submenu-trigger'>
              <span>Mon profil</span>
              <ChevronDown size={16} aria-hidden='true' />
            </summary>
            <div className='profile-submenu-content'>
              <button
                className='profile-signout'
                onClick={() => {
                  if (menu.current) menu.current.open = false
                  setInventoryOpen(true)
                }}
              >
                <Backpack size={17} aria-hidden='true' />
                Inventaire
              </button>
              <button
                className='profile-signout'
                onClick={() => {
                  if (menu.current) menu.current.open = false
                  setStatisticsOpen(true)
                }}
              >
                <BarChart3 size={17} aria-hidden='true' />
                Statistiques
              </button>
              {editingDisplayName ? (
                <form
                  className='profile-edit-form'
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault()
                    const name = displayNameDraft.trim()
                    if (!name) return
                    try {
                      await account.updateDisplayName(name)
                      setEditingDisplayName(false)
                      snackbar.success(
                        'Pseudo mis à jour',
                        'Il sera conservé à chaque connexion.',
                      )
                    } catch (updateError) {
                      snackbar.error(
                        'Pseudo non sauvegardé',
                        updateError instanceof Error
                          ? updateError.message
                          : 'Réessaie dans un instant.',
                      )
                    }
                  }}
                >
                  <label htmlFor='github-display-name'>Pseudo affiché</label>
                  <input
                    id='github-display-name'
                    autoFocus
                    required
                    maxLength={36}
                    value={displayNameDraft}
                    onChange={(event) =>
                      setDisplayNameDraft(event.target.value)
                    }
                  />
                  <button className='profile-signout' type='submit'>
                    <Check size={17} aria-hidden='true' />
                    Enregistrer
                  </button>
                </form>
              ) : (
                <button
                  className='profile-signout'
                  onClick={() => {
                    setDisplayNameDraft(displayName)
                    setEditingDisplayName(true)
                  }}
                >
                  <Pencil size={17} aria-hidden='true' />
                  Changer mon pseudo
                </button>
              )}
            </div>
          </details>
          <button
            className='profile-signout'
            disabled={account.pending}
            onClick={account.signOut}
          >
            <LogOut size={17} aria-hidden='true' />
            {account.pending ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </details>
      <AccountStatisticsModal
        open={statisticsOpen}
        username={account.user.username}
        displayName={displayName}
        avatarUrl={account.user.avatarUrl}
        avatarFrameId={account.profile?.avatarFrameId ?? null}
        firstConnectedAt={account.profile?.firstConnectedAt ?? Date.now()}
        refinementCount={statistics?.refinementCount ?? 0}
        roundCount={statistics?.roundCount ?? 0}
        onClose={() => setStatisticsOpen(false)}
      />
      {inventoryOpen && (
        <ModalInventory onClose={() => setInventoryOpen(false)} />
      )}
    </>
  )
}
