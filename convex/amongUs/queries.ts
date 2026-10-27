import { v } from 'convex/values'
import { query } from '../_generated/server'

export const list = query({
  args: { slug: v.string() },
  handler: async (context, { slug }) => {
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!refinement) return []

    const players = await context.db
      .query('amongUsPlayers')
      .withIndex('by_refinement', (q) => q.eq('refinementId', refinement._id))
      .collect()

    return players.map((player) => ({
      userId: player.userId,
      x: player.x,
      y: player.y,
      dir: player.dir,
      updatedAt: player.updatedAt,
      hitAt: player.hitAt,
      hitDx: player.hitDx,
      hitDy: player.hitDy,
      hitPower: player.hitPower,
      pushAt: player.pushAt,
      pushDx: player.pushDx,
    }))
  },
})
