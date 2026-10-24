import { useEffect, useRef } from 'react'
import {
  CalendarDays,
  CircleDot,
  Layers3,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AvatarFrame } from '../avatar/AvatarFrame'

type Props = {
  open: boolean
  username: string
  displayName: string
  avatarUrl: string | null
  avatarFrameId: string | null
  firstConnectedAt: number
  refinementCount: number
  roundCount: number
  mysteryPokeBallOpenCount: number
  onClose: () => void
}

export function AccountStatisticsModal({
  open,
  username,
  displayName,
  avatarUrl,
  avatarFrameId,
  firstConnectedAt,
  refinementCount,
  roundCount,
  mysteryPokeBallOpenCount,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pokemonCollection = useQuery(api.user.queries.pokemonCollection, {})
  const starWarsCollection = useQuery(api.user.queries.starWarsCollection, {})

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
  const connectionAge = formatAccountAge(firstConnectedAt)
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
          <AvatarFrame
            frameId={avatarFrameId}
            className='account-stats-avatar-frame avatar-frame--compact'
          >
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
          </AvatarFrame>
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
            <dd className='account-stat-connection'>
              <span>{firstConnection}</span>
              <small>Ancienneté : {connectionAge}</small>
            </dd>
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
          <div className='account-stat'>
            <dt>
              <CircleDot size={16} aria-hidden='true' /> Pokémon obtenus
            </dt>
            <dd>{pokemonCollection?.length ?? 0} / 151</dd>
          </div>
          <div className='account-stat'>
            <dt>
              <Sparkles size={16} aria-hidden='true' /> Poké Balls mystères
              ouvertes
            </dt>
            <dd>{mysteryPokeBallOpenCount}</dd>
          </div>
          <div className='account-stat'>
            <dt>
              <Star size={16} aria-hidden='true' /> Cartes Star Wars obtenues
            </dt>
            <dd>{starWarsCollection?.length ?? 0} / 100</dd>
          </div>
        </dl>
      </div>
    </dialog>
  )
}

function formatAccountAge(firstConnectedAt: number, today = new Date()) {
  const start = new Date(firstConnectedAt)
  let years = today.getFullYear() - start.getFullYear()
  let months = today.getMonth() - start.getMonth()
  let days = today.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const ageParts = [
    years > 0 ? `${years} ${years === 1 ? 'année' : 'années'}` : null,
    months > 0 ? `${months} mois` : null,
    days > 0 ? `${days} ${days === 1 ? 'jour' : 'jours'}` : null,
  ].filter((part): part is string => part !== null)

  return ageParts.length ? ageParts.join(', ') : 'Aujourd’hui'
}
