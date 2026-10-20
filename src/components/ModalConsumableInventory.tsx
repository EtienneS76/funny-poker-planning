import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import PokeballOpening from './PokeballOpening'
import { useAccount } from '../features/auth/useAccount'
import { useAppSnackbar } from './AppSnackbar'
import { getPokemonById } from '../features/pokemon/functions/GeneratePokemon'

type Props = {
  onClose: () => void
}

const rarityLabels = [
  ['commun', 'Commun'],
  ['rare', 'Rare'],
  ['epique', 'Épique'],
  ['legendaire', 'Légendaire'],
  ['ultime', 'Ultime'],
] as const
export default function ModalConsumableInventory({ onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [openingPokemonId, setOpeningPokemonId] = useState<number | null>(null)
  const [welcomeRerollsRemaining, setWelcomeRerollsRemaining] = useState<
    number | null
  >(null)
  const [openingBall, setOpeningBall] = useState(false)
  const account = useAccount()
  const snackbar = useAppSnackbar()
  const data = useQuery(api.user.queries.shopData, {})
  const openMysteryPokeBall = useMutation(
    api.user.mutations.openMysteryPokeBall,
  )
  const rerollWelcomeBall = useMutation(
    api.user.mutations.rerollWelcomeMysteryPokeBall,
  )
  const claimWelcomePokemon = useMutation(
    api.user.mutations.claimStarterPokemon,
  )
  const ownedItems =
    data?.consumableInventory.flatMap((ownedItem) => {
      const item = data.consumables.find(
        (catalogItem) => catalogItem.id === ownedItem.consumableId,
      )
      return item ? [{ ...item, quantity: ownedItem.quantity }] : []
    }) ?? []
  const mysteryBallQuantity =
    ownedItems.find((item) => item.id === 'mystery-poke-ball')?.quantity ?? 0

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

  async function openMysteryBall() {
    if (openingBall) return
    setOpeningBall(true)
    try {
      const result = await openMysteryPokeBall({})
      setOpeningPokemonId(result.pokemonId)
      setWelcomeRerollsRemaining(
        result.welcomeGift ? result.rerollsRemaining : null,
      )
    } catch (error) {
      snackbar.error(
        'Ouverture impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setOpeningBall(false)
    }
  }

  async function rerollWelcomePokemon() {
    if (openingBall || welcomeRerollsRemaining === null) return
    setOpeningBall(true)
    try {
      const result = await rerollWelcomeBall({})
      setOpeningPokemonId(result.pokemonId)
      setWelcomeRerollsRemaining(result.rerollsRemaining)
    } catch (error) {
      snackbar.error(
        'Nouvel essai impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setOpeningBall(false)
    }
  }

  async function keepWelcomePokemon() {
    if (openingBall || welcomeRerollsRemaining === null) return
    setOpeningBall(true)
    try {
      const pokemonId = await claimWelcomePokemon({})
      const pokemonName = getPokemonById(pokemonId)?.name
      snackbar.success(
        pokemonName ? `${pokemonName} équipé !` : 'Pokémon équipé !',
        'Ton Pokémon de bienvenue a été ajouté à ta collection.',
      )
      setOpeningPokemonId(null)
      setWelcomeRerollsRemaining(null)
    } catch (error) {
      snackbar.error(
        'Équipement impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setOpeningBall(false)
    }
  }

  function closeOpening() {
    setOpeningPokemonId(null)
    setWelcomeRerollsRemaining(null)
  }

  return (
    <dialog
      className='pp-modal pp-consumable-inventory-modal'
      ref={dialog}
      aria-labelledby='consumable-inventory-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className='pp-modal-content pp-consumable-inventory-content'>
        <div className='pp-modal-heading'>
          <div>
            <span className='pp-inventory-kicker'>TES OBJETS</span>
            <h2 id='consumable-inventory-title'>Inventaire</h2>
          </div>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer l’inventaire'
            title='Fermer'
            onClick={onClose}
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>
        <div
          className='pp-consumable-inventory-tabs'
          role='tablist'
          aria-label='Catégorie d’inventaire'
        >
          <button
            className='pokemon-collection-tab'
            id='consumable-inventory-tab-pokemon'
            type='button'
            role='tab'
            aria-selected='true'
            aria-controls='consumable-inventory-panel-pokemon'
          >
            Pokémon
          </button>
        </div>
        <section
          className='pp-consumable-inventory-list'
          id='consumable-inventory-panel-pokemon'
          role='tabpanel'
          aria-labelledby='consumable-inventory-tab-pokemon'
        >
          {data === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de ton inventaire…
            </p>
          ) : ownedItems.length ? (
            ownedItems.map((item) => (
              <article className='pp-consumable-owned-card' key={item.id}>
                <div className='pp-consumable-owned-art'>
                  <img src={item.sprite} alt='' width={80} height={80} />
                </div>
                <div className='pp-consumable-owned-copy'>
                  <div className='pp-consumable-title'>
                    <h3>{item.name}</h3>
                    <span className='pp-consumable-owned'>
                      Quantité : {item.quantity}
                    </span>
                  </div>
                  <p>{item.description}</p>
                  {item.catchRates && item.id !== 'master-ball' ? (
                    <ul className='pp-consumable-owned-rates'>
                      {rarityLabels.map(([rarity, label]) => (
                        <li key={rarity}>
                          {label} : {item.catchRates?.[rarity]}%
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.id === 'mystery-poke-ball' && (
                    <button
                      className='pp-button pp-consumable-open'
                      type='button'
                      disabled={item.quantity < 1 || openingBall}
                      onClick={() => void openMysteryBall()}
                    >
                      {openingBall ? 'Ouverture…' : 'Ouvrir'}
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className='pp-inventory-empty'>
              Ton inventaire est vide. Tu trouveras des objets Pokémon dans la
              boutique.
            </p>
          )}
        </section>
        {openingPokemonId !== null && (
          <div
            className='pp-pokeball-opening-overlay'
            role='presentation'
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeOpening()
              }
            }}
          >
            <button
              className='pp-icon-button pp-pokeball-opening-close'
              type='button'
              aria-label='Fermer l’ouverture Pokémon'
              title='Fermer'
              onClick={closeOpening}
            >
              <X size={20} aria-hidden='true' />
            </button>
            <PokeballOpening
              key={`${openingPokemonId}-${welcomeRerollsRemaining ?? 'normal'}`}
              pokemonId={openingPokemonId}
              showPokemon3d={account.profile?.showPokemon3d ?? false}
              canOpenAnother={
                welcomeRerollsRemaining !== null
                  ? welcomeRerollsRemaining > 0
                  : mysteryBallQuantity > 0
              }
              rerollsRemaining={welcomeRerollsRemaining}
              onClose={closeOpening}
              onOpenAnother={
                welcomeRerollsRemaining !== null
                  ? rerollWelcomePokemon
                  : openMysteryBall
              }
              onKeepWelcomePokemon={
                welcomeRerollsRemaining !== null
                  ? keepWelcomePokemon
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </dialog>
  )
}
