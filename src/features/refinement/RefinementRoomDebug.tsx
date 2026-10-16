import {
  Eye,
  FlaskConical,
  PartyPopper,
  RotateCcw,
  Shuffle,
  UserMinus,
  UserPlus,
} from 'lucide-react'

type Props = {
  revealed: boolean
  voteCount: number
  debugPlayerCount: number
  onAddPlayers: () => void
  onRemovePlayers: () => void
  onReveal: () => void
  onReset: () => void
  onSimulate: () => void
  onSimulateConsensus: () => void
}

export function RefinementRoomDebug({
  revealed,
  voteCount,
  debugPlayerCount,
  onAddPlayers,
  onRemovePlayers,
  onReveal,
  onReset,
  onSimulate,
  onSimulateConsensus,
}: Props) {
  return (
    <details className='room-debug'>
      <summary
        aria-label='Simulation de la salle'
        title='Simulation de la salle'
      >
        <FlaskConical size={18} aria-hidden='true' />
      </summary>
      <div className='room-debug-menu'>
        <strong>Simulation locale</strong>
        <button type='button' disabled={revealed || debugPlayerCount > 0} onClick={onAddPlayers}>
          <UserPlus size={16} aria-hidden='true' /> Ajouter 3 faux joueurs
        </button>
        <button type='button' disabled={revealed || debugPlayerCount === 0} onClick={onRemovePlayers}>
          <UserMinus size={16} aria-hidden='true' /> Retirer les faux joueurs
        </button>
        <button type='button' disabled={revealed || debugPlayerCount === 0} onClick={onSimulate}>
          <Shuffle size={16} aria-hidden='true' /> Simuler les votes
        </button>
        <button type='button' disabled={revealed || debugPlayerCount === 0} onClick={onSimulateConsensus}>
          <PartyPopper size={16} aria-hidden='true' /> Simuler un consensus
        </button>
        <button
          type='button'
          disabled={revealed || voteCount < 2}
          onClick={onReveal}
        >
          <Eye size={16} aria-hidden='true' /> Révéler les cartes
        </button>
        <button type='button' onClick={onReset}>
          <RotateCcw size={16} aria-hidden='true' /> Nouvelle manche
        </button>
      </div>
    </details>
  )
}
