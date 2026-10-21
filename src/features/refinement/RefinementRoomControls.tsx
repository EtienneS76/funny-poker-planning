import { Eye, EyeOff, RotateCcw, Settings2, UserRound } from 'lucide-react'

type Props = {
  revealed: boolean
  voteCount: number
  playerCount: number
  isSpectator: boolean
  canChangeMode: boolean
  funInteractionsEnabled: boolean
  canUpdateRoomSettings: boolean
  onToggleSpectator: () => void
  onToggleFunInteractions: () => void
  onReveal: () => void
  onReset: () => void
}

export function RefinementRoomControls({
  revealed,
  voteCount,
  playerCount,
  isSpectator,
  canChangeMode,
  funInteractionsEnabled,
  canUpdateRoomSettings,
  onToggleSpectator,
  onToggleFunInteractions,
  onReveal,
  onReset,
}: Props) {
  const canReveal = !revealed && voteCount >= 2

  return (
    <section className='room-controls' aria-label='Actions de la manche'>
      <span className='room-controls-status' role='status'>
        {isSpectator
          ? 'Mode spectateur'
          : revealed
            ? 'Cartes révélées'
            : `${voteCount}/${playerCount} vote${voteCount > 1 ? 's' : ''}`}
      </span>
      <div className='room-controls-actions'>
        <details className='room-settings'>
          <summary className='pp-button pp-button--secondary room-settings-trigger'>
            <Settings2 size={18} aria-hidden='true' />
            Paramètres
          </summary>
          <div className='room-settings-panel'>
            <button
              type='button'
              className='room-settings-action'
              disabled={!canChangeMode}
              onClick={onToggleSpectator}
            >
              {isSpectator ? (
                <UserRound size={18} aria-hidden='true' />
              ) : (
                <EyeOff size={18} aria-hidden='true' />
              )}
              <span>
                {isSpectator
                  ? revealed
                    ? 'Jouer la prochaine manche'
                    : 'Reprendre le vote'
                  : revealed
                    ? 'Spectateur à la prochaine manche'
                    : 'Passer spectateur'}
              </span>
            </button>
            <label className='room-setting-toggle'>
              <span>
                <strong>Interactions fun</strong>
                <small>Lancers d’émojis</small>
              </span>
              <span className='pp-switch'>
                <input
                  className='pp-switch-input'
                  type='checkbox'
                  role='switch'
                  checked={funInteractionsEnabled}
                  disabled={!canUpdateRoomSettings}
                  onChange={onToggleFunInteractions}
                />
                <span className='pp-switch-track' aria-hidden='true' />
              </span>
            </label>
          </div>
        </details>
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
