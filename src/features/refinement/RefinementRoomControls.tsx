import { Eye, RotateCcw } from 'lucide-react'

type Props = {
  revealed: boolean
  voteCount: number
  onReveal: () => void
  onReset: () => void
}

export function RefinementRoomControls({
  revealed,
  voteCount,
  onReveal,
  onReset,
}: Props) {
  const canReveal = !revealed && voteCount >= 2

  return (
    <section className='room-controls' aria-label='Actions de la manche'>
      <span className='room-controls-status' role='status'>
        {revealed
          ? 'Cartes révélées'
          : `${voteCount} vote${voteCount > 1 ? 's' : ''} · 2 minimum`}
      </span>
      <div className='room-controls-actions'>
        <button
          type='button'
          className='pp-button room-controls-reveal'
          disabled={!canReveal}
          onClick={onReveal}
        >
          <Eye size={18} aria-hidden='true' />
          Révéler les cartes
        </button>
        <button
          type='button'
          className='pp-button pp-button--secondary'
          disabled={!revealed && voteCount === 0}
          onClick={onReset}
        >
          <RotateCcw size={18} aria-hidden='true' />
          Nouvelle manche
        </button>
      </div>
    </section>
  )
}
