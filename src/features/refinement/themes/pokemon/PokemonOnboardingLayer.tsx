import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { GitBranch } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { useAppSnackbar } from '../../../../components/AppSnackbar'
import { PokemonEncounterLayer } from './PokemonEncounterLayer'
import type { RoomProps } from '../types'

export function PokemonOnboardingLayer({ vm }: RoomProps) {
  const { account } = vm
  const [guestPromptDismissed, setGuestPromptDismissed] = useState(false)
  const giftAttempted = useRef(false)
  const snackbar = useAppSnackbar()
  const pokemonCollection = useQuery(
    api.user.queries.pokemonCollection,
    account.isAuthenticated ? {} : 'skip',
  )
  const grantWelcomeBall = useMutation(
    api.user.mutations.grantWelcomeMysteryPokeBall,
  )

  useEffect(() => {
    if (
      !account.isAuthenticated ||
      account.loading ||
      pokemonCollection === undefined ||
      pokemonCollection.length > 0 ||
      giftAttempted.current
    ) {
      return
    }

    giftAttempted.current = true
    void grantWelcomeBall({})
      .then((granted) => {
        if (granted) {
          snackbar.success(
            'Poké Ball mystère reçue !',
            "Va dans t'es consommables pour l’ouvrir et découvrir ton Pokémon.",
          )
        }
      })
      .catch((error: unknown) => {
        giftAttempted.current = false
        snackbar.error(
          'Poké Ball de bienvenue indisponible',
          error instanceof Error ? error.message : 'Réessaie dans un instant.',
        )
      })
  }, [
    account.isAuthenticated,
    account.loading,
    grantWelcomeBall,
    pokemonCollection,
    snackbar,
  ])

  return (
    <>
      {!account.loading &&
        !account.isAuthenticated &&
        !guestPromptDismissed && (
          <GuestPokemonPrompt
            pending={account.pending}
            canSignIn={account.configured === true}
            onSignIn={() => void account.signIn()}
            onClose={() => setGuestPromptDismissed(true)}
          />
        )}
      {!account.loading && <PokemonEncounterLayer vm={vm} />}
    </>
  )
}

function GuestPokemonPrompt({
  pending,
  canSignIn,
  onSignIn,
  onClose,
}: {
  pending: boolean
  canSignIn: boolean
  onSignIn: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => {
      if (element?.open) element.close()
    }
  }, [])

  return (
    <dialog
      className='pp-modal pp-pokemon-starter-modal'
      ref={dialog}
      aria-labelledby='pokemon-guest-title'
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className='pp-modal-content pp-pokemon-starter-content'>
        <span className='pp-pokemon-starter-kicker'>MODE INVITÉ</span>
        <h2 id='pokemon-guest-title'>Joue avec un Pokémon</h2>
        <p className='pp-pokemon-starter-description'>
          Tu joues en invité. Connecte-toi avec GitHub pour recevoir et
          conserver ta Poké Ball mystère de bienvenue.
        </p>
        <div className='pp-pokemon-starter-actions'>
          <button
            className='pp-button pp-button--secondary'
            type='button'
            onClick={onClose}
          >
            Continuer en invité
          </button>
          <button
            className='pp-button'
            type='button'
            disabled={!canSignIn || pending}
            onClick={onSignIn}
          >
            <GitBranch size={17} aria-hidden='true' />
            {pending ? 'Connexion…' : 'Se connecter avec GitHub'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
