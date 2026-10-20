import { authComponent } from '../auth/auth'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

async function ensureStatistics(context: MutationCtx, userId: Id<'users'>) {
  const existing = await context.db
    .query('statistics')
    .withIndex('by_user', (query) => query.eq('userId', userId))
    .unique()

  if (!existing) {
    await context.db.insert('statistics', {
      userId,
      refinementCount: 0,
      roundCount: 0,
    })
  } else if (
    existing.firstConnectedAt !== undefined ||
    existing.updatedAt !== undefined
  ) {
    await context.db.patch(existing._id, {
      firstConnectedAt: undefined,
      updatedAt: undefined,
    })
  }
}

async function ensureStarterCaptureBalls(
  context: MutationCtx,
  userId: Id<'users'>,
  giftedAt: number | undefined,
) {
  if (giftedAt !== undefined) return

  const now = Date.now()
  const ownedBalls = await context.db
    .query('userConsumables')
    .withIndex('by_user_consumable', (query) =>
      query.eq('userId', userId).eq('consumableId', 'poke-ball'),
    )
    .unique()

  if (ownedBalls) {
    await context.db.patch(ownedBalls._id, {
      quantity: ownedBalls.quantity + 3,
      updatedAt: now,
    })
  } else {
    await context.db.insert('userConsumables', {
      userId,
      consumableId: 'poke-ball',
      quantity: 3,
      updatedAt: now,
    })
  }

  await context.db.patch(userId, { starterCaptureBallsGiftedAt: now })
}

export async function syncAuthenticatedUser(context: MutationCtx) {
  const authUser = await authComponent.getAuthUser(context)
  const authUserId = String(authUser._id)
  const existing = await context.db
    .query('users')
    .withIndex('by_auth_user', (query) => query.eq('authUserId', authUserId))
    .unique()
  const profile = {
    authUserId,
    username: authUser.name,
    avatarUrl: authUser.image ?? null,
  }

  if (existing) {
    if (
      existing.username !== profile.username ||
      existing.avatarUrl !== profile.avatarUrl ||
      existing.createdAt !== undefined ||
      existing.updatedAt !== undefined
    ) {
      const updatedProfile = {
        ...profile,
        createdAt: undefined,
        updatedAt: undefined,
      }
      await context.db.patch(existing._id, updatedProfile)
      await ensureStatistics(context, existing._id)
      await ensureStarterCaptureBalls(
        context,
        existing._id,
        existing.starterCaptureBallsGiftedAt,
      )
      return { ...existing, ...updatedProfile }
    }
    await ensureStatistics(context, existing._id)
    await ensureStarterCaptureBalls(
      context,
      existing._id,
      existing.starterCaptureBallsGiftedAt,
    )
    return existing
  }

  const userId = await context.db.insert('users', {
    ...profile,
  })
  await ensureStatistics(context, userId)
  await ensureStarterCaptureBalls(context, userId, undefined)
  return { _id: userId, ...profile }
}
