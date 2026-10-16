import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const participantTable = defineTable({
  refinementId: v.id('refinements'),
  userId: v.string(),
  joinedAt: v.optional(v.number()),
  lastSeenAt: v.optional(v.number()),
  guestName: v.optional(v.string()),
  name: v.optional(v.string()),
  avatar: v.optional(v.union(v.string(), v.null())),
})
  .index('by_refinement', ['refinementId'])
  .index('by_refinement_and_user', ['refinementId', 'userId'])
