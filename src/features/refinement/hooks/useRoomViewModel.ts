import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAccount } from '../../auth/useAccount'
import { useAppSnackbar } from '../../../components/AppSnackbar'
import { sizings } from '../options'
import type { ReactionKind, RoomViewModel, Seat } from '../themes/types'
import { useRefinementRoom } from './useRefinementRoom'

/**
 * Toute la logique de la salle (vote, révélation, manches, réactions, présence).
 * Aucun JSX, aucun style : les thèmes consomment ce view model.
 */
export function useRoomViewModel(refinementSlug: string): RoomViewModel {
  const account = useAccount()
  const { playerJoined, playerLeft, success, error } = useAppSnackbar()
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

  function sendReaction(targetUserId: string, kind: ReactionKind) {
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

  function toggleReactionMenu(seatId: string, trigger: HTMLButtonElement) {
    reactionTrigger.current = trigger
    setReactionTarget((previous) => (previous === seatId ? null : seatId))
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

  return {
    universe: room?.refinement.universe,
    account,
    seats,
    table: {
      revealed,
      consensus,
      votedCount,
      playerCount,
      isTshirtSizing,
      average,
      tshirtSummary,
    },
    hand: {
      cards,
      selectedCard,
      isSpectator,
      canVote: !(isSpectator || revealed || roundUpdating || !hasJoinedRoom),
      onSelect: selectCard,
    },
    controls: {
      revealed,
      voteCount: votedCount,
      playerCount,
      isSpectator,
      canChangeMode: hasJoinedRoom && (!revealed || isSpectator),
      funInteractionsEnabled,
      canUpdateRoomSettings: hasJoinedRoom,
      onToggleSpectator: () => void toggleSpectator(),
      onToggleFunInteractions: () => void toggleFunInteractions(),
      onReveal: revealCards,
      onReset: resetRound,
    },
    reactions: {
      enabled: funInteractionsEnabled,
      events: room?.reactions ?? [],
      eventsReady: room !== undefined,
      targetId: reactionTarget,
      round: reactionRound,
      dodging,
      toggleMenu: toggleReactionMenu,
      closeMenu: closeReactionMenu,
      dodge: dodgeSeat,
      send: sendReaction,
    },
    issue: {
      url: room?.refinement.issueUrl ?? null,
      editorOpen: issueEditorOpen,
      openEditor: () => setIssueEditorOpen(true),
      closeEditor: () => setIssueEditorOpen(false),
      save: saveIssueUrl,
    },
    copyInviteLink,
  }
}
