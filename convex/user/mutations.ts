import { ConvexError, v } from 'convex/values'
import { mutation, type MutationCtx } from '../_generated/server'
import { avatarFrameCatalog } from './avatarFrames'
import { syncAuthenticatedUser } from './profile'

async function requireAuthenticatedUser(context: MutationCtx) {
  if (!(await context.auth.getUserIdentity())) {
    throw new ConvexError('Connecte-toi pour gérer ton inventaire.')
  }
  return syncAuthenticatedUser(context)
}

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

export const buyAvatarFrame = mutation({
  args: { frameId: v.string() },
  returns: v.null(),
  handler: async (context, { frameId }) => {
    const frame = avatarFrameCatalog.find((item) => item.id === frameId)
    if (!frame) throw new ConvexError('Ce cadre n’existe pas.')

    const user = await requireAuthenticatedUser(context)
    const existing = await context.db
      .query('userAvatarFrames')
      .withIndex('by_user_frame', (query) =>
        query.eq('userId', user._id).eq('frameId', frameId),
      )
      .unique()
    if (existing) throw new ConvexError('Tu possèdes déjà ce cadre.')

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    if (!wallet || wallet.balance < frame.price) {
      throw new ConvexError('Tu n’as pas assez de Pokisous pour ce cadre.')
    }

    await context.db.patch(wallet._id, {
      balance: wallet.balance - frame.price,
    })
    await context.db.insert('userAvatarFrames', {
      userId: user._id,
      frameId,
      purchasedAt: Date.now(),
    })
    return null
  },
})

export const equipAvatarFrame = mutation({
  args: { frameId: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (context, { frameId }) => {
    const user = await requireAuthenticatedUser(context)
    if (frameId !== null) {
      if (!avatarFrameCatalog.some((frame) => frame.id === frameId)) {
        throw new ConvexError('Ce cadre n’existe pas.')
      }
      const ownedFrame = await context.db
        .query('userAvatarFrames')
        .withIndex('by_user_frame', (query) =>
          query.eq('userId', user._id).eq('frameId', frameId),
        )
        .unique()
      if (!ownedFrame) throw new ConvexError('Tu ne possèdes pas ce cadre.')
    }

    await context.db.patch(user._id, { avatarFrameId: frameId ?? undefined })
    return null
  },
})
