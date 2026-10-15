import { Eye, FlaskConical, RotateCcw, Shuffle } from 'lucide-react'

type Props = {
  revealed: boolean
  voteCount: number
  onReveal: () => void
  onReset: () => void
  onSimulate: () => void
}

export function RefinementRoomDebug({
  revealed,
  voteCount,
  onReveal,
  onReset,
  onSimulate,
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
        <button type='button' disabled={revealed} onClick={onSimulate}>
          <Shuffle size={16} aria-hidden='true' /> Simuler les votes
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
