import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { syncAuthenticatedUser } from './profile'

export const syncCurrent = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (context) => {
    const profile = await syncAuthenticatedUser(context)
    return profile._id
  },
})

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (context, { displayName }) => {
    const name = displayName.trim()
    if (!name || name.length > 36) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }

    const user = await syncAuthenticatedUser(context)
    await context.db.patch(user._id, { displayName: name })
    return null
  },
})