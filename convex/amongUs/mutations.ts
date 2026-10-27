import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { authComponent } from '../auth/auth'

const FALL_MS = 3_000
const PUSH_COOLDOWN_MS = 500 // le client limite à 700 ms : on garde de la marge réseau
const PUSH_MAX_DISTANCE = 0.45 // en hauteurs de zone de jeu ; validation volontairement indulgente
const ARENA_ASPECT = 2.8 // la zone de jeu est ~2,8x plus large que haute
const STALE_MS = 60_000

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Même résolution d'identité que les autres mutations (compte ou invité), sans écriture. */
async function resolveActor(
  context: MutationCtx,
  slug: string,
  guestId: string,
) {
  const refinement = await context.db
    .query('refinements')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
  if (!refinement) return null

  let userId = `guest:${guestId}`
  if (await context.auth.getUserIdentity()) {
    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (q) =>
        q.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return null
    userId = String(user._id)
  }

  const participant = await context.db
    .query('participants')
    .withIndex('by_refinement_and_user', (q) =>
      q.eq('refinementId', refinement._id).eq('userId', userId),
    )
    .unique()
  if (!participant) return null

  return { refinement, userId }
}

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
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, x, y, dir }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const actor = await resolveActor(context, slug, guestId)
    if (!actor) return null

    const next = {
      x: clamp01(x),
      y: clamp01(y),
      dir: dir < 0 ? -1 : 1,
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
  },
  returns: v.null(),
  handler: async (context, { slug, guestId, targetUserId }) => {
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
      if (distance <= PUSH_MAX_DISTANCE) {
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
