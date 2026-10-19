import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation } from 'convex/react'
import { Check, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useAppSnackbar } from '../../components/AppSnackbar'
import type { AccountState } from './useAccount'

type Props = {
  account: AccountState
  onClose: () => void
}

export function AccountSettingsModal({ account, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const snackbar = useAppSnackbar()
  const savePokemonPreference = useMutation(
    api.user.mutations.updatePokemonDisplayPreference,
  )
  const [displayName, setDisplayName] = useState(
    account.profile?.displayName ?? account.user?.username ?? '',
  )
  const [savingName, setSavingName] = useState(false)
  const [savingPreference, setSavingPreference] = useState(false)
  const showPokemon3d = account.profile?.showPokemon3d ?? false

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) return

    setSavingName(true)
    try {
      await account.updateDisplayName(name)
      snackbar.success(
        'Pseudo mis à jour',
        'Il sera conservé à chaque connexion.',
      )
    } catch (error) {
      snackbar.error(
        'Pseudo non sauvegardé',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setSavingName(false)
    }
  }

  async function togglePokemon3d(enabled: boolean) {
    setSavingPreference(true)
    try {
      await savePokemonPreference({ showPokemon3d: enabled })
    } catch (error) {
      snackbar.error(
        'Préférence non sauvegardée',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setSavingPreference(false)
    }
  }

  return (
    <dialog
      className='pp-modal account-settings-modal'
      ref={dialog}
      aria-labelledby='account-settings-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className='pp-modal-content account-settings-content'>
        <div className='pp-modal-heading'>
          <div>
            <span className='pp-inventory-kicker'>TON PROFIL</span>
            <h2 id='account-settings-title'>Paramètres</h2>
          </div>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer les paramètres'
            onClick={onClose}
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>

        <form className='account-settings-name' onSubmit={saveDisplayName}>
          <label htmlFor='account-settings-display-name'>Pseudo affiché</label>
          <div>
            <input
              id='account-settings-display-name'
              required
              maxLength={36}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <button type='submit' disabled={savingName || !displayName.trim()}>
              <Check size={17} aria-hidden='true' />
              {savingName ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>

        <label className='account-settings-switch'>
          <span className='account-settings-switch-copy'>
            <strong>Afficher les Pokémon animés</strong>
            <small>
              Affiche tous les Pokémon de la salle en animé pour toi, sans
              mélanger les styles.
            </small>
          </span>
          <input
            type='checkbox'
            role='switch'
            checked={showPokemon3d}
            disabled={savingPreference}
            onChange={(event) =>
              void togglePokemon3d(event.currentTarget.checked)
            }
          />
        </label>
      </div>
    </dialog>
  )
}
