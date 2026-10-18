import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router'
import { useMutation } from 'convex/react'
import { Eye, Shirt } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useAccount } from '../auth/useAccount'
import { AvatarFrame } from '../avatar/AvatarFrame'
import Topbar from '../../components/Topbar'
import { useAppSnackbar } from '../../components/AppSnackbar'
import { sizings } from './options'
import { useRefinementRoom } from './hooks/useRefinementRoom'
import { RefinementRoomControls } from './RefinementRoomControls'
import { RefinementIssue } from './RefinementIssue'
import { ModalEditIssue } from './ModalEditIssue'
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
  avatarFrameId: string | null
  isSpectator: boolean
  vote: string | null
  hasVoted: boolean
  isMe: boolean
}

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
  const { playerJoined, playerLeft, success, error } = useAppSnackbar()
  const { refinementSlug = '' } = useParams()
  const room = useRefinementRoom(refinementSlug)
  const recordVote = useMutation(api.refinement.mutations.recordVote)
  const sendReactionMutation = useMutation(
    api.refinement.mutations.sendReaction,
  )
  const revealVotes = useMutation(api.refinement.mutations.reveal)
  const startNewRound = useMutation(api.refinement.mutations.startNewRound)
  const setSpectatorMutation = useMutation(
    api.refinement.mutations.setSpectator,
  )
  const setFunInteractionsEnabledMutation = useMutation(
    api.refinement.mutations.setFunInteractionsEnabled,
  )
  const updateIssueUrl = useMutation(api.refinement.mutations.updateIssueUrl)

  const [voteOverride, setVoteOverride] = useState<{
    roundId: string
    card: string | null
  } | null>(null)
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const [reactionRound, setReactionRound] = useState(0)
  const [dodging, setDodging] = useState<Record<string, number>>({})
  const [roundUpdating, setRoundUpdating] = useState(false)
  const [issueEditorOpen, setIssueEditorOpen] = useState(false)

  const reactionTrigger = useRef<HTMLButtonElement | null>(null)

  // Fibonacci par défaut, en attendant que le sizing soit stocké sur le refinement
  const cards =
    sizings.find((sizing) => sizing.id === room?.refinement.sizing)?.cards ??
    sizings[0].cards
  const isTshirtSizing = room?.refinement.sizing === 'tee'

  const currentUserId = account.isAuthenticated
    ? account.profileId
      ? String(account.profileId)
      : null
    : `guest:${account.guestId}`
  const currentRoundId = room?.round?._id
  const funInteractionsEnabled =
    room?.refinement.funInteractionsEnabled !== false
  const currentParticipant = room?.participants.find(
    (participant) => participant.userId === currentUserId,
  )
  const isSpectator = currentParticipant?.isSpectator ?? false
  const remoteSelectedCard =
    room?.participants.find(
      (participant) => participant.userId === currentUserId,
    )?.vote ?? null
  const selectedCard =
    voteOverride?.roundId === String(currentRoundId)
      ? voteOverride.card
      : remoteSelectedCard
  const revealed = room?.round?.revealedAt !== undefined
  const hasJoinedRoom = Boolean(currentParticipant)

  useEffect(() => {
    if (
      voteOverride &&
      (voteOverride.roundId !== String(currentRoundId) ||
        remoteSelectedCard === voteOverride.card)
    ) {
      setVoteOverride(null)
    }
  }, [currentRoundId, remoteSelectedCard, voteOverride])

  useEffect(() => {
    if (!funInteractionsEnabled) setReactionTarget(null)
  }, [funInteractionsEnabled])

  const previousParticipants = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    if (
      !room ||
      account.loading ||
      (account.isAuthenticated && !account.profileId)
    ) {
      return
    }

    const current = new Map(
      room.participants.map((participant) => [
        participant.userId,
        participant.name,
      ]),
    )
    const previous = previousParticipants.current

    if (previous) {
      for (const [userId, name] of current) {
        if (userId !== currentUserId && !previous.has(userId)) {
          playerJoined(name)
        }
      }

      const currentName = account.user?.username ?? account.guestName
      for (const [userId, name] of previous) {
        const isCurrentIdentityMigration =
          current.has(currentUserId ?? '') && name === currentName
        if (
          !current.has(userId) &&
          userId !== currentUserId &&
          !isCurrentIdentityMigration
        ) {
          playerLeft(name)
        }
      }
    }

    previousParticipants.current = current
  }, [
    account.guestName,
    account.isAuthenticated,
    account.loading,
    account.profileId,
    account.user?.username,
    currentUserId,
    playerJoined,
    playerLeft,
    room,
  ])

  const realSeats: Seat[] = (room?.participants ?? []).map((participant) => ({
    id: participant.userId,
    name: participant.name,
    avatarUrl: participant.avatarUrl,
    avatarFrameId: participant.avatarFrameId,
    isSpectator: participant.isSpectator,
    vote: participant.isSpectator ? null : participant.vote,
    hasVoted: !participant.isSpectator && participant.hasVoted,
    isMe: participant.userId === currentUserId,
  }))

  if (!realSeats.some((seat) => seat.isMe)) {
    realSeats.push({
      id: currentUserId ?? `guest:${account.guestId}`,
      name: account.user?.username ?? account.guestName,
      avatarUrl: account.user?.avatarUrl ?? null,
      avatarFrameId: account.profile?.avatarFrameId ?? null,
      isSpectator: false,
      vote: selectedCard,
      hasVoted: selectedCard !== null,
      isMe: true,
    })
  }

  const seats: Seat[] = realSeats
  const votes = seats.flatMap((seat) => {
    if (seat.vote === null || seat.isSpectator) return []
    const value = Number(seat.vote)
    return Number.isFinite(value) ? [value] : []
  })
  const votingSeats = seats.filter((seat) => !seat.isSpectator)
  const votedCount = votingSeats.filter((seat) => seat.hasVoted).length
  const playerCount = votingSeats.length
  const average = votes.length
    ? votes.reduce((sum, vote) => sum + vote, 0) / votes.length
    : null
  const revealedCards = seats.flatMap((seat) =>
    seat.vote === null || seat.isSpectator ? [] : [seat.vote],
  )
  const cardOrder: readonly string[] = cards
  const tshirtSummary = [
    ...seats.reduce((counts, seat) => {
      if (seat.vote !== null) {
        counts.set(seat.vote, (counts.get(seat.vote) ?? 0) + 1)
      }
      return counts
    }, new Map<string, number>()),
  ]
    .sort(
      ([left], [right]) => cardOrder.indexOf(left) - cardOrder.indexOf(right),
    )
    .map(([size, count]) => `${count}x${size}`)
    .join(' · ')
  const consensus =
    revealed &&
    votedCount === playerCount &&
    votedCount >= 2 &&
    new Set(revealedCards).size === 1

  function resetRound() {
    if (!room) return
    setVoteOverride(null)
    setReactionTarget(null)
    setDodging({})
    setReactionRound((previous) => previous + 1)
    setRoundUpdating(true)
    void startNewRound({
      slug: refinementSlug,
      guestId: account.guestId,
      guestName: account.user?.username ?? account.guestName,
    })
      .catch((resetError: unknown) => {
        error(
          'Manche non sauvegardée',
          resetError instanceof Error
            ? resetError.message
            : 'Réessaie de lancer une nouvelle manche.',
        )
      })
      .finally(() => setRoundUpdating(false))
  }

  function selectCard(card: string) {
    if (isSpectator || roundUpdating || revealed || !currentRoundId) return
    const nextCard = selectedCard === card ? null : card
    setVoteOverride({ roundId: String(currentRoundId), card: nextCard })
    void recordVote({
      slug: refinementSlug,
      guestId: account.guestId,
      guestName: account.user?.username ?? account.guestName,
      card: nextCard,
    }).catch((voteError: unknown) => {
      setVoteOverride(null)
      error(
        'Vote non sauvegardé',
        voteError instanceof Error ? voteError.message : 'Réessaie de voter.',
      )
    })
  }

  function revealCards() {
    if (isSpectator || revealed || votedCount < 2) return
    void revealVotes({
      slug: refinementSlug,
      guestId: account.guestId,
      guestName: account.user?.username ?? account.guestName,
    }).catch((revealError: unknown) => {
      error(
        'Révélation impossible',
        revealError instanceof Error
          ? revealError.message
          : 'Réessaie de révéler les cartes.',
      )
    })
  }

  async function toggleSpectator() {
    if (!hasJoinedRoom || (revealed && !isSpectator)) return
    try {
      await setSpectatorMutation({
        slug: refinementSlug,
        guestId: account.guestId,
        guestName: account.user?.username ?? account.guestName,
        isSpectator: !isSpectator,
      })
      setVoteOverride(null)
      success(
        isSpectator ? 'Mode joueur activé' : 'Mode spectateur activé',
        isSpectator
          ? 'Tu participeras aux prochaines manches.'
          : 'Ton vote actuel ne sera pas pris en compte.',
      )
    } catch (modeError) {
      error(
        'Mode non modifié',
        modeError instanceof Error
          ? modeError.message
          : 'Réessaie dans un instant.',
      )
    }
  }

  async function toggleFunInteractions() {
    if (!hasJoinedRoom) return
    try {
      await setFunInteractionsEnabledMutation({
        slug: refinementSlug,
        guestId: account.guestId,
        guestName: account.user?.username ?? account.guestName,
        enabled: !funInteractionsEnabled,
      })
    } catch (settingsError) {
      error(
        'Paramètre non modifié',
        settingsError instanceof Error
          ? settingsError.message
          : 'Réessaie dans un instant.',
      )
    }
  }

  async function saveIssueUrl(issueUrl: string | null) {
    try {
      await updateIssueUrl({
        slug: refinementSlug,
        guestId: account.guestId,
        guestName: account.user?.username ?? account.guestName,
        issueUrl,
      })
      success(
        issueUrl ? 'Issue mise à jour' : 'Issue retirée',
        issueUrl
          ? 'Le lien est visible par toute la salle.'
          : 'La salle n’a plus d’issue liée.',
      )
      return true
    } catch (updateError) {
      error(
        'Issue non mise à jour',
        updateError instanceof Error
          ? updateError.message
          : 'Réessaie dans un instant.',
      )
      return false
    }
  }

  function sendReaction(
    targetUserId: string,
    kind: 'tomato' | 'poop' | 'egg' | 'soap',
  ) {
    if (!funInteractionsEnabled) return
    void sendReactionMutation({
      slug: refinementSlug,
      guestId: account.guestId,
      guestName: account.user?.username ?? account.guestName,
      targetUserId,
      kind,
    }).catch((reactionError: unknown) => {
      error(
        'Réaction non envoyée',
        reactionError instanceof Error
          ? reactionError.message
          : 'Réessaie dans un instant.',
      )
    })
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

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      success('Lien copié', 'Partage-le pour inviter à participer.')
    } catch {
      error('Copie impossible', 'Vérifie les permissions du presse-papiers.')
    }
  }

  return (
    <div className='multivers multivers--room'>
      <Topbar account={account} onInvitePlayers={copyInviteLink} />
      <main className='pp-room'>
        <RefinementIssue
          url={room?.refinement.issueUrl ?? null}
          onEdit={() => setIssueEditorOpen(true)}
        />
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
                const angle = Math.PI / 2 + (index * 2 * Math.PI) / seats.length
                return (
                  <li
                    key={seat.id}
                    className={`room-thrown-card${isTshirtSizing ? ' room-thrown-card--shirt' : ''}`}
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
                className={`pp-seat${seat.isMe ? ' pp-seat--me' : ''}${seat.isSpectator ? ' pp-seat--spectator' : ''}`}
                style={seatStyle(index, seats.length)}
              >
                <span className='seat-portrait'>
                  <AvatarFrame
                    frameId={seat.avatarFrameId}
                    className='seat-avatar-frame'
                  >
                    <button
                      className={`seat-avatar${dodging[seat.id] ? ' seat-avatar--dodging' : ''}`}
                      type='button'
                      disabled={seat.isMe || !funInteractionsEnabled}
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
          {funInteractionsEnabled && (
            <RefinementRoomReactions
              key={reactionRound}
              seats={seats.map((seat, index) => ({
                ...seat,
                position: seatStyle(index, seats.length),
              }))}
              events={room?.reactions ?? []}
              eventsReady={room !== undefined}
              targetId={reactionTarget}
              onClose={closeReactionMenu}
              onDodge={dodgeSeat}
              onSend={sendReaction}
            />
          )}
          {consensus && (
            <ConsensusCelebration
              revealDelay={650 + (seats.length - 1) * 70 + 150}
            />
          )}
        </section>

        <RefinementRoomControls
          revealed={revealed}
          voteCount={votedCount}
          playerCount={playerCount}
          isSpectator={isSpectator}
          canChangeMode={hasJoinedRoom && (!revealed || isSpectator)}
          funInteractionsEnabled={funInteractionsEnabled}
          canUpdateRoomSettings={hasJoinedRoom}
          onToggleSpectator={() => void toggleSpectator()}
          onToggleFunInteractions={() => void toggleFunInteractions()}
          onReveal={revealCards}
          onReset={resetRound}
        />

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
                  disabled={
                    isSpectator || revealed || roundUpdating || !hasJoinedRoom
                  }
                  className={`vote-card${selected ? ' vote-card--selected' : ''}${isTshirtSizing ? ' vote-card--shirt' : ''}`}
                  aria-pressed={selected}
                  onClick={() => selectCard(card)}
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
      {issueEditorOpen && (
        <ModalEditIssue
          url={room?.refinement.issueUrl ?? null}
          onClose={() => setIssueEditorOpen(false)}
          onSave={saveIssueUrl}
        />
      )}
    </div>
  )
}
