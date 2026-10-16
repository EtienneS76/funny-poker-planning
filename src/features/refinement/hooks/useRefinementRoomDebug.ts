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
]

export function useRefinementRoomDebug(cards: readonly string[]) {
  const [players, setPlayers] = useState<MockPlayer[]>([])
  const [consensusVote, setConsensusVote] = useState<string | null>(null)

  function addPlayers() {
    setPlayers(mockPlayers.map((player) => ({ ...player, vote: null })))
    setConsensusVote(null)
  }

  function removePlayers() {
    setPlayers([])
    setConsensusVote(null)
  }

  function resetPlayers() {
    setPlayers((previous) =>
      previous.map((player) => ({ ...player, vote: null })),
    )
    setConsensusVote(null)
  }

  function simulateVotes() {
    setConsensusVote(null)
    setPlayers((previous) =>
      previous.map((player) => ({
        ...player,
        vote: cards[Math.floor(Math.random() * cards.length)],
      })),
    )
  }

  function simulateConsensus(selectedCard: string | null) {
    const vote = selectedCard ?? cards[Math.floor(cards.length / 2)]
    setPlayers((previous) => {
      const playersToVote = previous.length
        ? previous
        : mockPlayers.map((player) => ({ ...player, vote: null }))
      return playersToVote.map((player) => ({ ...player, vote }))
    })
    setConsensusVote(vote)
    return vote
  }

  return {
    players,
    consensusVote,
    addPlayers,
    removePlayers,
    resetPlayers,
    simulateVotes,
    simulateConsensus,
  }
}