import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const refinementTable = defineTable({
  slug: v.string(),
  creatorId: v.string(), // id Better Auth founris un string donc pas v.id
  creatorName: v.string(),
  creatorAvatar: v.union(v.string(), v.null()),
})
  .index('by_slug', ['slug'])
  .index('by_creator', ['creatorId'])
