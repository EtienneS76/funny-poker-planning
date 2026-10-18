import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authComponent } from '../auth/auth'
import { avatarFrameCatalog } from './avatarFrames'

export const shopData = query({
  args: {},
  returns: v.object({
    balance: v.number(),
    catalog: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.string(),
        rarity: v.union(
          v.literal('common'),
          v.literal('rare'),
          v.literal('legendary'),
          v.literal('ultimate'),
        ),
        price: v.number(),
      }),
    ),
    ownedIds: v.array(v.string()),
    equippedId: v.union(v.string(), v.null()),
  }),
  handler: async (context) => {
    const catalog = avatarFrameCatalog.map((frame) => ({ ...frame }))
    const identity = await context.auth.getUserIdentity()
    if (!identity) {
      return { balance: 0, catalog, ownedIds: [], equippedId: null }
    }

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) {
      return { balance: 0, catalog, ownedIds: [], equippedId: null }
    }

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    const inventory = await context.db
      .query('userAvatarFrames')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()

    return {
      balance: wallet?.balance ?? 0,
      catalog,
      ownedIds: inventory.map((item) => item.frameId),
      equippedId: user.avatarFrameId ?? null,
    }
  },
})

export const current = query({
  args: {},
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return null

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return null

    const statistics = await context.db
      .query('statistics')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()

    return {
      ...user,
      avatarFrameId: user.avatarFrameId ?? null,
      firstConnectedAt: user._creationTime,
      statistics,
    }
  },
})
