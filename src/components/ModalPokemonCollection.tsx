import { useEffect, useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AvatarFrame } from '../features/avatar/AvatarFrame'
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
  const [activeTab, setActiveTab] = useState<'frames' | 'pokemon'>('frames')
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null,
  )
  const [assigning, setAssigning] = useState(false)
  const [saving3d, setSaving3d] = useState(false)
  const [search, setSearch] = useState('')
  const collection = useQuery(api.user.queries.pokemonCollection, {})
  const inventory = useQuery(api.user.queries.shopData, {})
  const assignPokemon = useMutation(api.user.mutations.assignPokemon)
  const equipAvatarFrame = useMutation(api.user.mutations.equipAvatarFrame)
  const savePokemonPreference = useMutation(
    api.user.mutations.updatePokemonDisplayPreference,
  )
  const showPokemon3d = account.profile?.showPokemon3d ?? false
  const displayName =
    account.profile?.displayName ?? account.user?.username ?? 'Joueur'
  const ownedFrames = inventory?.catalog.filter((frame) =>
    inventory.ownedIds.includes(frame.id),
  )

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
    (collection ?? []).map(({ pokemonId, unlockedAt }) => [
      pokemonId,
      unlockedAt,
    ]),
  )
  const pokedex = KANTO_POKEDEX.map((pokemon) => ({
    ...pokemon,
    unlockedAt: unlockedAtById.get(pokemon.id),
  }))
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
  const selectedPokemon =
    pokedex.find(
      ({ id, unlockedAt }) =>
        id === selectedPokemonId && unlockedAt !== undefined,
    ) ?? pokedex.find(({ unlockedAt }) => unlockedAt !== undefined)
  const unlockedCount = pokedex.filter(
    (pokemon) => pokemon.unlockedAt !== undefined,
  ).length
  const assignedPokemonId = account.profile?.assignedPokemonId ?? null
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

  async function setAssignedPokemon(pokemonId: number | null) {
    setAssigning(true)
    try {
      await assignPokemon({ pokemonId })
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
            <span className='pp-inventory-kicker'>TON PROFIL</span>
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
            id='collection-tab-frames'
            className='pokemon-collection-tab'
            type='button'
            role='tab'
            aria-selected={activeTab === 'frames'}
            aria-controls='collection-panel-frames'
            onClick={() => setActiveTab('frames')}
          >
            Cadre
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
            Pokémon
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
                  <span>Pokémons animés dans la salle</span>
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
                  <strong>{unlockedCount}</strong> / 151 capturés
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
                        {assignedPokemonId === pokemon.id && (
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
                        <dt>Débloqué le</dt>
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
                    ) : assignedPokemonId === selectedPokemon.id ? (
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
          id='collection-panel-frames'
          className='pokemon-collection-panel pokemon-frame-panel'
          role='tabpanel'
          aria-labelledby='collection-tab-frames'
          hidden={activeTab !== 'frames'}
        >
          {inventory === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de tes cadres…
            </p>
          ) : ownedFrames?.length ? (
            <>
              <p className='pokemon-frame-intro'>
                Cadres disponibles pour ton avatar
              </p>
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
            </>
          ) : (
            <p className='pp-inventory-empty'>
              Aucun cadre pour le moment. Tes prochains cadres apparaîtront ici.
            </p>
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
