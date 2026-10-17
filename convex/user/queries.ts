import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authComponent } from '../auth/auth'

export const pokisous = query({
  args: {},
  returns: v.number(),
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return 0

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return 0

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    return wallet?.balance ?? 0
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
      firstConnectedAt: user._creationTime,
      statistics,
    }
  },
})
