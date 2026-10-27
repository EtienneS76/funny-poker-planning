import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { generateSlug } from './slug'
import { syncAuthenticatedUser } from '../user/profile'
import { reactionKind } from './reactionSchema'

const PRESENCE_TIMEOUT_MS = 10 * 60_000

function normalizeIssueUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ConvexError('Lien d’issue GitHub invalide.')
  }

  const match = url.pathname.match(
    /^\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+)\/issues\/([1-9][0-9]*)\/?$/,
  )
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    !match
  ) {
    throw new ConvexError('Lien d’issue GitHub invalide.')
  }

  return `https://github.com/${match[1]}/${match[2]}/issues/${match[3]}`
}

async function upsertPresence(
  context: MutationCtx,
  participantId: Id<'participants'>,
  guestName: string | null,
) {
  const presence = await context.db
    .query('presences')
    .withIndex('by_participant', (query) =>
      query.eq('participantId', participantId),
    )
    .unique()
  const lastSeenAt = Date.now()

  if (presence) {
    await context.db.patch(presence._id, {
      lastSeenAt,
      guestName: guestName ?? undefined,
    })
    return
  }

  await context.db.insert('presences', {
    participantId,
    lastSeenAt,
    ...(guestName ? { guestName } : {}),
  })
}

async function removePresence(
  context: MutationCtx,
  participantId: Id<'participants'>,
) {
  const presence = await context.db
    .query('presences')
    .withIndex('by_participant', (query) =>
      query.eq('participantId', participantId),
    )
    .unique()
  if (presence) await context.db.delete(presence._id)
}

async function clearLegacyParticipantFields(
  context: MutationCtx,
  participantId: Id<'participants'>,
) {
  await context.db.patch(participantId, {
    joinedAt: undefined,
    lastSeenAt: undefined,
    guestName: undefined,
    name: undefined,
    avatar: undefined,
  })
}

async function getOrCreateCurrentRound(
  context: MutationCtx,
  refinement: Doc<'refinements'>,
) {
  const rounds = await context.db
    .query('refinementRounds')
    .withIndex('by_refinement_sequence', (query) =>
      query.eq('refinementId', refinement._id),
    )
    .collect()
  const votes = await context.db
    .query('votes')
    .withIndex('by_refinement', (query) =>
      query.eq('refinementId', refinement._id),
    )
    .collect()
  const participations = await context.db
    .query('userRoundParticipations')
    .withIndex('by_refinement', (query) =>
      query.eq('refinementId', refinement._id),
    )
    .collect()
  const roundsBySequence = new Map(
    rounds.map((round) => [round.sequence, round._id]),
  )
  const sequences = new Set<number>([
    ...rounds.map((round) => round.sequence),
    ...votes.flatMap((vote) =>
      vote.roundId === undefined && vote.roundNumber !== undefined
        ? [vote.roundNumber]
        : [],
    ),
    ...participations.flatMap((participation) =>
      participation.roundId === undefined &&
      participation.roundNumber !== undefined
        ? [participation.roundNumber]
        : [],
    ),
    ...(refinement.roundNumber === undefined ? [] : [refinement.roundNumber]),
  ])
  if (sequences.size === 0) sequences.add(1)

  const latestSequence = Math.max(...sequences)
  const legacyCurrentSequence = refinement.roundNumber ?? latestSequence
  for (const sequence of sequences) {
    if (roundsBySequence.has(sequence)) continue
    const voteTimes = votes
      .filter(
        (vote) =>
          vote.roundId === undefined &&
          (vote.roundNumber ?? legacyCurrentSequence) === sequence,
      )
      .map((vote) => vote._creationTime)
    const participationTimes = participations
      .filter(
        (participation) =>
          participation.roundId === undefined &&
          (participation.roundNumber ?? legacyCurrentSequence) === sequence,
      )
      .map((participation) => participation.votedAt)
    if (
      refinement.savedAt !== undefined &&
      sequence === legacyCurrentSequence
    ) {
      voteTimes.push(refinement.savedAt)
    }
    const firstVoteAt = [...voteTimes, ...participationTimes].reduce<
      number | undefined
    >(
      (earliest, timestamp) =>
        earliest === undefined ? timestamp : Math.min(earliest, timestamp),
      undefined,
    )
    const roundId = await context.db.insert('refinementRounds', {
      refinementId: refinement._id,
      sequence,
      firstVoteAt,
      ...(sequence === legacyCurrentSequence &&
      refinement.revealedAt !== undefined
        ? { revealedAt: refinement.revealedAt }
        : {}),
    })
    roundsBySequence.set(sequence, roundId)
  }

  for (const vote of votes) {
    if (vote.roundId !== undefined) continue
    const sequence = vote.roundNumber ?? legacyCurrentSequence
    const roundId = roundsBySequence.get(sequence)
    if (roundId) {
      await context.db.patch(vote._id, {
        roundId,
        roundNumber: undefined,
      })
    }
  }
  for (const participation of participations) {
    if (participation.roundId !== undefined) continue
    const sequence = participation.roundNumber ?? legacyCurrentSequence
    const roundId = roundsBySequence.get(sequence)
    if (roundId) {
      await context.db.patch(participation._id, {
        roundId,
        roundNumber: undefined,
      })
    }
  }

  if (
    refinement.name !== undefined ||
    refinement.savedAt !== undefined ||
    refinement.roundNumber !== undefined ||
    refinement.revealedAt !== undefined ||
    refinement.creatorName !== undefined ||
    refinement.creatorAvatar !== undefined
  ) {
    await context.db.patch(refinement._id, {
      name: undefined,
      savedAt: undefined,
      roundNumber: undefined,
      revealedAt: undefined,
      creatorName: undefined,
      creatorAvatar: undefined,
    })
  }

  const currentRoundId = roundsBySequence.get(latestSequence)
  if (!currentRoundId) throw new ConvexError('Impossible de charger la manche.')
  return context.db.get(currentRoundId)
}

export const create = mutation({
  args: {
    guestId: v.string(),
    guestName: v.string(),
    universe: v.union(v.literal('default'), v.literal('pk'), v.literal('sw')),
    sizing: v.string(),
    issueUrl: v.union(v.string(), v.null()),
    funInteractionsEnabled: v.boolean(),
  },
  returns: v.string(),
  handler: async (
    context,
    { guestId, guestName, universe, sizing, issueUrl, funInteractionsEnabled },
  ) => {
    const slug = generateSlug()
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const creatorId = user ? String(user._id) : `guest:${guestId}`
    const creatorName = user?.username ?? guestName.trim()

    if (!creatorName || (!user && creatorName.length > 36)) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }
    if (!['fib', 'tee', 'pow'].includes(sizing)) {
      throw new ConvexError('Sizing de poker planning invalide.')
    }

    const refinementId = await context.db.insert('refinements', {
      slug,
      ...(universe === 'default' ? {} : { universe }),
      sizing,
      issueUrl,
      funInteractionsEnabled,
      creatorId,
    })
    await context.db.insert('refinementRounds', {
      refinementId,
      sequence: 1,
    })
    const participantId = await context.db.insert('participants', {
      refinementId,
      userId: creatorId,
    })
    await upsertPresence(context, participantId, user ? null : creatorName)

    return slug
  },
})

export const updateIssueUrl = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    issueUrl: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName, issueUrl }) => {
    const normalizedUrl = issueUrl === null ? null : normalizeIssueUrl(issueUrl)
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`

    if (!user && (!guestName.trim() || guestName.trim().length > 36)) {
      throw new ConvexError('Pseudo invalide.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant) {
      throw new ConvexError('Rejoins la salle pour modifier son issue.')
    }

    await context.db.patch(refinement._id, { issueUrl: normalizedUrl })
    return null
  },
})

export const setFunInteractionsEnabled = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName, enabled }) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    if (!user && (!guestName.trim() || guestName.trim().length > 36)) {
      throw new ConvexError('Pseudo invalide.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant) {
      throw new ConvexError('Rejoins la salle pour modifier ses paramètres.')
    }

    await context.db.patch(refinement._id, { funInteractionsEnabled: enabled })
    if (!enabled) {
      const reactions = await context.db
        .query('roomReactions')
        .withIndex('by_refinement_created', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      for (const reaction of reactions) {
        await context.db.delete(reaction._id)
      }
    }
    return null
  },
})

export const recordVote = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    card: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName, card }) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const name = user?.username ?? guestName.trim()
    if (!name || (!user && name.length > 36)) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const userId = user ? String(user._id) : `guest:${guestId}`
    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant) throw new ConvexError('Rejoins la salle avant de voter.')
    if (participant.isSpectator) {
      throw new ConvexError('Les spectateurs ne peuvent pas voter.')
    }

    const currentRound = await getOrCreateCurrentRound(context, refinement)
    if (!currentRound) throw new ConvexError('Manche introuvable.')
    if (currentRound.revealedAt !== undefined) {
      throw new ConvexError('Cette manche est déjà révélée.')
    }

    const existingVote = await context.db
      .query('votes')
      .withIndex('by_refinement_user_round', (query) =>
        query
          .eq('refinementId', refinement._id)
          .eq('userId', userId)
          .eq('roundId', currentRound._id),
      )
      .unique()

    if (card === null) {
      if (existingVote) await context.db.delete(existingVote._id)
      return null
    }
    if (!card.trim() || card.length > 20) {
      throw new ConvexError('Carte de vote invalide.')
    }

    if (existingVote) {
      await context.db.patch(existingVote._id, { card })
    } else {
      await context.db.insert('votes', {
        refinementId: refinement._id,
        userId,
        roundId: currentRound._id,
        card,
      })
    }

    const now = Date.now()
    if (currentRound.firstVoteAt === undefined) {
      await context.db.patch(currentRound._id, { firstVoteAt: now })
    }

    if (!user) return null

    const existingRound = await context.db
      .query('userRoundParticipations')
      .withIndex('by_user_refinement_round', (query) =>
        query
          .eq('userId', user._id)
          .eq('refinementId', refinement._id)
          .eq('roundId', currentRound._id),
      )
      .unique()
    if (existingRound) return null

    const priorRefinement = await context.db
      .query('userRoundParticipations')
      .withIndex('by_user_refinement', (query) =>
        query.eq('userId', user._id).eq('refinementId', refinement._id),
      )
      .first()
    const statistics = await context.db
      .query('statistics')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()

    await context.db.insert('userRoundParticipations', {
      userId: user._id,
      refinementId: refinement._id,
      roundId: currentRound._id,
      votedAt: now,
    })

    if (statistics) {
      await context.db.patch(statistics._id, {
        refinementCount: statistics.refinementCount + (priorRefinement ? 0 : 1),
        roundCount: statistics.roundCount + 1,
      })
    }

    return null
  },
})

export const reveal = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId }) => {
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant)
      throw new ConvexError('Rejoins la salle avant de révéler les votes.')
    const currentRound = await getOrCreateCurrentRound(context, refinement)
    if (!currentRound) throw new ConvexError('Manche introuvable.')
    if (currentRound.revealedAt !== undefined) return null

    const participants = await context.db
      .query('participants')
      .withIndex('by_refinement', (query) =>
        query.eq('refinementId', refinement._id),
      )
      .collect()
    const players = participants.filter((item) => !item.isSpectator)
    const playerIds = new Set(players.map((item) => item.userId))
    const votes = await context.db
      .query('votes')
      .withIndex('by_refinement', (query) =>
        query.eq('refinementId', refinement._id),
      )
      .collect()
    const currentVotes = votes.filter(
      (vote) => vote.roundId === currentRound._id && playerIds.has(vote.userId),
    )
    if (currentVotes.length < 2) {
      throw new ConvexError(
        'Il faut au moins deux votes pour révéler les cartes.',
      )
    }

    const firstCard = currentVotes[0]?.card
    const hasConsensus =
      players.length >= 2 &&
      currentVotes.length === players.length &&
      firstCard !== undefined &&
      currentVotes.every((vote) => vote.card === firstCard)
    const reward = hasConsensus ? 25 : 10

    await context.db.patch(currentRound._id, { revealedAt: Date.now() })
    const activeBefore = Date.now() - PRESENCE_TIMEOUT_MS
    const activePlayers: Doc<'participants'>[] = []
    for (const player of players) {
      const presence = await context.db
        .query('presences')
        .withIndex('by_participant', (query) =>
          query.eq('participantId', player._id),
        )
        .unique()
      const lastSeenAt =
        presence?.lastSeenAt ?? player.lastSeenAt ?? player._creationTime
      if (lastSeenAt > activeBefore) activePlayers.push(player)
    }

    const activeAuthenticatedIds = new Set<string>()
    for (const player of activePlayers) {
      if (player.userId.startsWith('guest:')) continue
      try {
        const user = await context.db.get(player.userId as Id<'users'>)
        if (user) activeAuthenticatedIds.add(player.userId)
      } catch {
        // Legacy participant IDs are not authenticated user IDs.
      }
    }

    if (activePlayers.length >= 3 && activeAuthenticatedIds.size >= 2) {
      for (const userId of activeAuthenticatedIds) {
        const wallet = await context.db
          .query('pokisouWallets')
          .withIndex('by_user_id', (query) => query.eq('userId', userId))
          .unique()

        if (wallet) {
          await context.db.patch(wallet._id, {
            balance: wallet.balance + reward,
          })
        } else {
          await context.db.insert('pokisouWallets', {
            userId,
            balance: reward,
          })
        }
      }
    }
    return null
  },
})

export const recordSkirmishShipDestroyed = mutation({
  args: { slug: v.string() },
  returns: v.object({
    rewarded: v.boolean(),
    shipsDestroyed: v.number(),
  }),
  handler: async (context, { slug }) => {
    if (!(await context.auth.getUserIdentity())) {
      throw new ConvexError('Connecte-toi pour gagner des Pokisous.')
    }
    const user = await syncAuthenticatedUser(context)
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const participants = await context.db
      .query('participants')
      .withIndex('by_refinement', (query) =>
        query.eq('refinementId', refinement._id),
      )
      .collect()
    const activeBefore = Date.now() - PRESENCE_TIMEOUT_MS
    const activeParticipants: Doc<'participants'>[] = []
    for (const participant of participants) {
      const presence = await context.db
        .query('presences')
        .withIndex('by_participant', (query) =>
          query.eq('participantId', participant._id),
        )
        .unique()
      const lastSeenAt =
        presence?.lastSeenAt ??
        participant.lastSeenAt ??
        participant._creationTime
      if (lastSeenAt > activeBefore) activeParticipants.push(participant)
    }

    const activePlayers = activeParticipants.filter(
      (participant) => !participant.isSpectator,
    )
    const authenticatedIds = new Set<string>()
    for (const participant of activePlayers) {
      if (participant.userId.startsWith('guest:')) continue
      try {
        if (await context.db.get(participant.userId as Id<'users'>)) {
          authenticatedIds.add(participant.userId)
        }
      } catch {
        // Legacy participant IDs may not reference a users document.
      }
    }
    if (activePlayers.length < 3 || authenticatedIds.size < 2) {
      throw new ConvexError(
        'Il faut 3 joueurs actifs, dont 2 authentifiés, pour le Skirmish.',
      )
    }

    const currentParticipant = activeParticipants.find(
      (participant) => participant.userId === String(user._id),
    )
    if (!currentParticipant) {
      throw new ConvexError('Rejoins la salle avant de jouer au Skirmish.')
    }

    const rounds = await context.db
      .query('refinementRounds')
      .withIndex('by_refinement_sequence', (query) =>
        query.eq('refinementId', refinement._id),
      )
      .collect()
    const currentRound = rounds.sort(
      (left, right) => right.sequence - left.sequence,
    )[0]
    if (!currentRound || currentRound.revealedAt !== undefined) {
      throw new ConvexError('Le Skirmish est fermé pour cette manche.')
    }
    if (!currentParticipant.isSpectator) {
      const votes = await context.db
        .query('votes')
        .withIndex('by_refinement', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      const hasVoted = votes.some(
        (vote) =>
          vote.roundId === currentRound._id && vote.userId === String(user._id),
      )
      if (!hasVoted) {
        throw new ConvexError('Vote avant de jouer au Skirmish.')
      }
    }

    const progress = await context.db
      .query('skirmishProgress')
      .withIndex('by_user_round', (query) =>
        query.eq('userId', user._id).eq('roundId', currentRound._id),
      )
      .unique()
    const previousShipsDestroyed = progress
      ? (progress.shipsDestroyed ?? progress.normalShips + progress.eliteShips)
      : 0
    if (progress?.rewarded) {
      return {
        rewarded: false,
        shipsDestroyed: previousShipsDestroyed,
      }
    }

    const shipsDestroyed = previousShipsDestroyed + 1
    const rewarded = shipsDestroyed >= 10
    if (progress) {
      await context.db.patch(progress._id, {
        normalShips: shipsDestroyed,
        eliteShips: 0,
        shipsDestroyed,
        rewarded,
      })
    } else {
      await context.db.insert('skirmishProgress', {
        userId: user._id,
        refinementId: refinement._id,
        roundId: currentRound._id,
        normalShips: shipsDestroyed,
        eliteShips: 0,
        shipsDestroyed,
        rewarded,
      })
    }

    if (rewarded) {
      const wallet = await context.db
        .query('pokisouWallets')
        .withIndex('by_user_id', (query) =>
          query.eq('userId', String(user._id)),
        )
        .unique()
      if (wallet) {
        await context.db.patch(wallet._id, { balance: wallet.balance + 5 })
      } else {
        await context.db.insert('pokisouWallets', {
          userId: String(user._id),
          balance: 5,
        })
      }
    }

    return { rewarded, shipsDestroyed }
  },
})

export const startNewRound = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId }) => {
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant)
      throw new ConvexError('Rejoins la salle avant de continuer.')
    const currentRound = await getOrCreateCurrentRound(context, refinement)
    if (!currentRound) throw new ConvexError('Manche introuvable.')
    await context.db.insert('refinementRounds', {
      refinementId: refinement._id,
      sequence: currentRound.sequence + 1,
    })
    return null
  },
})

export const join = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName }) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    const name = user?.username ?? guestName.trim()

    if (!name || (!user && name.length > 36)) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()

    if (!refinement) {
      throw new ConvexError('Refinement introuvable.')
    }
    await getOrCreateCurrentRound(context, refinement)

    if (user) {
      for (const previousUserId of [`guest:${guestId}`, user.authUserId]) {
        if (previousUserId === userId) continue
        const previousParticipant = await context.db
          .query('participants')
          .withIndex('by_refinement_and_user', (q) =>
            q.eq('refinementId', refinement._id).eq('userId', previousUserId),
          )
          .unique()
        if (previousParticipant) {
          await removePresence(context, previousParticipant._id)
          await context.db.delete(previousParticipant._id)
        }
      }
    }

    // Idempotent : déjà dans la salle (créateur, refresh, double appel) → rien à faire
    const existing = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (q) =>
        q.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()

    if (existing) {
      await clearLegacyParticipantFields(context, existing._id)
      await upsertPresence(context, existing._id, user ? null : name)
      return null
    }

    const participantId = await context.db.insert('participants', {
      refinementId: refinement._id,
      userId,
    })
    await upsertPresence(context, participantId, user ? null : name)
    return null
  },
})

export const setSpectator = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    isSpectator: v.boolean(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName, isSpectator }) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    if (!user && (!guestName.trim() || guestName.trim().length > 36)) {
      throw new ConvexError('Pseudo invalide.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const participant = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()
    if (!participant) {
      throw new ConvexError('Rejoins la salle pour changer de mode.')
    }
    if ((participant.isSpectator ?? false) === isSpectator) return null

    const currentRound = await getOrCreateCurrentRound(context, refinement)
    if (!currentRound) throw new ConvexError('Manche introuvable.')
    if (isSpectator && currentRound.revealedAt !== undefined) {
      throw new ConvexError(
        'Attends la prochaine manche pour passer spectateur.',
      )
    }

    await context.db.patch(participant._id, { isSpectator })
    if (!isSpectator || currentRound.revealedAt !== undefined) return null

    const vote = await context.db
      .query('votes')
      .withIndex('by_refinement_user_round', (query) =>
        query
          .eq('refinementId', refinement._id)
          .eq('userId', userId)
          .eq('roundId', currentRound._id),
      )
      .unique()
    if (vote) await context.db.delete(vote._id)

    if (user) {
      const participation = await context.db
        .query('userRoundParticipations')
        .withIndex('by_user_refinement_round', (query) =>
          query
            .eq('userId', user._id)
            .eq('refinementId', refinement._id)
            .eq('roundId', currentRound._id),
        )
        .unique()
      if (participation) {
        const otherParticipations = await context.db
          .query('userRoundParticipations')
          .withIndex('by_user_refinement', (query) =>
            query.eq('userId', user._id).eq('refinementId', refinement._id),
          )
          .collect()
        const statistics = await context.db
          .query('statistics')
          .withIndex('by_user', (query) => query.eq('userId', user._id))
          .unique()
        await context.db.delete(participation._id)
        if (statistics) {
          await context.db.patch(statistics._id, {
            roundCount: Math.max(0, statistics.roundCount - 1),
            refinementCount: Math.max(
              0,
              statistics.refinementCount -
                (otherParticipations.length === 1 ? 1 : 0),
            ),
          })
        }
      }
    }

    return null
  },
})

export const heartbeat = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, guestName }) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const userId = user ? String(user._id) : `guest:${guestId}`
    const name = user?.username ?? guestName.trim()

    if (!name || (!user && name.length > 36)) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')

    const existing = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (q) =>
        q.eq('refinementId', refinement._id).eq('userId', userId),
      )
      .unique()

    if (existing) {
      await clearLegacyParticipantFields(context, existing._id)
      await upsertPresence(context, existing._id, user ? null : name)
      return null
    }

    const participantId = await context.db.insert('participants', {
      refinementId: refinement._id,
      userId,
    })
    await upsertPresence(context, participantId, user ? null : name)
    return null
  },
})

export const sendReaction = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    guestName: v.string(),
    targetUserId: v.string(),
    kind: reactionKind,
  },
  returns: v.null(),
  handler: async (
    context,
    { slug, guestId, guestName, targetUserId, kind },
  ) => {
    const identity = await context.auth.getUserIdentity()
    const user = identity ? await syncAuthenticatedUser(context) : null
    const sourceUserId = user ? String(user._id) : `guest:${guestId}`
    if (!user && (!guestName.trim() || guestName.trim().length > 36)) {
      throw new ConvexError('Pseudo invalide.')
    }

    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (query) => query.eq('slug', slug))
      .unique()
    if (!refinement) throw new ConvexError('Refinement introuvable.')
    if (refinement.funInteractionsEnabled === false) {
      throw new ConvexError(
        'Les interactions fun sont désactivées dans cette salle.',
      )
    }

    const source = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', sourceUserId),
      )
      .unique()
    const target = await context.db
      .query('participants')
      .withIndex('by_refinement_and_user', (query) =>
        query.eq('refinementId', refinement._id).eq('userId', targetUserId),
      )
      .unique()
    if (!source || !target) {
      throw new ConvexError('Les deux joueurs doivent être dans la partie.')
    }

    const createdAt = Date.now()
    const recentReaction = await context.db
      .query('roomReactions')
      .withIndex('by_refinement_source_created', (query) =>
        query
          .eq('refinementId', refinement._id)
          .eq('sourceUserId', sourceUserId)
          .gt('createdAt', createdAt - 500),
      )
      .order('desc')
      .first()
    if (recentReaction) {
      throw new ConvexError('Attends un instant avant la prochaine réaction.')
    }

    const hatched = kind === 'egg' && Math.random() < 0.1
    const dodged = !hatched && kind !== 'soap' && Math.random() < 0.15
    await context.db.insert('roomReactions', {
      refinementId: refinement._id,
      sourceUserId,
      targetUserId,
      kind,
      createdAt,
      hatched,
      dodged,
      escapeAngle: hatched ? Math.random() * Math.PI * 2 : null,
    })
    return null
  },
})

export const cleanupInactiveRooms = internalMutation({
  args: {},
  handler: async (context) => {
    const cutoff = Date.now() - PRESENCE_TIMEOUT_MS
    const expiredReactions = await context.db
      .query('roomReactions')
      .withIndex('by_created', (query) =>
        query.lt('createdAt', Date.now() - 8_000),
      )
      .collect()
    for (const reaction of expiredReactions) {
      await context.db.delete(reaction._id)
    }

    const participants = await context.db.query('participants').collect()
    const presences = await context.db.query('presences').collect()
    const presenceByParticipant = new Map(
      presences.map((presence) => [presence.participantId, presence]),
    )
    const participantsByRoom = new Map<string, typeof participants>()

    for (const participant of participants) {
      const refinementKey = String(participant.refinementId)
      const roomParticipants = participantsByRoom.get(refinementKey) ?? []
      roomParticipants.push(participant)
      participantsByRoom.set(refinementKey, roomParticipants)
    }

    const participantIds = new Set(participants.map(({ _id }) => _id))
    for (const presence of presences) {
      if (!participantIds.has(presence.participantId)) {
        await context.db.delete(presence._id)
        presenceByParticipant.delete(presence.participantId)
      }
    }

    const refinements = await context.db.query('refinements').collect()
    for (const refinement of refinements) {
      const roomParticipants =
        participantsByRoom.get(String(refinement._id)) ?? []
      const activeParticipants = roomParticipants.filter((participant) => {
        const lastSeenAt =
          presenceByParticipant.get(participant._id)?.lastSeenAt ??
          participant.lastSeenAt ??
          participant._creationTime
        return lastSeenAt > cutoff
      })

      if (activeParticipants.length > 0) {
        await getOrCreateCurrentRound(context, refinement)
        if (
          refinement.name !== undefined ||
          refinement.savedAt !== undefined ||
          refinement.roundNumber !== undefined ||
          refinement.revealedAt !== undefined ||
          refinement.creatorName !== undefined ||
          refinement.creatorAvatar !== undefined
        ) {
          await context.db.patch(refinement._id, {
            name: undefined,
            savedAt: undefined,
            roundNumber: undefined,
            revealedAt: undefined,
            creatorName: undefined,
            creatorAvatar: undefined,
          })
        }
        const activeIds = new Set(activeParticipants.map(({ _id }) => _id))
        for (const participant of roomParticipants) {
          if (activeIds.has(participant._id)) {
            if (
              participant.joinedAt !== undefined ||
              participant.lastSeenAt !== undefined ||
              participant.guestName !== undefined ||
              participant.name !== undefined ||
              participant.avatar !== undefined
            ) {
              await clearLegacyParticipantFields(context, participant._id)
            }
            continue
          }
          const presence = presenceByParticipant.get(participant._id)
          if (presence) await context.db.delete(presence._id)
          await context.db.delete(participant._id)
        }
        continue
      }

      for (const participant of roomParticipants) {
        const presence = presenceByParticipant.get(participant._id)
        if (presence) await context.db.delete(presence._id)
        await context.db.delete(participant._id)
      }

      const roundParticipations = await context.db
        .query('userRoundParticipations')
        .withIndex('by_refinement', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      for (const participation of roundParticipations) {
        await context.db.delete(participation._id)
      }
      const votes = await context.db
        .query('votes')
        .withIndex('by_refinement', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      for (const vote of votes) await context.db.delete(vote._id)
      const rounds = await context.db
        .query('refinementRounds')
        .withIndex('by_refinement_sequence', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      for (const round of rounds) await context.db.delete(round._id)
      const reactions = await context.db
        .query('roomReactions')
        .withIndex('by_refinement_created', (query) =>
          query.eq('refinementId', refinement._id),
        )
        .collect()
      for (const reaction of reactions) await context.db.delete(reaction._id)
      await context.db.delete(refinement._id)
    }
  },
})
