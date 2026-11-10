import { v } from 'convex/values'
import { query } from '../_generated/server'
import { ARROWS_PER_ROUND, HEALTH } from './rules'

const RECENT_SHOTS = 16

/** Postures, carquois et dernières flèches de la salle. */
export const state = query({
  args: { slug: v.string() },
  handler: async (context, { slug }) => {
    const refinement = await context.db
      .query('refinements')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!refinement) return null

    const rounds = await context.db
      .query('refinementRounds')
      .withIndex('by_refinement_sequence', (q) =>
        q.eq('refinementId', refinement._id),
      )
      .order('desc')
      .take(1)
    const roundKey = rounds[0] ? String(rounds[0]._id) : 'none'

    const players = await context.db
      .query('archeryPlayers')
      .withIndex('by_refinement', (q) => q.eq('refinementId', refinement._id))
      .collect()
    const shots = await context.db
      .query('archeryShots')
      .withIndex('by_refinement_fired', (q) =>
        q.eq('refinementId', refinement._id),
      )
      .order('desc')
      .take(RECENT_SHOTS)

    return {
      enabled: refinement.funInteractionsEnabled !== false,
      roundKey,
      players: players.map((player) => ({
        userId: player.userId,
        crouch: player.crouch,
        aiming: player.aiming === true,
        aim: player.aim ?? 0,
        jumpAt: player.jumpAt,
        parryAt: player.parryAt,
        skin: player.skin,
        away: player.away,
        arrowsLeft:
          player.roundKey === roundKey
            ? Math.max(0, ARROWS_PER_ROUND - player.arrowsUsed)
            : ARROWS_PER_ROUND,
        hits: player.hits,
        health:
          player.damageRound === roundKey
            ? Math.max(0, HEALTH - (player.damage ?? 0))
            : HEALTH,
      })),
      shots: shots.map((shot) => ({
        id: String(shot._id),
        shooterId: shot.shooterId,
        clientId: shot.clientId,
        x: shot.x,
        y: shot.y,
        vx: shot.vx,
        vy: shot.vy,
        skin: shot.skin,
        hitUserId: shot.hitUserId,
        headshot: shot.headshot,
        kill: shot.kill,
        rewarded: shot.rewarded,
      })),
    }
  },
})
