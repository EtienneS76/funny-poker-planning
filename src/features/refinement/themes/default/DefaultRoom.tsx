import type { CSSProperties } from 'react'
import { Eye, Shirt } from 'lucide-react'
import { AvatarFrame } from '../../../avatar/AvatarFrame'
import Topbar from '../../../../components/Topbar'
import { RefinementRoomControls } from '../../RefinementRoomControls'
import { RefinementIssue } from '../../RefinementIssue'
import { ModalEditIssue } from '../../ModalEditIssue'
import {
  ConsensusCelebration,
  RefinementRoomReactions,
} from '../../RefinementRoomReactions'
import type { RoomProps } from '../types'
import '../../../../styles/planning-poker.css'
import '../../../../styles/refinement-room.css'
import '../../../../styles/refinement-reactions.css'

// Placement des sièges sur une ellipse, le joueur courant en bas (90°).
// Le centre et les rayons viennent de variables CSS : un thème repositionne
// la table (ex. arène Pokémon) sans toucher à ce composant.
function ringPoint(
  index: number,
  total: number,
  rx: string,
  ry: string,
): CSSProperties {
  const angle = Math.PI / 2 + (index * 2 * Math.PI) / total
  return {
    left: `calc(var(--seat-cx, 50%) + ${Math.cos(angle).toFixed(4)} * ${rx})`,
    top: `calc(var(--seat-cy, 50%) + ${Math.sin(angle).toFixed(4)} * ${ry})`,
  }
}

const seatStyle = (index: number, total: number) =>
  ringPoint(index, total, 'var(--seat-rx, 40%)', 'var(--seat-ry, 37%)')

/** Thème par défaut : l'affichage actuel de la salle, branché sur le view model. */
export function DefaultRoom({ vm, themeId = 'default' }: RoomProps) {
  const { account, seats, table, hand, controls, reactions, issue, copyInviteLink } = vm
  const { revealed, consensus, votedCount, playerCount, isTshirtSizing, average, tshirtSummary } = table
  const { cards, selectedCard, isSpectator, canVote, onSelect } = hand

  return (
    <div className='multivers multivers--room' data-theme={themeId}>
      <Topbar account={account} onInvitePlayers={copyInviteLink} />
      <main className='pp-room'>
        <RefinementIssue url={issue.url} onEdit={issue.openEditor} />
        <section
          className={`pp-table-area${revealed ? ' pp-table-area--revealed' : ''}${consensus ? ' pp-table-area--consensus' : ''}`}
          aria-label='Table de vote'
        >
          <div className='pp-table'>
            {revealed ? (
              isTshirtSizing ? (
                <div
                  className='room-results room-results--tshirts'
                  role='status'
                >
                  <span className='room-results-caption'>
                    Répartition des tailles
                  </span>
                  <strong className='room-tshirt-summary'>
                    {tshirtSummary}
                  </strong>
                </div>
              ) : average !== null ? (
                <div className='room-results' role='status'>
                  <span className='room-results-caption'>Moyenne</span>
                  <strong className='room-average'>
                    {average.toLocaleString('fr-FR', {
                      maximumFractionDigits: 1,
                    })}
                  </strong>
                </div>
              ) : null
            ) : (
              <p className='pp-table-count'>
                <strong>
                  {votedCount}/{playerCount}
                </strong>
                ont voté
              </p>
            )}
          </div>
          {revealed && (
            <ul className='room-thrown-cards' aria-label='Cartes révélées'>
              {seats.map((seat, index) => {
                if (seat.vote === null) return null
                const start = seatStyle(index, seats.length)
                const end = ringPoint(
                  index,
                  seats.length,
                  'var(--land-rx, 23%)',
                  'var(--reveal-ry, 21%)',
                )
                return (
                  <li
                    key={seat.id}
                    className={`room-thrown-card${isTshirtSizing ? ' room-thrown-card--shirt' : ''}`}
                    aria-label={`${seat.name} : ${seat.vote}`}
                    style={
                      {
                        '--start-x': start.left,
                        '--start-y': start.top,
                        '--end-x': end.left,
                        '--end-y': end.top,
                        '--card-turn': `${index % 2 === 0 ? -12 : 9}deg`,
                        '--deal-delay': `${index * 70}ms`,
                      } as CSSProperties
                    }
                  >
                    {isTshirtSizing ? (
                      <span className='room-thrown-shirt'>
                        <Shirt size={62} strokeWidth={1.8} aria-hidden='true' />
                        <small>{seat.vote}</small>
                      </span>
                    ) : (
                      <span>{seat.vote}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <ul className='pp-seats'>
            {seats.map((seat, index) => (
              <li
                key={seat.id}
                data-seat-id={seat.id}
                className={`pp-seat${seat.isMe ? ' pp-seat--me' : ''}${seat.isSpectator ? ' pp-seat--spectator' : ''}`}
                style={seatStyle(index, seats.length)}
              >
                <span className='seat-portrait'>
                  <AvatarFrame
                    frameId={seat.avatarFrameId}
                    className='seat-avatar-frame'
                  >
                    <button
                      className={`seat-avatar${reactions.dodging[seat.id] ? ' seat-avatar--dodging' : ''}`}
                      type='button'
                      disabled={seat.isMe || !reactions.enabled}
                      aria-label={
                        seat.isMe
                          ? `Ton profil : ${seat.name}`
                          : `Réagir à ${seat.name}`
                      }
                      aria-expanded={
                        seat.isMe ? undefined : reactions.targetId === seat.id
                      }
                      aria-controls={
                        seat.isMe || reactions.targetId !== seat.id
                          ? undefined
                          : 'room-reaction-menu'
                      }
                      onClick={(event) =>
                        reactions.toggleMenu(seat.id, event.currentTarget)
                      }
                    >
                      <span aria-hidden='true'>
                        {seat.name.slice(0, 1).toUpperCase()}
                      </span>
                      {seat.avatarUrl && (
                        <img
                          src={seat.avatarUrl}
                          alt=''
                          width={56}
                          height={56}
                          onError={(event) => {
                            event.currentTarget.hidden = true
                          }}
                        />
                      )}
                    </button>
                  </AvatarFrame>
                  {seat.isSpectator ? (
                    <span
                      className='seat-spectator-icon'
                      role='img'
                      aria-label='Spectateur'
                    >
                      <Eye size={15} aria-hidden='true' />
                    </span>
                  ) : (
                    <span
                      className={`seat-card${seat.hasVoted ? ' seat-card--voted' : ''}`}
                      role='img'
                      aria-label={
                        seat.vote !== null ? 'A voté' : 'N’a pas encore voté'
                      }
                    />
                  )}
                </span>
                <span className='seat-name'>
                  {seat.name}
                  {seat.isSpectator && (
                    <small className='seat-spectator'>
                      <Eye size={11} aria-hidden='true' /> Spectateur
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {reactions.enabled && (
            <RefinementRoomReactions
              key={reactions.round}
              seats={seats.map((seat, index) => ({
                ...seat,
                position: seatStyle(index, seats.length),
              }))}
              events={reactions.events}
              eventsReady={reactions.eventsReady}
              targetId={reactions.targetId}
              onClose={reactions.closeMenu}
              onDodge={reactions.dodge}
              onSend={reactions.send}
            />
          )}
          {consensus && (
            <ConsensusCelebration
              revealDelay={650 + (seats.length - 1) * 70 + 150}
            />
          )}
        </section>

        <RefinementRoomControls {...controls} />

        <section className='pp-hand-area' aria-label='Tes cartes'>
          <p className='pp-hand-caption' aria-live='polite'>
            {isSpectator
              ? 'Mode spectateur · tu ne votes pas'
              : revealed
                ? 'Votes révélés'
                : selectedCard
                  ? `Tu as choisi ${selectedCard}`
                  : 'Choisis ta carte'}
          </p>
          <div
            className={`pp-hand${isTshirtSizing ? ' pp-hand--shirts' : ''}`}
            style={{ '--card-count': cards.length } as CSSProperties}
          >
            {cards.map((card, index) => {
              const selected = card === selectedCard
              const offset = index - (cards.length - 1) / 2
              return (
                <button
                  key={card}
                  type='button'
                  disabled={!canVote}
                  className={`vote-card${selected ? ' vote-card--selected' : ''}${isTshirtSizing ? ' vote-card--shirt' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(card)}
                  style={
                    {
                      '--tilt': `${offset * 3}deg`,
                      '--drop': `${offset * offset * 2}px`,
                    } as CSSProperties
                  }
                >
                  {isTshirtSizing ? (
                    <>
                      <Shirt size={32} strokeWidth={1.8} aria-hidden='true' />
                      <span>{card}</span>
                    </>
                  ) : (
                    card
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </main>
      {issue.editorOpen && (
        <ModalEditIssue
          url={issue.url}
          onClose={issue.closeEditor}
          onSave={issue.save}
        />
      )}
    </div>
  )
}
