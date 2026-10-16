import { useEffect, useRef } from 'react'
import { CalendarDays, Layers3, Trophy, X } from 'lucide-react'

type Props = {
  open: boolean
  username: string
  displayName: string
  avatarUrl: string | null
  firstConnectedAt: number
  refinementCount: number
  roundCount: number
  onClose: () => void
}

export function AccountStatisticsModal({
  open,
  username,
  displayName,
  avatarUrl,
  firstConnectedAt,
  refinementCount,
  roundCount,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
    return () => {
      if (element.open) element.close()
    }
  }, [open])

  const firstConnection = new Date(firstConnectedAt).toLocaleDateString(
    'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' },
  )

  return (
    <dialog
      className='pp-modal account-stats-modal'
      ref={dialog}
      aria-labelledby='account-stats-title'
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close()
      }}
    >
      <div className='pp-modal-content account-stats-content'>
        <div className='pp-modal-heading'>
          <div>
            <span className='account-stats-kicker'>TON PROFIL</span>
            <h2 id='account-stats-title'>Statistiques</h2>
          </div>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer les statistiques'
            title='Fermer'
            onClick={onClose}
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>

        <div className='account-stats-profile'>
          <span className='account-stats-avatar' aria-hidden='true'>
            <span>{displayName.slice(0, 1).toUpperCase()}</span>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=''
                width={54}
                height={54}
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
            )}
          </span>
          <div>
            <strong>{displayName}</strong>
            <span>GitHub · @{username}</span>
          </div>
        </div>

        <dl className='account-stats-grid'>
          <div className='account-stat account-stat--date'>
            <dt>
              <CalendarDays size={16} aria-hidden='true' /> Première connexion
            </dt>
            <dd>{firstConnection}</dd>
          </div>
          <div className='account-stat'>
            <dt>
              <Layers3 size={16} aria-hidden='true' /> Refinements effectués
            </dt>
            <dd>{refinementCount}</dd>
          </div>
          <div className='account-stat'>
            <dt>
              <Trophy size={16} aria-hidden='true' /> Manches jouées
            </dt>
            <dd>{roundCount}</dd>
          </div>
        </dl>
      </div>
    </dialog>
  )
}
