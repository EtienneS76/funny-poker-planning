import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const voteTable = defineTable({
  refinementId: v.id('refinements'),
  userId: v.string(),
  roundId: v.optional(v.id('refinementRounds')),
  roundNumber: v.optional(v.number()),
  card: v.string(),
})
  .index('by_refinement', ['refinementId'])
  .index('by_refinement_user_round', ['refinementId', 'userId', 'roundId'])