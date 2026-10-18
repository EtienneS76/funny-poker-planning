import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const refinementTable = defineTable({
  slug: v.string(),
  creatorId: v.string(), // id Better Auth founris un string donc pas v.id
  sizing: v.optional(v.string()),
  issueUrl: v.optional(v.union(v.string(), v.null())),
  funInteractionsEnabled: v.optional(v.boolean()),
  // Legacy fields remain optional until existing documents are migrated.
  name: v.optional(v.string()),
  savedAt: v.optional(v.number()),
  roundNumber: v.optional(v.number()),
  revealedAt: v.optional(v.number()),
  universe: v.optional(v.string()),
  creatorName: v.optional(v.string()),
  creatorAvatar: v.optional(v.union(v.string(), v.null())),
})
  .index('by_slug', ['slug'])
  .index('by_creator', ['creatorId'])
