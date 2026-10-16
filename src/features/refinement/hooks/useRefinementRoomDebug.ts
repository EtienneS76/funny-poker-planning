import { useState } from 'react'

type MockPlayer = {
  id: string
  name: string
  vote: string | null
}

const mockPlayers: MockPlayer[] = [
  { id: 'mock-1', name: 'ada-lovelace', vote: '5' },
  { id: 'mock-2', name: 'linus-t', vote: null },
  { id: 'mock-3', name: 'grace-hopper', vote: '8' },
  { id: 'mock-4', name: 'margaret-h', vote: null },
  { id: 'mock-5', name: 'alan-turing', vote: '5' },
]

export function useRefinementRoomDebug(cards: readonly string[]) {
  const [players, setPlayers] = useState(mockPlayers)

  function resetPlayers() {
    setPlayers(mockPlayers.map((player) => ({ ...player, vote: null })))
  }

  function simulateVotes() {
    setPlayers((previous) =>
      previous.map((player) => ({
        ...player,
        vote: cards[Math.floor(Math.random() * cards.length)],
      })),
    )
  }

  function simulateConsensus(selectedCard: string | null) {
    const vote = selectedCard ?? cards[Math.floor(cards.length / 2)]
    setPlayers((previous) => previous.map((player) => ({ ...player, vote })))
    return vote
  }

  return { players, resetPlayers, simulateVotes, simulateConsensus }
}