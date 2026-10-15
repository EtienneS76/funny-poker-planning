import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const participantTable = defineTable({
  refinementId: v.id('refinements'),
  userId: v.string(),
  name: v.string(),
  avatar: v.union(v.string(), v.null()),
})
  .index('by_refinement', ['refinementId'])
  .index('by_refinement_and_user', ['refinementId', 'userId'])
