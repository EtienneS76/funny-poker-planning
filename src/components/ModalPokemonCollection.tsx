import { useEffect, useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AvatarFrame } from '../features/avatar/AvatarFrame'
import { CardDesignPreview } from './CardDesignPreview'
import {
  getPokemonById,
  getPokemonImageUrl,
  type PokemonType,
} from '../features/pokemon/functions/GeneratePokemon'
import { useAccount } from '../features/auth/useAccount'
import { useAppSnackbar } from './AppSnackbar'

type Props = {
  onClose: () => void
}

const KANTO_POKEDEX = Array.from({ length: 151 }, (_, index) =>
  getPokemonById(index + 1),
).flatMap((pokemon) => (pokemon ? [pokemon] : []))

export default function ModalPokemonCollection({ onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const account = useAccount()
  const snackbar = useAppSnackbar()
  const [activeTab, setActiveTab] = useState<
    'general' | 'pokemon' | 'shiny' | 'star-wars'
  >('general')
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null,
  )
  const [selectedShinyPokemonId, setSelectedShinyPokemonId] = useState<
    number | null
  >(null)
  const [assigning, setAssigning] = useState(false)
  const [saving3d, setSaving3d] = useState(false)
  const [pendingCardDesign, setPendingCardDesign] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const collection = useQuery(api.user.queries.pokemonCollection, {})
  const starWarsCollection = useQuery(api.user.queries.starWarsCollection, {})
  const inventory = useQuery(api.user.queries.shopData, {})
  const assignPokemon = useMutation(api.user.mutations.assignPokemon)
  const equipAvatarFrame = useMutation(api.user.mutations.equipAvatarFrame)
  const equipCardDesign = useMutation(api.user.mutations.equipCardDesign)
  const savePokemonPreference = useMutation(
    api.user.mutations.updatePokemonDisplayPreference,
  )
  const showPokemon3d = account.profile?.showPokemon3d ?? false
  const displayName =
    account.profile?.displayName ?? account.user?.username ?? 'Joueur'
  const ownedFrames = inventory?.catalog.filter((frame) =>
    inventory.ownedIds.includes(frame.id),
  )
  const ownedCardDesigns = inventory?.cardDesigns.filter((design) =>
    inventory.ownedCardDesignIds.includes(design.id),
  )
  const equippedCardDesignId = account.profile?.cardDesignId ?? null

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

  const unlockedAtById = new Map(
    (collection ?? [])
      .filter(({ shiny }) => !shiny)
      .map(({ pokemonId, unlockedAt }) => [pokemonId, unlockedAt]),
  )
  const pokedex = KANTO_POKEDEX.map((pokemon) => ({
    ...pokemon,
    unlockedAt: unlockedAtById.get(pokemon.id),
  }))
  const shinyUnlockedAtById = new Map(
    (collection ?? [])
      .filter(({ shiny }) => shiny)
      .map(({ pokemonId, unlockedAt }) => [pokemonId, unlockedAt]),
  )
  const shinyPokedex = KANTO_POKEDEX.flatMap((pokemon) => {
    const unlockedAt = shinyUnlockedAtById.get(pokemon.id)
    return unlockedAt === undefined ? [] : [{ ...pokemon, unlockedAt }]
  })
  const normalizedSearch = search
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr')
    .trim()
  const filteredPokedex = pokedex.filter((pokemon) => {
    if (!normalizedSearch) return true
    if (pokemon.unlockedAt === undefined) {
      return String(pokemon.id).includes(normalizedSearch)
    }
    return [
      pokemon.name,
      String(pokemon.id),
      ...pokemon.types.map(typeLabel),
      rarityLabel(pokemon.rarity),
    ]
      .join(' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('fr')
      .includes(normalizedSearch)
  })
  const filteredShinyPokedex = shinyPokedex.filter((pokemon) => {
    if (!normalizedSearch) return true
    return [pokemon.name, String(pokemon.id), ...pokemon.types.map(typeLabel)]
      .join(' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('fr')
      .includes(normalizedSearch)
  })
  const selectedPokemon =
    pokedex.find(
      ({ id, unlockedAt }) =>
        id === selectedPokemonId && unlockedAt !== undefined,
    ) ?? pokedex.find(({ unlockedAt }) => unlockedAt !== undefined)
  const selectedShinyPokemon =
    shinyPokedex.find(({ id }) => id === selectedShinyPokemonId) ??
    shinyPokedex[0]
  const unlockedCount = pokedex.filter(
    (pokemon) => pokemon.unlockedAt !== undefined,
  ).length
  const pokemonCompletion = Math.round((unlockedCount / 151) * 100)
  const sortedStarWarsCollection = [...(starWarsCollection ?? [])].sort(
    (first, second) => second.openedAt - first.openedAt,
  )
  const uniqueStarWarsCharacters = new Set(
    sortedStarWarsCollection.map(({ characterId }) => characterId),
  ).size
  const starWarsCompletion = Math.round((uniqueStarWarsCharacters / 100) * 100)
  const assignedPokemonId = account.profile?.assignedPokemonId ?? null
  const assignedPokemonShiny = account.profile?.assignedPokemonShiny ?? false
  const [pendingFrame, setPendingFrame] = useState<string | null>(null)

  useEffect(() => {
    if (
      selectedPokemonId === null &&
      collection !== undefined &&
      pokedex.length
    ) {
      setSelectedPokemonId(
        pokedex.find((pokemon) => pokemon.unlockedAt !== undefined)?.id ?? null,
      )
    }
  }, [collection, selectedPokemonId])

  useEffect(() => {
    if (
      selectedShinyPokemonId === null &&
      collection !== undefined &&
      shinyPokedex.length
    ) {
      setSelectedShinyPokemonId(shinyPokedex[0].id)
    }
  }, [collection, selectedShinyPokemonId])

  async function setAssignedPokemon(pokemonId: number | null, shiny = false) {
    setAssigning(true)
    try {
      await assignPokemon({ pokemonId, shiny })
    } catch (error) {
      snackbar.error(
        'Assignation impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setAssigning(false)
    }
  }

  async function setPokemon3d(enabled: boolean) {
    setSaving3d(true)
    try {
      await savePokemonPreference({ showPokemon3d: enabled })
    } catch (error) {
      snackbar.error(
        'Préférence non sauvegardée',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setSaving3d(false)
    }
  }

  async function setEquippedFrame(frameId: string | null) {
    setPendingFrame(frameId ?? 'none')
    try {
      await equipAvatarFrame({ frameId })
      snackbar.success(
        frameId === null ? 'Cadre retiré' : 'Cadre équipé',
        frameId === null
          ? 'Ton avatar utilise maintenant le cadre par défaut.'
          : 'Ton nouveau cadre est appliqué à ton profil.',
      )
    } catch (error) {
      snackbar.error(
        'Impossible de modifier le cadre',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setPendingFrame(null)
    }
  }

  async function setEquippedCardDesign(designId: string | null) {
    setPendingCardDesign(designId ?? 'none')
    try {
      await equipCardDesign({ designId })
      snackbar.success(
        designId ? 'Dos équipé' : 'Dos retiré',
        designId
          ? 'Tes cartes affichent maintenant ce nouveau style.'
          : 'Tes cartes utilisent le style classique.',
      )
    } catch (error) {
      snackbar.error(
        'Impossible de modifier le dos',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setPendingCardDesign(null)
    }
  }

  return (
    <dialog
      className='pp-modal pp-pokemon-collection-modal'
      ref={dialog}
      aria-labelledby='pokemon-collection-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className='pp-modal-content pp-pokemon-collection-content'>
        <div className='pp-modal-heading'>
          <div>
            <h2 id='pokemon-collection-title'>Collection</h2>
          </div>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer la collection'
            title='Fermer'
            onClick={onClose}
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>

        <div
          className='pokemon-collection-tabs'
          role='tablist'
          aria-label='Collection'
        >
          <button
            id='collection-tab-general'
            className='pokemon-collection-tab'
            type='button'
            role='tab'
            aria-selected={activeTab === 'general'}
            aria-controls='collection-panel-general'
            onClick={() => setActiveTab('general')}
          >
            Général
          </button>
          <button
            id='collection-tab-pokemon'
            className='pokemon-collection-tab'
            type='button'
            role='tab'
            aria-selected={activeTab === 'pokemon'}
            aria-controls='collection-panel-pokemon'
            onClick={() => setActiveTab('pokemon')}
          >
            Pokémon{' '}
            <span className='pokemon-collection-tab-progress'>
              ({collection === undefined ? '…' : `${pokemonCompletion}%`})
            </span>
          </button>
          <button
            id='collection-tab-shiny'
            className='pokemon-collection-tab'
            type='button'
            role='tab'
            aria-selected={activeTab === 'shiny'}
            aria-controls='collection-panel-shiny'
            onClick={() => setActiveTab('shiny')}
          >
            Pokémon Shiny{' '}
            <span className='pokemon-collection-tab-progress'>
              ({collection === undefined ? '…' : shinyPokedex.length})
            </span>
          </button>
          <button
            id='collection-tab-star-wars'
            className='pokemon-collection-tab'
            type='button'
            role='tab'
            aria-selected={activeTab === 'star-wars'}
            aria-controls='collection-panel-star-wars'
            onClick={() => setActiveTab('star-wars')}
          >
            Star Wars{' '}
            <span className='pokemon-collection-tab-progress'>
              (
              {starWarsCollection === undefined
                ? '…'
                : `${starWarsCompletion}%`}
              )
            </span>
          </button>
        </div>

        <section
          id='collection-panel-pokemon'
          className='pokemon-collection-panel'
          role='tabpanel'
          aria-labelledby='collection-tab-pokemon'
          hidden={activeTab !== 'pokemon'}
        >
          {collection === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de ta collection…
            </p>
          ) : (
            <>
              <div className='pokedex-toolbar'>
                <label className='pokedex-search' htmlFor='pokedex-search'>
                  <Search size={18} aria-hidden='true' />
                  <input
                    id='pokedex-search'
                    type='search'
                    value={search}
                    placeholder='Pokémon possédé : nom, type, ou numéro'
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label
                  className='pokemon-collection-3d-switch'
                  title='Afficher tous les Pokémon de la salle en animé'
                >
                  <span>Pokémons animés</span>
                  <input
                    type='checkbox'
                    role='switch'
                    aria-label='Afficher tous les Pokémon de la salle en animé'
                    checked={showPokemon3d}
                    disabled={saving3d}
                    onChange={(event) =>
                      void setPokemon3d(event.currentTarget.checked)
                    }
                  />
                </label>
                <span className='pokedex-progress pokemon-collection-progress'>
                  <strong>{unlockedCount}</strong> / 151 obtenus
                </span>
              </div>
              <div className='pokemon-collection-grid' aria-label='Pokédex'>
                {filteredPokedex.map((pokemon) => (
                  <button
                    className={`pokemon-collection-card${selectedPokemon?.id === pokemon.id ? ' pokemon-collection-card--selected' : ''}${pokemon.unlockedAt === undefined ? ' pokemon-collection-card--locked' : ''}`}
                    key={pokemon.id}
                    type='button'
                    aria-label={
                      pokemon.unlockedAt === undefined
                        ? `Pokémon non débloqué, numéro ${String(pokemon.id).padStart(3, '0')}`
                        : `${pokemon.name}, numéro ${String(pokemon.id).padStart(3, '0')}`
                    }
                    aria-pressed={
                      pokemon.unlockedAt !== undefined &&
                      selectedPokemon?.id === pokemon.id
                    }
                    disabled={pokemon.unlockedAt === undefined}
                    onClick={() => setSelectedPokemonId(pokemon.id)}
                  >
                    {pokemon.unlockedAt === undefined ? (
                      <span className='pokemon-collection-number'>
                        #{String(pokemon.id).padStart(3, '0')}
                      </span>
                    ) : (
                      <>
                        <img
                          src={getPokemonImageUrl(pokemon.id, showPokemon3d)}
                          alt=''
                          width={80}
                          height={80}
                          loading='lazy'
                        />
                        <strong>{pokemon.name}</strong>
                        <span className='pokemon-collection-number'>
                          #{String(pokemon.id).padStart(3, '0')}
                        </span>
                        <span className='pokemon-collection-types'>
                          {pokemon.types.map((type) => (
                            <span
                              className={`pokemon-type pokemon-type--${type}`}
                              key={type}
                            >
                              {typeLabel(type)}
                            </span>
                          ))}
                        </span>
                        {assignedPokemonId === pokemon.id &&
                          !assignedPokemonShiny && (
                          <span className='pokemon-collection-assigned'>
                            <Check size={14} aria-hidden='true' /> Équipé
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
              {filteredPokedex.length === 0 && (
                <p className='pp-inventory-empty'>
                  Aucun Pokémon ne correspond à « {search} ».
                </p>
              )}
              {unlockedCount === 0 && (
                <p className='pp-inventory-empty'>
                  Aucun Pokémon débloqué pour le moment. Les numéros restent
                  affichés dans le Pokédex.
                </p>
              )}
              {selectedPokemon && (
                <article className='pokemon-collection-detail'>
                  <img
                    src={getPokemonImageUrl(selectedPokemon.id, showPokemon3d)}
                    alt=''
                    width={192}
                    height={192}
                  />
                  <div className='pokemon-collection-detail-copy'>
                    <span className='pokemon-collection-detail-kicker'>
                      POKÉDEX #{String(selectedPokemon.id).padStart(3, '0')}
                    </span>
                    <h3>{selectedPokemon.name}</h3>
                    <div className='pokemon-collection-types'>
                      {selectedPokemon.types.map((type) => (
                        <span
                          className={`pokemon-type pokemon-type--${type}`}
                          key={type}
                        >
                          {typeLabel(type)}
                        </span>
                      ))}
                    </div>
                    <dl>
                      <div>
                        <dt>Rareté</dt>
                        <dd>{rarityLabel(selectedPokemon.rarity)}</dd>
                      </div>
                      <div>
                        <dt>Récupéré le</dt>
                        <dd>
                          {selectedPokemon.unlockedAt === undefined
                            ? 'Pas encore capturé'
                            : new Date(
                                selectedPokemon.unlockedAt,
                              ).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                        </dd>
                      </div>
                    </dl>
                    {selectedPokemon.unlockedAt === undefined ? (
                      <p className='pokemon-collection-locked-note'>
                        Débloque ce Pokémon pour l’équiper et jouer avec.
                      </p>
                    ) :
                    assignedPokemonId === selectedPokemon.id &&
                    !assignedPokemonShiny ? (
                      <button
                        className='pokemon-collection-assign'
                        type='button'
                        disabled={assigning}
                        onClick={() => void setAssignedPokemon(null)}
                      >
                        {assigning ? 'Mise à jour…' : 'Déséquiper'}
                      </button>
                    ) : (
                      <button
                        className='pokemon-collection-assign'
                        type='button'
                        disabled={assigning}
                        onClick={() =>
                          void setAssignedPokemon(selectedPokemon.id)
                        }
                      >
                        {assigning ? 'Équipement…' : 'Équiper'}
                      </button>
                    )}
                  </div>
                </article>
              )}
            </>
          )}
        </section>
        <section
          id='collection-panel-shiny'
          className='pokemon-collection-panel'
          role='tabpanel'
          aria-labelledby='collection-tab-shiny'
          hidden={activeTab !== 'shiny'}
        >
          {collection === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de tes Pokémon shiny…
            </p>
          ) : (
            <>
              <div className='pokedex-toolbar'>
                <label
                  className='pokedex-search'
                  htmlFor='shiny-pokedex-search'
                >
                  <Search size={18} aria-hidden='true' />
                  <input
                    id='shiny-pokedex-search'
                    type='search'
                    value={search}
                    placeholder='Rechercher un shiny par nom ou numéro'
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <span className='pokedex-progress'>
                  <strong>{shinyPokedex.length}</strong>{' '}
                  {shinyPokedex.length === 1 ? 'shiny obtenu' : 'shiny obtenus'}
                </span>
                <label
                  className='pokemon-collection-3d-switch'
                  title='Afficher les Pokémon shiny en animé'
                >
                  <span>Pokémons animés</span>
                  <input
                    type='checkbox'
                    role='switch'
                    aria-label='Afficher les Pokémon shiny en animé'
                    checked={showPokemon3d}
                    disabled={saving3d}
                    onChange={(event) =>
                      void setPokemon3d(event.currentTarget.checked)
                    }
                  />
                </label>
              </div>
              <div
                className='pokemon-collection-grid'
                aria-label='Pokédex Shiny'
              >
                {filteredShinyPokedex.map((pokemon) => (
                  <button
                    className={`pokemon-collection-card pokemon-collection-card--shiny${selectedShinyPokemon?.id === pokemon.id ? ' pokemon-collection-card--selected' : ''}`}
                    key={pokemon.id}
                    type='button'
                    aria-label={`${pokemon.name} shiny, numéro ${String(pokemon.id).padStart(3, '0')}`}
                    aria-pressed={selectedShinyPokemon?.id === pokemon.id}
                    onClick={() => setSelectedShinyPokemonId(pokemon.id)}
                  >
                    <img
                      src={getPokemonImageUrl(pokemon.id, showPokemon3d, true)}
                      alt=''
                      width={80}
                      height={80}
                      loading='lazy'
                    />
                    <strong>{pokemon.name}</strong>
                    <span className='pokemon-collection-number'>
                      Shiny · #{String(pokemon.id).padStart(3, '0')}
                    </span>
                    {assignedPokemonId === pokemon.id &&
                      assignedPokemonShiny && (
                        <span className='pokemon-collection-assigned'>
                          <Check size={14} aria-hidden='true' /> Équipé
                        </span>
                      )}
                    <span className='pokemon-collection-types'>
                      {pokemon.types.map((type) => (
                        <span
                          className={`pokemon-type pokemon-type--${type}`}
                          key={type}
                        >
                          {typeLabel(type)}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              {filteredShinyPokedex.length === 0 && (
                <p className='pp-inventory-empty'>
                  {shinyPokedex.length === 0
                    ? 'Aucun Pokémon shiny pour le moment.'
                    : `Aucun shiny ne correspond à « ${search} ».`}
                </p>
              )}
              {selectedShinyPokemon && (
                <article className='pokemon-collection-detail pokemon-collection-detail--shiny'>
                  <img
                    src={getPokemonImageUrl(
                      selectedShinyPokemon.id,
                      showPokemon3d,
                      true,
                    )}
                    alt=''
                    width={192}
                    height={192}
                  />
                  <div className='pokemon-collection-detail-copy'>
                    <span className='pokemon-collection-detail-kicker'>
                      POKÉDEX SHINY #
                      {String(selectedShinyPokemon.id).padStart(3, '0')}
                    </span>
                    <h3>{selectedShinyPokemon.name}</h3>
                    <div className='pokemon-collection-types'>
                      {selectedShinyPokemon.types.map((type) => (
                        <span
                          className={`pokemon-type pokemon-type--${type}`}
                          key={type}
                        >
                          {typeLabel(type)}
                        </span>
                      ))}
                    </div>
                    <dl>
                      <div>
                        <dt>Rareté</dt>
                        <dd>{rarityLabel(selectedShinyPokemon.rarity)}</dd>
                      </div>
                      <div>
                        <dt>Récupéré le</dt>
                        <dd>
                          {new Date(selectedShinyPokemon.unlockedAt).toLocaleDateString(
                            'fr-FR',
                            {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            },
                          )}
                        </dd>
                      </div>
                    </dl>
                    {assignedPokemonId === selectedShinyPokemon.id &&
                    assignedPokemonShiny ? (
                      <button
                        className='pokemon-collection-assign'
                        type='button'
                        disabled={assigning}
                        onClick={() => void setAssignedPokemon(null)}
                      >
                        {assigning ? 'Mise à jour…' : 'Déséquiper'}
                      </button>
                    ) : (
                      <button
                        className='pokemon-collection-assign'
                        type='button'
                        disabled={assigning}
                        onClick={() =>
                          void setAssignedPokemon(selectedShinyPokemon.id, true)
                        }
                      >
                        {assigning ? 'Équipement…' : 'Équiper'}
                      </button>
                    )}
                  </div>
                </article>
              )}
            </>
          )}
        </section>
        <section
          id='collection-panel-star-wars'
          className='pokemon-collection-panel star-wars-collection-panel'
          role='tabpanel'
          aria-labelledby='collection-tab-star-wars'
          hidden={activeTab !== 'star-wars'}
        >
          {starWarsCollection === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de ta collection Star Wars…
            </p>
          ) : starWarsCollection.length === 0 ? (
            <p className='pp-inventory-empty'>
              Aucune carte pour le moment. Ouvre un Holocron depuis tes
              consommables pour en obtenir une.
            </p>
          ) : (
            <>
              <div className='pokedex-toolbar'>
                <span className='pokedex-progress'>
                  <strong>{starWarsCollection.length}</strong> / 100{' '}
                  {starWarsCollection.length === 1 ? 'carte' : 'cartes'} obtenue
                  {starWarsCollection.length === 1 ? '' : 's'}
                </span>
              </div>
              <div
                className='pokemon-collection-grid star-wars-collection-grid'
                role='list'
                aria-label='Collection Star Wars'
              >
                {sortedStarWarsCollection.map((character) => (
                  <article
                    className='pokemon-collection-card star-wars-collection-card'
                    key={character.recordId}
                    role='listitem'
                  >
                    <img
                      src={character.imageUrl}
                      alt=''
                      width={80}
                      height={80}
                      loading='lazy'
                    />
                    <strong>{character.name}</strong>
                    <span className='pokemon-collection-number'>
                      Obtenu le{' '}
                      {new Date(character.openedAt).toLocaleDateString(
                        'fr-FR',
                        { day: 'numeric', month: 'long', year: 'numeric' },
                      )}
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
        <section
          id='collection-panel-general'
          className='pokemon-collection-panel pokemon-frame-panel'
          role='tabpanel'
          aria-labelledby='collection-tab-general'
          hidden={activeTab !== 'general'}
        >
          {inventory === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de ta collection…
            </p>
          ) : (
            <div className='pp-collection-general'>
              <section
                className='pp-collection-general-section'
                aria-labelledby='collection-frames-title'
              >
                <div className='pp-shop-section-heading'>
                  <h3 id='collection-frames-title'>Cadres</h3>
                </div>
                {ownedFrames?.length ? (
                  <div className='pp-frame-grid'>
                    {ownedFrames.map((frame) => {
                      const isEquipped = inventory.equippedId === frame.id
                      return (
                        <article className='pp-frame-card' key={frame.id}>
                          <div className='pp-frame-preview'>
                            <AvatarFrame
                              frameId={frame.id}
                              className='pp-frame-avatar'
                            >
                              <span
                                className='pp-frame-avatar-initial'
                                aria-hidden='true'
                              >
                                {displayName.slice(0, 1).toUpperCase()}
                              </span>
                              {account.user?.avatarUrl && (
                                <img
                                  className='pp-frame-avatar-image'
                                  src={account.user.avatarUrl}
                                  alt=''
                                />
                              )}
                            </AvatarFrame>
                          </div>
                          <div className='pp-frame-copy'>
                            <strong>{frame.name}</strong>
                            <p>{frame.description}</p>
                          </div>
                          {isEquipped ? (
                            <button
                              className='pp-button pp-button--secondary pp-frame-action'
                              type='button'
                              disabled={pendingFrame !== null}
                              onClick={() => void setEquippedFrame(null)}
                            >
                              {pendingFrame === 'none' ? 'Retrait…' : 'Retirer'}
                            </button>
                          ) : (
                            <button
                              className='pp-button pp-frame-action'
                              type='button'
                              disabled={pendingFrame !== null}
                              onClick={() => void setEquippedFrame(frame.id)}
                            >
                              {pendingFrame === frame.id
                                ? 'Équipement…'
                                : 'Équiper'}
                            </button>
                          )}
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className='pp-inventory-empty'>
                    Aucun cadre pour le moment. Tes prochains cadres apparaîtront ici.
                  </p>
                )}
              </section>
              <section
                className='pp-collection-general-section'
                aria-labelledby='collection-card-designs-title'
              >
                <div className='pp-shop-section-heading'>
                  <h3 id='collection-card-designs-title'>Dos de carte</h3>
                  <p>Équipe le motif qui apparaîtra sur tes cartes pendant le vote.</p>
                </div>
                {ownedCardDesigns?.length ? (
                  <div className='pp-card-design-owned-grid'>
                    {ownedCardDesigns.map((design) => {
                      const isEquipped = equippedCardDesignId === design.id
                      return (
                        <article
                          className={`pp-card-design-owned-card${isEquipped ? ' pp-card-design-owned-card--equipped' : ''}`}
                          key={design.id}
                        >
                          <CardDesignPreview design={design} />
                          <div className='pp-card-design-owned-copy'>
                            <strong>{design.name}</strong>
                            <p>{design.description}</p>
                            <span className='pp-card-design-owned-status'>
                              {isEquipped ? 'Équipé' : 'Possédé'}
                            </span>
                          </div>
                          <button
                            className={`pp-button pp-card-design-owned-action${isEquipped ? ' pp-button--secondary' : ''}`}
                            type='button'
                            disabled={pendingCardDesign !== null}
                            onClick={() =>
                              void setEquippedCardDesign(
                                isEquipped ? null : design.id,
                              )
                            }
                          >
                            {pendingCardDesign === design.id
                              ? 'Équipement…'
                              : pendingCardDesign === 'none' && isEquipped
                                ? 'Retrait…'
                                : isEquipped
                                  ? 'Retirer'
                                  : 'Équiper'}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className='pp-inventory-empty'>
                    Aucun dos de carte pour le moment. Découvre les designs dans la boutique.
                  </p>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </dialog>
  )
}

function rarityLabel(rarity: string) {
  switch (rarity) {
    case 'commun':
      return 'Commun'
    case 'rare':
      return 'Rare'
    case 'epique':
      return 'Épique'
    case 'legendaire':
      return 'Légendaire'
    case 'ultime':
      return 'Ultime'
    default:
      return rarity
  }
}

const typeLabels: Record<PokemonType, string> = {
  normal: 'Normal',
  combat: 'Combat',
  vol: 'Vol',
  poison: 'Poison',
  sol: 'Sol',
  roche: 'Roche',
  insecte: 'Insecte',
  spectre: 'Spectre',
  acier: 'Acier',
  feu: 'Feu',
  eau: 'Eau',
  plante: 'Plante',
  electrik: 'Électrik',
  psy: 'Psy',
  glace: 'Glace',
  dragon: 'Dragon',
  tenebres: 'Ténèbres',
  fee: 'Fée',
}

function typeLabel(type: PokemonType) {
  return typeLabels[type]
}
