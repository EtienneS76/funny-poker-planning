import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { resolveActor } from '../refinement/actor'
import {
  ARROWS_PER_ROUND,
  BODY_DAMAGE,
  HEADSHOT_DAMAGE,
  HEALTH,
  MAX_ARROW_SPEED,
  MIN_ACTIVE_PARTICIPANTS,
  MIN_AUTHENTICATED_PARTICIPANTS,
  POKISOUS_PER_HIT,
  SHOT_LIFETIME_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './rules'

const PRESENCE_TIMEOUT_MS = 10 * 60_000
const JUMP_COOLDOWN_MS = 500
const PARRY_COOLDOWN_MS = 2_500 // le client limite à 3 s : marge réseau
const SHOT_RETENTION_MS = 2 * 60_000
const PLAYER_RETENTION_MS = 24 * 60 * 60_000

function findPlayer(
  context: MutationCtx,
  refinementId: Id<'refinements'>,
  userId: string,
) {
  return context.db
    .query('archeryPlayers')
    .withIndex('by_refinement_and_user', (q) =>
      q.eq('refinementId', refinementId).eq('userId', userId),
    )
    .unique()
}

async function currentRoundKey(
  context: MutationCtx,
  refinementId: Id<'refinements'>,
) {
  const rounds = await context.db
    .query('refinementRounds')
    .withIndex('by_refinement_sequence', (q) =>
      q.eq('refinementId', refinementId),
    )
    .order('desc')
    .take(1)
  return rounds[0] ? String(rounds[0]._id) : 'none'
}

/** Flèche cosmétique équipée par un compte (rien pour un invité). */
async function arrowSkinOf(context: MutationCtx, userId: string) {
  if (userId.startsWith('guest:')) return undefined
  try {
    return (await context.db.get(userId as Id<'users'>))?.arrowSkinId
  } catch {
    return undefined // ancien identifiant qui ne pointe pas vers `users`
  }
}

const damageOf = (player: Doc<'archeryPlayers'>, roundKey: string) =>
  player.damageRound === roundKey ? (player.damage ?? 0) : 0

async function getOrCreatePlayer(
  context: MutationCtx,
  refinementId: Id<'refinements'>,
  userId: string,
): Promise<Doc<'archeryPlayers'>> {
  const existing = await findPlayer(context, refinementId, userId)
  if (existing) return existing
  const id = await context.db.insert('archeryPlayers', {
    refinementId,
    userId,
    crouch: false,
    away: false,
    arrowsUsed: 0,
    hits: 0,
    updatedAt: Date.now(),
  })
  return (await context.db.get(id))!
}

/** Posture du joueur : accroupi, saut (événement), arc bandé, onglet masqué. */
export const setPose = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    crouch: v.boolean(),
    jump: v.boolean(),
    parry: v.boolean(),
    away: v.boolean(),
    aiming: v.boolean(),
    aim: v.number(),
  },
  returns: v.null(),
  handler: async (
    context,
    { slug, guestId, crouch, jump, parry, away, aiming, aim },
  ) => {
    if (!Number.isFinite(aim)) return null
    const actor = await resolveActor(context, slug, guestId)
    if (!actor) return null
    const player = await getOrCreatePlayer(
      context,
      actor.refinement._id,
      actor.userId,
    )
    const now = Date.now()
    const canJump =
      jump &&
      (player.jumpAt === undefined || now - player.jumpAt >= JUMP_COOLDOWN_MS)
    const canParry =
      parry &&
      (player.parryAt === undefined ||
        now - player.parryAt >= PARRY_COOLDOWN_MS)
    const skin = await arrowSkinOf(context, actor.userId)
    const aimChanged =
      (player.aiming === true) !== aiming || (aiming && player.aim !== aim)
    if (
      player.crouch === crouch &&
      player.away === away &&
      player.skin === skin &&
      !aimChanged &&
      !canJump &&
      !canParry
    )
      return null
    await context.db.patch(player._id, {
      crouch,
      away,
      aiming,
      aim,
      skin,
      ...(canParry ? { parryAt: now } : {}),
      ...(canJump ? { jumpAt: now } : {}),
      updatedAt: now,
    })
    return null
  },
})

/**
 * Tire une flèche. Le serveur tient les règles : 2 flèches par manche, il faut
 * avoir voté (sauf spectateur) et ne pas être éliminé. La trajectoire est
 * simulée par les clients à partir de l'origine et de la vitesse.
 */
export const shoot = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    clientId: v.string(),
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),
  },
  returns: v.boolean(),
  handler: async (context, { slug, guestId, clientId, x, y, vx, vy }) => {
    if (![x, y, vx, vy].every(Number.isFinite) || clientId.length > 40)
      return false
    if (
      x < -100 ||
      x > WORLD_WIDTH + 100 ||
      y < -300 ||
      y > WORLD_HEIGHT + 100 ||
      Math.hypot(vx, vy) > MAX_ARROW_SPEED
    )
      return false
    const actor = await resolveActor(context, slug, guestId)
    if (!actor || actor.refinement.funInteractionsEnabled === false)
      return false

    const player = await getOrCreatePlayer(
      context,
      actor.refinement._id,
      actor.userId,
    )
    const roundKey = await currentRoundKey(context, actor.refinement._id)
    const used = player.roundKey === roundKey ? player.arrowsUsed : 0
    if (used >= ARROWS_PER_ROUND) return false
    if (damageOf(player, roundKey) >= HEALTH) return false
    if (!actor.participant.isSpectator) {
      // on ne tire qu'après avoir voté dans la manche en cours
      const votes = await context.db
        .query('votes')
        .withIndex('by_refinement', (q) =>
          q.eq('refinementId', actor.refinement._id),
        )
        .collect()
      const voted = votes.some(
        (vote) =>
          vote.userId === actor.userId && String(vote.roundId) === roundKey,
      )
      if (!voted) return false
    }

    const now = Date.now()
    const skin = await arrowSkinOf(context, actor.userId)
    await context.db.patch(player._id, {
      roundKey,
      skin,
      arrowsUsed: used + 1,
      aiming: false, // la flèche est partie : l'arc se baisse chez tout le monde
      updatedAt: now,
    })
    await context.db.insert('archeryShots', {
      refinementId: actor.refinement._id,
      shooterId: actor.userId,
      clientId,
      x,
      y,
      vx,
      vy,
      firedAt: now,
      skin,
    })
    return true
  },
})

/** Même règle que le Skirmish : 3 participants actifs dont 2 comptes. */
async function rewardsOpen(
  context: MutationCtx,
  refinementId: Id<'refinements'>,
) {
  const participants = await context.db
    .query('participants')
    .withIndex('by_refinement', (q) => q.eq('refinementId', refinementId))
    .collect()
  const activeBefore = Date.now() - PRESENCE_TIMEOUT_MS
  let active = 0
  let authenticated = 0
  for (const participant of participants) {
    const presence = await context.db
      .query('presences')
      .withIndex('by_participant', (q) =>
        q.eq('participantId', participant._id),
      )
      .unique()
    const lastSeenAt =
      presence?.lastSeenAt ??
      participant.lastSeenAt ??
      participant._creationTime
    if (lastSeenAt <= activeBefore) continue
    active++
    if (!participant.userId.startsWith('guest:')) authenticated++
  }
  return (
    active >= MIN_ACTIVE_PARTICIPANTS &&
    authenticated >= MIN_AUTHENTICATED_PARTICIPANTS
  )
}

/**
 * Une flèche a touché. C'est la cible qui arbitre (elle seule voit son esquive
 * sans décalage réseau) ; si son onglet est masqué, c'est le tireur. Le tireur
 * gagne ses Pokisous ici.
 */
export const reportHit = mutation({
  args: {
    slug: v.string(),
    guestId: v.string(),
    shotId: v.id('archeryShots'),
    targetUserId: v.string(),
    headshot: v.boolean(),
  },
  returns: v.null(),
  handler: async (
    context,
    { slug, guestId, shotId, targetUserId, headshot },
  ) => {
    const actor = await resolveActor(context, slug, guestId)
    if (!actor) return null
    const shot = await context.db.get(shotId)
    const now = Date.now()
    if (
      !shot ||
      shot.refinementId !== actor.refinement._id ||
      shot.hitUserId !== undefined ||
      shot.shooterId === targetUserId ||
      now - shot.firedAt > SHOT_LIFETIME_MS
    )
      return null

    const target = await findPlayer(
      context,
      actor.refinement._id,
      targetUserId,
    )
    if (actor.userId !== targetUserId) {
      // seul le tireur peut arbitrer à la place d'une cible absente
      if (actor.userId !== shot.shooterId || (target && !target.away))
        return null
      const participant = await context.db
        .query('participants')
        .withIndex('by_refinement_and_user', (q) =>
          q.eq('refinementId', actor.refinement._id).eq('userId', targetUserId),
        )
        .unique()
      if (!participant) return null
    }

    // points de vie de la manche : la tête tue, le corps encaisse une flèche
    const roundKey = await currentRoundKey(context, actor.refinement._id)
    const victim =
      target ??
      (await getOrCreatePlayer(context, actor.refinement._id, targetUserId))
    const damageBefore = damageOf(victim, roundKey)
    if (damageBefore >= HEALTH) return null // déjà éliminé
    const damage = damageBefore + (headshot ? HEADSHOT_DAMAGE : BODY_DAMAGE)
    await context.db.patch(victim._id, {
      damage,
      damageRound: roundKey,
      aiming: false,
      updatedAt: now,
    })

    let rewarded = false
    if (
      !shot.shooterId.startsWith('guest:') &&
      (await rewardsOpen(context, actor.refinement._id))
    ) {
      const wallet = await context.db
        .query('pokisouWallets')
        .withIndex('by_user_id', (q) => q.eq('userId', shot.shooterId))
        .unique()
      if (wallet)
        await context.db.patch(wallet._id, {
          balance: wallet.balance + POKISOUS_PER_HIT,
        })
      else
        await context.db.insert('pokisouWallets', {
          userId: shot.shooterId,
          balance: POKISOUS_PER_HIT,
        })
      rewarded = true
    }

    await context.db.patch(shot._id, {
      hitUserId: targetUserId,
      headshot,
      rewarded,
      kill: damage >= HEALTH,
    })
    const shooter = await findPlayer(
      context,
      actor.refinement._id,
      shot.shooterId,
    )
    if (shooter)
      await context.db.patch(shooter._id, { hits: shooter.hits + 1 })
    return null
  },
})

/** Purge les vieilles flèches et les joueurs partis depuis longtemps (cron). */
export const cleanup = internalMutation({
  args: {},
  handler: async (context) => {
    const now = Date.now()
    const shots = await context.db
      .query('archeryShots')
      .withIndex('by_fired', (q) => q.lt('firedAt', now - SHOT_RETENTION_MS))
      .take(200)
    for (const shot of shots) await context.db.delete(shot._id)
    const players = await context.db
      .query('archeryPlayers')
      .withIndex('by_updated', (q) =>
        q.lt('updatedAt', now - PLAYER_RETENTION_MS),
      )
      .take(200)
    for (const player of players) await context.db.delete(player._id)
  },
})
