import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import { query } from '../_generated/server'
import { authComponent } from '../auth/auth'

export const getBySlug = query({
  args: { slug: v.string(), guestId: v.string() },
  handler: async (context, { slug, guestId }) => {
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()

    if (!refinement) {
      return null
    }

    const identity = await context.auth.getUserIdentity()
    let currentUserId = `guest:${guestId}`
    if (identity) {
      const authUser = await authComponent.getAuthUser(context)
      const user = await context.db
        .query('users')
        .withIndex('by_auth_user', (q) =>
          q.eq('authUserId', String(authUser._id)),
        )
        .unique()
      currentUserId = user ? String(user._id) : ''
    }

    const participants = await context.db
      .query('participants')
      .withIndex('by_refinement', (q) => q.eq('refinementId', refinement._id))
      .collect()
    const rounds = await context.db
      .query('refinementRounds')
      .withIndex('by_refinement_sequence', (q) =>
        q.eq('refinementId', refinement._id),
      )
      .collect()
    const currentRound =
      rounds.sort((left, right) => right.sequence - left.sequence)[0] ?? null
    const reactions =
      refinement.funInteractionsEnabled === false
        ? []
        : await context.db
            .query('roomReactions')
            .withIndex('by_refinement_created', (q) =>
              q
                .eq('refinementId', refinement._id)
                .gt('createdAt', Date.now() - 8_000),
            )
            .collect()
    const votes = await context.db
      .query('votes')
      .withIndex('by_refinement', (q) => q.eq('refinementId', refinement._id))
      .collect()
    const votesByUserId = new Map(
      votes
        .filter((vote) => vote.roundId === currentRound?._id)
        .map((vote) => [vote.userId, vote.card]),
    )
    const revealed = currentRound?.revealedAt !== undefined
    const activeBefore = Date.now() - 30_000
    const enrichedParticipants = await Promise.all(
      participants.map(async (participant) => {
        const presence = await context.db
          .query('presences')
          .withIndex('by_participant', (q) =>
            q.eq('participantId', participant._id),
          )
          .unique()
        const lastSeenAt =
          presence?.lastSeenAt ??
          participant.lastSeenAt ??
          participant._creationTime
        if (lastSeenAt <= activeBefore) return null

        let user = null
        if (!participant.userId.startsWith('guest:')) {
          try {
            user = await context.db.get(participant.userId as Id<'users'>)
          } catch {
            // Legacy participants may reference Better Auth IDs, not users IDs.
          }
        }

        return {
          ...participant,
          name:
            user?.displayName ??
            user?.username ??
            presence?.guestName ??
            participant.guestName ??
            participant.name ??
            'Invité',
          avatarUrl: user?.avatarUrl ?? participant.avatar ?? null,
          avatarFrameId: user?.avatarFrameId ?? null,
          isSpectator: participant.isSpectator ?? false,
          hasVoted: votesByUserId.has(participant.userId),
          vote:
            revealed || participant.userId === currentUserId
              ? (votesByUserId.get(participant.userId) ?? null)
              : null,
        }
      }),
    )

    return {
      refinement,
      round: currentRound,
      reactions,
      participants: enrichedParticipants.filter(
        (participant) => participant !== null,
      ),
    }
  },
})
