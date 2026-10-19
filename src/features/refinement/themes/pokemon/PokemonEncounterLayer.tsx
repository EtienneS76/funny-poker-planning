import { useState } from 'react'
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
  const snackbar = useAppSnackbar()
  const inventory = useQuery(api.user.queries.shopData, {})
  const startEncounter = useMutation(api.user.mutations.startPokemonEncounter)
  const throwCaptureBall = useMutation(api.user.mutations.throwCaptureBall)

  async function findPokemon() {
    if (busy || encounter) return
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
          onClose={() => {
            setEncounter(null)
            setBusy(false)
          }}
        />
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
