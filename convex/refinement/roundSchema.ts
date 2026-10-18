import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const refinementRoundTable = defineTable({
  refinementId: v.id('refinements'),
  sequence: v.number(),
  firstVoteAt: v.optional(v.number()),
  revealedAt: v.optional(v.number()),
}).index('by_refinement_sequence', ['refinementId', 'sequence'])