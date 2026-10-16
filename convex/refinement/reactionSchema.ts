import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const reactionKind = v.union(
  v.literal('tomato'),
  v.literal('poop'),
  v.literal('egg'),
  v.literal('soap'),
)

export const reactionTable = defineTable({
  refinementId: v.id('refinements'),
  sourceUserId: v.string(),
  targetUserId: v.string(),
  kind: reactionKind,
  createdAt: v.number(),
  hatched: v.boolean(),
  dodged: v.boolean(),
  escapeAngle: v.union(v.number(), v.null()),
})
  .index('by_refinement_created', ['refinementId', 'createdAt'])
  .index('by_refinement_source_created', [
    'refinementId',
    'sourceUserId',
    'createdAt',
  ])
  .index('by_created', ['createdAt'])