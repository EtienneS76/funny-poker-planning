import { useRef, useState, type CSSProperties } from 'react'
import { useAccount } from '../auth/useAccount'
import { sizings } from './options'
import { RefinementRoomDebug } from './RefinementRoomDebug'
import { useRefinementRoomDebug } from './hooks/useRefinementRoomDebug'
import { RefinementRoomControls } from './RefinementRoomControls'
import { RefinementIssue } from './RefinementIssue'
import {
  ConsensusCelebration,
  RefinementRoomReactions,
} from './RefinementRoomReactions'
import '../../styles/planning-poker.css'
import '../../styles/refinement-room.css'
import '../../styles/refinement-reactions.css'

type Seat = {
  id: string
  name: string
  avatarUrl: string | null
  vote: string | null
  isMe: boolean
}

const tempGithubUrl: string | null =
  'https://github.com/fulll/portail-rh/issues/10596'

// Placement des sièges sur une ellipse, le joueur courant en bas (90°)
const SEAT_RX = 40
const SEAT_RY = 37

function seatStyle(index: number, total: number): CSSProperties {
  const angle = Math.PI / 2 + (index * 2 * Math.PI) / total
  return {
    left: `${50 + SEAT_RX * Math.cos(angle)}%`,
    top: `${50 + SEAT_RY * Math.sin(angle)}%`,
  }
}

export function RefinementRoom() {
  const account = useAccount()
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const [reactionRound, setReactionRound] = useState(0)
  const [dodging, setDodging] = useState<Record<string, number>>({})
  const reactionTrigger = useRef<HTMLButtonElement | null>(null)

  // Fibonacci par défaut, en attendant que le sizing soit stocké sur le refinement
  const cards = sizings[0].cards
  const { players, resetPlayers, simulateVotes, simulateConsensus } =
    useRefinementRoomDebug(cards)

  const seats: Seat[] = [
    {
      id: 'me',
      name: account.user?.username ?? 'Invité',
      avatarUrl: account.user?.avatarUrl ?? null,
      vote: selectedCard,
      isMe: true,
    },
    ...players.map((player) => ({
      ...player,
      avatarUrl: null,
      isMe: false,
    })),
  ]
  const votes = seats.flatMap((seat) =>
    seat.vote === null ? [] : [Number(seat.vote)],
  )
  const votedCount = votes.length
  const average = votes.length
    ? votes.reduce((sum, vote) => sum + vote, 0) / votes.length
    : null
  const consensus =
    revealed &&
    votedCount === seats.length &&
    votedCount >= 2 &&
    new Set(votes).size === 1

  function resetRound() {
    setRevealed(false)
    setSelectedCard(null)
    setReactionTarget(null)
    setDodging({})
    setReactionRound((previous) => previous + 1)
    resetPlayers()
  }

  function revealCards() {
    if (!revealed && votedCount >= 2) setRevealed(true)
  }

  function simulateConsensusVote() {
    setSelectedCard(simulateConsensus(selectedCard))
  }

  function closeReactionMenu() {
    setReactionTarget(null)
    reactionTrigger.current?.focus({ preventScroll: true })
  }

  function dodgeSeat(seatId: string, active: boolean) {
    setDodging((previous) => ({
      ...previous,
      [seatId]: Math.max(0, (previous[seatId] ?? 0) + (active ? 1 : -1)),
    }))
  }

  return (
    <div className='multivers multivers--room'>
      <main className='pp-room'>
        <div className='room-toolbar'>
          <RefinementRoomDebug
            revealed={revealed}
            voteCount={votedCount}
            onReveal={revealCards}
            onReset={resetRound}
            onSimulate={simulateVotes}
            onSimulateConsensus={simulateConsensusVote}
          />
        </div>
        <RefinementIssue url={tempGithubUrl} />
        <section
          className={`pp-table-area${revealed ? ' pp-table-area--revealed' : ''}${consensus ? ' pp-table-area--consensus' : ''}`}
          aria-label='Table de vote'
        >
          <div className='pp-table'>
            {revealed ? (
              <div className='room-results' role='status'>
                <span className='room-results-caption'>Moyenne</span>
                <strong className='room-average'>
                  {average?.toLocaleString('fr-FR', {
                    maximumFractionDigits: 1,
                  }) ?? '—'}
                </strong>
              </div>
            ) : (
              <p className='pp-table-count'>
                <strong>
                  {votedCount}/{seats.length}
                </strong>
                ont voté
              </p>
            )}
          </div>
          {revealed && (
            <ul className='room-thrown-cards' aria-label='Cartes révélées'>
              {seats.map((seat, index) => {
                if (seat.vote === null) return null
                const angle = Math.PI / 2 + (index * 2 * Math.PI) / seats.length
                return (
                  <li
                    key={seat.id}
                    className='room-thrown-card'
                    aria-label={`${seat.name} : ${seat.vote}`}
                    style={
                      {
                        '--start-x': `${50 + SEAT_RX * Math.cos(angle)}%`,
                        '--start-y': `${50 + SEAT_RY * Math.sin(angle)}%`,
                        '--end-x': `${50 + 23 * Math.cos(angle)}%`,
                        '--end-y': `calc(50% + ${Math.sin(angle)} * var(--reveal-ry, 21%))`,
                        '--card-turn': `${index % 2 === 0 ? -12 : 9}deg`,
                        '--deal-delay': `${index * 70}ms`,
                      } as CSSProperties
                    }
                  >
                    <span>{seat.vote}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <ul className='pp-seats'>
            {seats.map((seat, index) => (
              <li
                key={seat.id}
                className={`pp-seat${seat.isMe ? ' pp-seat--me' : ''}`}
                style={seatStyle(index, seats.length)}
              >
                <span className='seat-portrait'>
                  <button
                    className={`seat-avatar${dodging[seat.id] ? ' seat-avatar--dodging' : ''}`}
                    type='button'
                    disabled={seat.isMe}
                    aria-label={
                      seat.isMe
                        ? `Ton profil : ${seat.name}`
                        : `Réagir à ${seat.name}`
                    }
                    aria-expanded={
                      seat.isMe ? undefined : reactionTarget === seat.id
                    }
                    aria-controls={
                      seat.isMe || reactionTarget !== seat.id
                        ? undefined
                        : 'room-reaction-menu'
                    }
                    onClick={(event) => {
                      reactionTrigger.current = event.currentTarget
                      setReactionTarget((previous) =>
                        previous === seat.id ? null : seat.id,
                      )
                    }}
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
                  <span
                    className={`seat-card${seat.vote !== null ? ' seat-card--voted' : ''}`}
                    role='img'
                    aria-label={
                      seat.vote !== null ? 'A voté' : 'N’a pas encore voté'
                    }
                  />
                </span>
                <span className='seat-name'>{seat.name}</span>
              </li>
            ))}
          </ul>
          <RefinementRoomReactions
            key={reactionRound}
            seats={seats.map((seat, index) => ({
              ...seat,
              position: seatStyle(index, seats.length),
            }))}
            targetId={reactionTarget}
            onClose={closeReactionMenu}
            onDodge={dodgeSeat}
          />
          {consensus && (
            <ConsensusCelebration
              revealDelay={650 + (seats.length - 1) * 70 + 150}
            />
          )}
        </section>

        <RefinementRoomControls
          revealed={revealed}
          voteCount={votedCount}
          onReveal={revealCards}
          onReset={resetRound}
        />

        <section className='pp-hand-area' aria-label='Tes cartes'>
          <p className='pp-hand-caption' aria-live='polite'>
            {revealed
              ? 'Votes révélés'
              : selectedCard
                ? `Tu as choisi ${selectedCard}`
                : 'Choisis ta carte'}
          </p>
          <div className='pp-hand'>
            {cards.map((card, index) => {
              const selected = card === selectedCard
              const offset = index - (cards.length - 1) / 2
              return (
                <button
                  key={card}
                  type='button'
                  disabled={revealed}
                  className={`vote-card${selected ? ' vote-card--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedCard(selected ? null : card)}
                  style={
                    {
                      '--tilt': `${offset * 3}deg`,
                      '--drop': `${offset * offset * 2}px`,
                    } as CSSProperties
                  }
                >
                  {card}
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
