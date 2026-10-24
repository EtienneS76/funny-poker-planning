import { useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { useAppSnackbar } from '../../../../components/AppSnackbar'
import TallGrass from '../../../pokemon/components/Tallgrass'
import {
  getPokemonById,
  getPokemonImageUrl,
} from '../../../pokemon/functions/GeneratePokemon'
import { PokemonCapture } from './PokemonCapture'
import type { RoomProps } from '../types'

type CaptureBallId = 'poke-ball' | 'hyper-ball' | 'master-ball'
type Encounter = { pokemonId: number }

const captureBallIds: CaptureBallId[] = [
  'poke-ball',
  'hyper-ball',
  'master-ball',
]
const ballColors: Record<CaptureBallId, { top: string; bottom: string }> = {
  'poke-ball': { top: '#ef4a3c', bottom: '#f4f4f6' },
  'hyper-ball': { top: '#2d2d34', bottom: '#f2c230' },
  'master-ball': { top: '#8b5cf6', bottom: '#f4f4f6' },
}

export function PokemonEncounterLayer({ vm }: RoomProps) {
  const { account } = vm
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [busy, setBusy] = useState(false)
  const encounterOutcomes = useRef<boolean[]>([])
  const snackbar = useAppSnackbar()
  const inventory = useQuery(api.user.queries.shopData, {})
  const startEncounter = useMutation(api.user.mutations.startPokemonEncounter)
  const endEncounter = useMutation(api.user.mutations.endPokemonEncounter)
  const throwCaptureBall = useMutation(api.user.mutations.throwCaptureBall)
  const hasCaptureBall =
    inventory?.consumableInventory.some(
      (item) =>
        captureBallIds.includes(item.consumableId as CaptureBallId) &&
        item.quantity > 0,
    ) ?? false

  async function findPokemon() {
    if (!hasCaptureBall || busy || encounter) return
    setBusy(true)
    try {
      const result = await startEncounter({ guestId: account.guestId })
      setEncounter(result)
    } catch (error) {
      snackbar.error(
        'Rencontre impossible',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setBusy(false)
    }
  }

  function onGrassFound() {
    if (!hasCaptureBall || busy || encounter) return
    if (encounterOutcomes.current.length === 0) {
      const firstOutcomeIsFound = Math.random() < 0.5
      encounterOutcomes.current = [firstOutcomeIsFound, !firstOutcomeIsFound]
    }

    if (encounterOutcomes.current.shift()) {
      void findPokemon()
    } else {
      snackbar.info('Le Pokémon s’est échappé')
    }
  }

  async function closeEncounter() {
    if (!encounter || busy) return
    setBusy(true)
    try {
      await endEncounter({ guestId: account.guestId })
      setEncounter(null)
    } catch (error) {
      snackbar.error(
        'Rencontre impossible à fermer',
        error instanceof Error ? error.message : 'Réessaie dans un instant.',
      )
    } finally {
      setBusy(false)
    }
  }

  const pokemon = encounter ? getPokemonById(encounter.pokemonId) : null
  const ownedBalls = inventory?.consumableInventory ?? []
  const balls = pokemon
    ? captureBallIds.map((ballId) => {
        const item = inventory?.consumables.find(
          (consumable) => consumable.id === ballId,
        )
        const quantity =
          ownedBalls.find((owned) => owned.consumableId === ballId)?.quantity ??
          0
        return {
          id: ballId,
          name: item?.name ?? 'Poké Ball',
          chance: item?.catchRates?.[pokemon.rarity] ?? 0,
          quantity,
          ...ballColors[ballId],
        }
      })
    : undefined

  return (
    <div className='pokemon-encounter-layer'>
      {encounter && pokemon && (
        <PokemonCapture
          key={encounter.pokemonId}
          name={pokemon.name}
          rarity={pokemon.rarity}
          imageSrc={getPokemonImageUrl(
            pokemon.id,
            account.profile?.showPokemon3d ?? false,
          )}
          fallbackImageSrc={getPokemonImageUrl(pokemon.id, false)}
          balls={inventory === undefined ? undefined : balls}
          isAuthenticated={account.isAuthenticated}
          signInPending={account.pending}
          onSignIn={() => void account.signIn()}
          onThrow={async (ballId) => {
            setBusy(true)
            try {
              return await throwCaptureBall({ consumableId: ballId })
            } finally {
              setBusy(false)
            }
          }}
          onFinish={() => setBusy(false)}
          onClose={() => void closeEncounter()}
        />
      )}

      <div className='pokemon-encounter-grass'>
        <TallGrass
          active={hasCaptureBall && !encounter && !busy}
          intervalMs={10000}
          size={112}
          onFound={onGrassFound}
        />
      </div>
    </div>
  )
}
