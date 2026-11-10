import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { resolveActor } from '../refinement/actor'

const FALL_MS = 3_000
const PUSH_COOLDOWN_MS = 500 // le client limite à 700 ms : on garde de la marge réseau
const PUSH_MAX_DISTANCE = 0.45 // en hauteurs de zone de jeu ; validation volontairement indulgente
const ARENA_ASPECT = 2.8 // la zone de jeu est ~2,8x plus large que haute
const STALE_MS = 60_000

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const MAX_VELOCITY = 4 // en zones de jeu par seconde : large, même pour une grosse éjection
const clampVelocity = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value)
    ? Math.min(MAX_VELOCITY, Math.max(-MAX_VELOCITY, value))
    : 0

function findPlayer(
  context: MutationCtx,
  refinementId: Id<'refinements'>,
  userId: string,
) {
  return context.db
    .query('amongUsPlayers')
    .withIndex('by_refinement_and_user', (q) =>
      q.eq('refinementId', refinementId).eq('userId', userId),
    )
    .unique()
}

const isFallen = (player: Doc<'amongUsPlayers'>, now: number) =>
  player.fallenUntil !== undefined && player.fallenUntil > now

export const move = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    x: v.number(),
    y: v.number(),
    dir: v.number(),
    // vitesse (unités normalisées / seconde) : les autres clients extrapolent entre deux envois
    vx: v.optional(v.number()),
    vy: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, x, y, dir, vx, vy }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const actor = await resolveActor(context, slug, guestId)
    if (!actor) return null

    const next = {
      x: clamp01(x),
      y: clamp01(y),
      dir: dir < 0 ? -1 : 1,
      vx: clampVelocity(vx),
      vy: clampVelocity(vy),
      updatedAt: Date.now(),
    }
    const existing = await findPlayer(
      context,
      actor.refinement._id,
      actor.userId,
    )
    if (existing) await context.db.patch(existing._id, next)
    else
      await context.db.insert('amongUsPlayers', {
        refinementId: actor.refinement._id,
        userId: actor.userId,
        ...next,
      })
    return null
  },
})

/**
 * Pousse un joueur (ou rate son coup si targetUserId est null). Le serveur
 * décide : cooldown, cible déjà au sol, distance, interactions activées.
 * Tous les clients voient ensuite `hitAt` / `pushAt` changer.
 */
export const push = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    targetUserId: v.union(v.string(), v.null()),
    power: v.number(),
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, targetUserId, power }) => {
    if (!Number.isFinite(power)) return null
    const charge = clamp01(power)
    const actor = await resolveActor(context, slug, guestId)
    if (!actor || actor.refinement.funInteractionsEnabled === false) return null

    const now = Date.now()
    const source = await findPlayer(
      context,
      actor.refinement._id,
      actor.userId,
    )
    if (!source || isFallen(source, now)) return null
    if (source.pushAt !== undefined && now - source.pushAt < PUSH_COOLDOWN_MS)
      return null

    let pushDx = source.dir
    const target =
      targetUserId && targetUserId !== actor.userId
        ? await findPlayer(context, actor.refinement._id, targetUserId)
        : null

    if (target && !isFallen(target, now)) {
      let kx = (target.x - source.x) * ARENA_ASPECT
      let ky = target.y - source.y
      const distance = Math.hypot(kx, ky)
      const maxDistance = PUSH_MAX_DISTANCE * (0.55 + charge * 0.45)
      if (distance <= maxDistance) {
        kx /= distance || 1
        ky /= distance || 1
        // la victime tombe toujours sur le côté
        if (Math.abs(kx) < 0.3) kx = source.dir < 0 ? -0.6 : 0.6
        pushDx = kx
        await context.db.patch(target._id, {
          fallenUntil: now + FALL_MS,
          hitAt: now,
          hitDx: kx,
          hitDy: ky,
          hitPower: charge,
        })
      }
    }

    await context.db.patch(source._id, { pushAt: now, pushDx })
    return null
  },
})

/** Les positions de joueurs partis (plus de heartbeat) sont purgées par un cron. */
export const cleanupStale = internalMutation({
  args: {},
  handler: async (context) => {
    const stale = await context.db
      .query('amongUsPlayers')
      .withIndex('by_updated', (q) => q.lt('updatedAt', Date.now() - STALE_MS))
      .take(200)
    for (const player of stale) await context.db.delete(player._id)
  },
})
