import { useEffect, useRef, useState } from 'react'
import { Hexagon, Store, X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import PokeballOpening from './PokeballOpening'
import StarWarsOpening from '../features/refinement/themes/star-wars/StarWarsOpening'
import type { StarWarsCharacter } from '../features/refinement/themes/star-wars/getStarWarsAvatar'
import { getRandomStarWarsAvatar } from '../features/refinement/themes/star-wars/getStarWarsAvatar'
import { useAccount } from '../features/auth/useAccount'
import { useAppSnackbar } from './AppSnackbar'
import { getPokemonById } from '../features/pokemon/functions/GeneratePokemon'

type Props = {
  onClose: () => void
  onOpenShop: (tab: 'pokemon' | 'star-wars') => void
}

const rarityLabels = [
  ['commun', 'Commun'],
  ['rare', 'Rare'],
  ['epique', 'Épique'],
  ['legendaire', 'Légendaire'],
  ['ultime', 'Ultime'],
] as const
export default function ModalConsumableInventory({
  onClose,
  onOpenShop,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [openingPokemonId, setOpeningPokemonId] = useState<number | null>(null)
  const [openingPokemonShiny, setOpeningPokemonShiny] = useState(false)
  const [openingPokemonBall, setOpeningPokemonBall] = useState<
    'mystery' | 'shiny'
  >('mystery')
  const [openingCharacter, setOpeningCharacter] =
    useState<StarWarsCharacter | null>(null)
  const [openingRun, setOpeningRun] = useState(0)
  const [openingHolocronsRemaining, setOpeningHolocronsRemaining] = useState(0)
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
  const openShinyPokeBall = useMutation(api.user.mutations.openShinyPokeBall)
  const rerollWelcomeBall = useMutation(
    api.user.mutations.rerollWelcomeMysteryPokeBall,
  )
  const claimWelcomePokemon = useMutation(
    api.user.mutations.claimStarterPokemon,
  )
  const openHolocronMutation = useMutation(api.user.mutations.openHolocron)
  const ownedItems =
    data?.consumableInventory.flatMap((ownedItem) => {
      const item = data.consumables.find(
        (catalogItem) => catalogItem.id === ownedItem.consumableId,
      )
      return item ? [{ ...item, quantity: ownedItem.quantity }] : []
    }) ?? []
  const mysteryBallQuantity =
    ownedItems.find((item) => item.id === 'mystery-poke-ball')?.quantity ?? 0
  const shinyBallQuantity =
    ownedItems.find((item) => item.id === 'shiny-poke-ball')?.quantity ?? 0
  const holocronQuantity =
    ownedItems.find((item) => item.id === 'holocron')?.quantity ?? 0
  const pokemonItems = ownedItems.filter((item) => item.id !== 'holocron')
  const starWarsItems = ownedItems.filter((item) => item.id === 'holocron')

  function renderOwnedItem(item: (typeof ownedItems)[number]) {
    return (
      <article className='pp-consumable-owned-card' key={item.id}>
        <div className='pp-consumable-owned-art'>
          {item.id === 'holocron' ? (
            <Hexagon
              className='pp-consumable-holocron-icon'
              size={52}
              strokeWidth={1.5}
              aria-hidden='true'
            />
          ) : (
            <img src={item.sprite} alt='' width={80} height={80} />
          )}
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
          {(item.id === 'mystery-poke-ball' ||
            item.id === 'shiny-poke-ball') && (
            <button
              className='pp-button pp-consumable-open'
              type='button'
              disabled={item.quantity < 1 || openingBall}
              onClick={() =>
                void (item.id === 'shiny-poke-ball'
                  ? openShinyBall()
                  : openMysteryBall())
              }
            >
              {openingBall ? 'Ouverture…' : 'Ouvrir'}
            </button>
          )}
          {item.id === 'holocron' && (
            <button
              className='pp-button pp-consumable-open'
              type='button'
              disabled={item.quantity < 1 || openingBall}
              onClick={() => void prepareHolocron()}
            >
              {openingBall ? 'Préparation…' : 'Ouvrir'}
            </button>
          )}
        </div>
      </article>
    )
  }

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
      setOpeningPokemonShiny(result.shiny)
      setOpeningPokemonBall('mystery')
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

  async function openShinyBall() {
    if (openingBall) return
    setOpeningBall(true)
    try {
      const result = await openShinyPokeBall({})
      setOpeningPokemonId(result.pokemonId)
      setOpeningPokemonShiny(result.shiny)
      setOpeningPokemonBall('shiny')
      setWelcomeRerollsRemaining(null)
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
      setOpeningPokemonShiny(result.shiny)
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

  async function prepareHolocron() {
    if (openingBall) return
    setOpeningBall(true)
    try {
      const character = await getRandomStarWarsAvatar()
      setOpeningHolocronsRemaining(holocronQuantity)
      setOpeningCharacter(character)
      setOpeningRun((run) => run + 1)
    } catch (error) {
      snackbar.error(
        'Préparation impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setOpeningBall(false)
    }
  }

  async function openPreparedHolocron() {
    if (openingBall || !openingCharacter) return openingHolocronsRemaining
    setOpeningBall(true)
    try {
      const remainingHolocrons = await openHolocronMutation({
        characterId: openingCharacter.id,
        name: openingCharacter.name,
        imageUrl: openingCharacter.imageUrl,
        ...(openingCharacter.description
          ? { description: openingCharacter.description }
          : {}),
      })
      setOpeningHolocronsRemaining(remainingHolocrons)
      return remainingHolocrons
    } catch (error) {
      snackbar.error(
        'Ouverture impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
      throw error
    } finally {
      setOpeningBall(false)
    }
  }

  async function prepareAnotherHolocron() {
    if (openingBall || openingHolocronsRemaining < 1) return
    setOpeningBall(true)
    try {
      const character = await getRandomStarWarsAvatar()
      setOpeningCharacter(character)
      setOpeningRun((run) => run + 1)
    } catch (error) {
      snackbar.error(
        'Préparation impossible',
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
      setOpeningPokemonShiny(false)
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
    setOpeningPokemonShiny(false)
    setOpeningPokemonBall('mystery')
    setOpeningCharacter(null)
    setOpeningHolocronsRemaining(0)
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
            <h2 id='consumable-inventory-title'>Consommable</h2>
          </div>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer les consommables'
            title='Fermer'
            onClick={onClose}
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>
        <section
          className='pp-consumable-inventory-list'
          aria-label='Consommables'
        >
          {data === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de tes consommables...
            </p>
          ) : (
            <>
              <section
                className='pp-consumable-inventory-section'
                aria-labelledby='consumable-pokemon-title'
              >
                <h3 id='consumable-pokemon-title'>Pokémon</h3>
                {pokemonItems.length ? (
                  pokemonItems.map(renderOwnedItem)
                ) : (
                  <p className='pp-inventory-empty'>
                    Aucun consommable disponible.
                  </p>
                )}
              </section>
              <section
                className='pp-consumable-inventory-section pp-consumable-inventory-section--star-wars'
                aria-labelledby='consumable-star-wars-title'
              >
                <h3 id='consumable-star-wars-title'>Star Wars</h3>
                {starWarsItems.length ? (
                  starWarsItems.map(renderOwnedItem)
                ) : (
                  <p className='pp-inventory-empty'>
                    Aucun Holocron de disponible.
                  </p>
                )}
              </section>
            </>
          )}
        </section>
        <button
          className='pp-button pp-button--secondary pp-inventory-shop-link'
          type='button'
          onClick={() => onOpenShop('pokemon')}
        >
          <Store size={17} aria-hidden='true' />
          Se rendre à la boutique
        </button>
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
              key={`${openingPokemonId}-${openingPokemonBall}-${welcomeRerollsRemaining ?? 'normal'}`}
              pokemonId={openingPokemonId}
              shiny={openingPokemonShiny}
              showPokemon3d={account.profile?.showPokemon3d ?? false}
              canOpenAnother={
                welcomeRerollsRemaining !== null
                  ? welcomeRerollsRemaining > 0
                  : openingPokemonBall === 'shiny'
                    ? shinyBallQuantity > 0
                    : mysteryBallQuantity > 0
              }
              rerollsRemaining={welcomeRerollsRemaining}
              onClose={closeOpening}
              onOpenAnother={
                welcomeRerollsRemaining !== null
                  ? rerollWelcomePokemon
                  : openingPokemonBall === 'shiny'
                    ? openShinyBall
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
        {openingCharacter && (
          <div
            className='pp-star-wars-opening-overlay'
            role='presentation'
            onClick={(event) => {
              if (event.target === event.currentTarget) closeOpening()
            }}
          >
            <button
              className='pp-icon-button pp-pokeball-opening-close'
              type='button'
              aria-label='Fermer la carte Star Wars'
              title='Fermer'
              onClick={closeOpening}
            >
              <X size={20} aria-hidden='true' />
            </button>
            <StarWarsOpening
              key={openingRun}
              character={openingCharacter}
              remainingHolocrons={openingHolocronsRemaining}
              openingAnother={openingBall}
              onOpen={openPreparedHolocron}
              onOpenAnother={() => void prepareAnotherHolocron()}
              onReturnToInventory={closeOpening}
            />
          </div>
        )}
      </div>
    </dialog>
  )
}
