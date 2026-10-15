import { v } from 'convex/values'
import { mutation } from '../_generated/server'

export const create = mutation({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (context, args) => {
    const slug = 'testSlug'
    const creatorId = 'creatorId'
    const creatorName = 'creatorName'
    const creatorAvatar = null

    const refinementId = await context.db.insert('refinements', {
      slug,
      creatorId,
      creatorName,
      creatorAvatar,
    })

    // Add participant entry for the creator
    await context.db.insert('participants', {
      refinementId,
      userId: creatorId,
      name: creatorName,
      avatar: creatorAvatar,
    })

    return refinementId
  },
})
