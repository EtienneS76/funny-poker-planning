import { query } from '../_generated/server'
import { authComponent } from '../auth/auth'

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