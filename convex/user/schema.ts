import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const userTable = defineTable({
  authUserId: v.string(),
  username: v.string(),
  displayName: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  avatarFrameId: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
}).index('by_auth_user', ['authUserId'])

export const pokisouWalletTable = defineTable({
  userId: v.string(),
  balance: v.number(),
}).index('by_user_id', ['userId'])

export const userAvatarFramesTable = defineTable({
  userId: v.id('users'),
  frameId: v.string(),
  purchasedAt: v.number(),
})
  .index('by_user', ['userId'])
  .index('by_user_frame', ['userId', 'frameId'])
