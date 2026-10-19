import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  CircleDot,
  Swords,
  X,
} from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { useAppSnackbar } from '../../../../components/AppSnackbar'
import TallGrass from '../../../pokemon/components/Tallgrass'
import {
  getPokemonById,
  getPokemonImageUrl,
  type PokemonRarity,
} from '../../../pokemon/functions/GeneratePokemon'
import type { RoomProps } from '../types'

type CaptureBallId = 'poke-ball' | 'hyper-ball' | 'master-ball'
type Encounter = { pokemonId: number }
type ActionAnimation = 'attack' | 'capture' | null

const captureBallIds: CaptureBallId[] = [
  'poke-ball',
  'hyper-ball',
  'master-ball',
]

const rarityLabels: Record<PokemonRarity, string> = {
  commun: 'Commun',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
  ultime: 'Ultime',
}

export function PokemonEncounterLayer({ vm }: RoomProps) {
  const { account } = vm
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [choosingBall, setChoosingBall] = useState(false)
  const [busy, setBusy] = useState(false)
  const [animation, setAnimation] = useState<ActionAnimation>(null)
  const snackbar = useAppSnackbar()
  const inventory = useQuery(api.user.queries.shopData, {})
  const startEncounter = useMutation(
    api.user.mutations.startPokemonEncounter,
  )
  const attackWildPokemon = useMutation(
    api.user.mutations.attackWildPokemon,
  )
  const throwCaptureBall = useMutation(
    api.user.mutations.throwCaptureBall,
  )

  async function findPokemon() {
    if (busy || encounter) return
    setBusy(true)
    try {
      const result = await startEncounter({ guestId: account.guestId })
      setEncounter(result)
      setChoosingBall(false)
    } catch (error) {
      snackbar.error(
        'Rencontre impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setBusy(false)
    }
  }

  function finishEncounter() {
    window.setTimeout(() => {
      setEncounter(null)
      setChoosingBall(false)
      setAnimation(null)
      setBusy(false)
    }, 850)
  }

  async function attack() {
    if (!encounter || busy) return
    setBusy(true)
    setAnimation('attack')
    try {
      const result = await attackWildPokemon({ guestId: account.guestId })
      if (result.won) {
        snackbar.success('Combat gagné !', 'Le Pokémon sauvage a été vaincu.')
      } else {
        snackbar.info(
          'Le Pokémon s’est enfui !',
          'L’herbe frémira à nouveau pour une prochaine rencontre.',
        )
      }
      finishEncounter()
    } catch (error) {
      setAnimation(null)
      setBusy(false)
      snackbar.error(
        'Combat impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    }
  }

  async function capture(consumableId: CaptureBallId) {
    if (!encounter || busy) return
    setBusy(true)
    setAnimation('capture')
    try {
      const result = await throwCaptureBall({ consumableId })
      if (result.captured) {
        snackbar.success(
          'Pokémon capturé !',
          'Il a été ajouté à ta collection.',
        )
      } else {
        snackbar.info(
          'Capture ratée',
          `Le Pokémon s’est enfui. La Poké Ball a été utilisée (${result.captureChance}% de chance).`,
        )
      }
      finishEncounter()
    } catch (error) {
      setAnimation(null)
      setBusy(false)
      snackbar.error(
        'Capture impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    }
  }

  const pokemon = encounter ? getPokemonById(encounter.pokemonId) : null
  const ownedBalls = inventory?.consumableInventory ?? []

  return (
    <div className='pokemon-encounter-layer'>
      {encounter && pokemon && (
        <section
          className='pokemon-encounter-menu'
          aria-labelledby='pokemon-encounter-title'
          aria-busy={busy}
        >
          <button
            className='pokemon-encounter-close'
            type='button'
            aria-label='Fermer la rencontre'
            disabled={busy}
            onClick={() => {
              setEncounter(null)
              setChoosingBall(false)
            }}
          >
            <X size={17} aria-hidden='true' />
          </button>
          <div className='pokemon-encounter-discovery'>
            <div className='pokemon-encounter-art-frame'>
              <img
                className={`pokemon-encounter-art${animation === 'attack' ? ' pokemon-encounter-art--attack' : ''}${animation === 'capture' ? ' pokemon-encounter-art--capture' : ''}`}
                src={getPokemonImageUrl(
                  pokemon.id,
                  account.profile?.showPokemon3d ?? false,
                )}
                alt={pokemon.name}
                onError={(event) => {
                  const image = event.currentTarget
                  if (
                    account.profile?.showPokemon3d &&
                    !image.dataset.fallback
                  ) {
                    image.dataset.fallback = 'true'
                    image.src = getPokemonImageUrl(pokemon.id, false)
                  }
                }}
              />
              {animation === 'capture' && (
                <span
                  className='pokemon-encounter-capture-ball'
                  aria-hidden='true'
                />
              )}
            </div>
            <div className='pokemon-encounter-name'>
              <span>POKÉMON SAUVAGE</span>
              <h2 id='pokemon-encounter-title'>{pokemon.name}</h2>
              <span
                className={`pokemon-encounter-rarity pokemon-encounter-rarity--${pokemon.rarity}`}
              >
                {rarityLabels[pokemon.rarity]}
              </span>
            </div>
          </div>

          {choosingBall ? (
            <div className='pokemon-encounter-choice'>
              <button
                className='pokemon-encounter-back'
                type='button'
                disabled={busy}
                onClick={() => setChoosingBall(false)}
              >
                <ArrowLeft size={15} aria-hidden='true' /> Retour
              </button>
              <strong>Choisis une Poké Ball</strong>
              {!account.isAuthenticated ? (
                <div className='pokemon-encounter-guest'>
                  <p className='pokemon-encounter-empty'>
                    Connecte-toi pour conserver un Pokémon capturé.
                  </p>
                  <button
                    className='pokemon-encounter-sign-in'
                    type='button'
                    disabled={account.pending || account.configured !== true}
                    onClick={() => void account.signIn()}
                  >
                    {account.pending ? 'Connexion…' : 'Se connecter avec GitHub'}
                  </button>
                </div>
              ) : (
                <div className='pokemon-encounter-balls'>
                  {captureBallIds.map((ballId) => {
                    const ball = inventory?.consumables.find(
                      (item) => item.id === ballId,
                    )
                    const quantity =
                      ownedBalls.find((item) => item.consumableId === ballId)
                        ?.quantity ?? 0
                    const chance =
                      ball?.catchRates?.[pokemon.rarity] ?? 0
                    return (
                      <button
                        className='pokemon-encounter-ball'
                        key={ballId}
                        type='button'
                        disabled={busy || quantity < 1}
                        onClick={() => void capture(ballId)}
                      >
                        <img src={ball?.sprite} alt='' />
                        <span>
                          <strong>{ball?.name ?? 'Poké Ball'}</strong>
                          <small>{chance}% de chance · x{quantity}</small>
                        </span>
                        <CircleDot size={18} aria-hidden='true' />
                      </button>
                    )
                  })}
                  {inventory !== undefined &&
                    captureBallIds.every(
                      (ballId) =>
                        (ownedBalls.find(
                          (item) => item.consumableId === ballId,
                        )?.quantity ?? 0) < 1,
                    ) && (
                      <p className='pokemon-encounter-empty'>
                        Tu n’as aucune Poké Ball. Passe à la boutique pour en
                        acheter.
                      </p>
                    )}
                </div>
              )}
            </div>
          ) : (
            <div className='pokemon-encounter-actions'>
              <button
                className='pokemon-encounter-action pokemon-encounter-action--attack'
                type='button'
                disabled={busy}
                onClick={() => void attack()}
              >
                <Swords size={18} aria-hidden='true' />
                {busy ? 'Combat…' : 'Attaquer'}
                <small>50% de chance de gagner</small>
              </button>
              <button
                className='pokemon-encounter-action pokemon-encounter-action--catch'
                type='button'
                disabled={busy}
                onClick={() => setChoosingBall(true)}
              >
                <CircleDot size={18} aria-hidden='true' />
                Attraper
                <small>Choisir une Poké Ball</small>
              </button>
            </div>
          )}
        </section>
      )}

      <div className='pokemon-encounter-grass'>
        <TallGrass
          active={!encounter && !busy}
          intervalMs={5200}
          size={112}
          onFound={() => void findPokemon()}
        />
        <span className='pokemon-encounter-hint' aria-live='polite'>
          {busy && !encounter
            ? 'Quelque chose approche…'
            : encounter
              ? 'Une rencontre sauvage !'
              : 'Clique quand l’herbe frémit'}
        </span>
      </div>
    </div>
  )
}
