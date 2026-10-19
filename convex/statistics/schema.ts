import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const statisticsTable = defineTable({
  userId: v.id('users'),
  refinementCount: v.number(),
  roundCount: v.number(),
  mysteryPokeBallOpenCount: v.optional(v.number()),
  firstConnectedAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
}).index('by_user', ['userId'])

export const userRoundParticipationTable = defineTable({
  userId: v.id('users'),
  refinementId: v.id('refinements'),
  roundId: v.optional(v.id('refinementRounds')),
  roundNumber: v.optional(v.number()),
  votedAt: v.number(),
})
  .index('by_user_refinement_round', ['userId', 'refinementId', 'roundId'])
  .index('by_user_refinement', ['userId', 'refinementId'])
  .index('by_refinement', ['refinementId'])