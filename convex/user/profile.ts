import { authComponent } from '../auth/auth'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

async function ensureStatistics(
  context: MutationCtx,
  userId: Id<'users'>,
) {
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
      return { ...existing, ...updatedProfile }
    }
    await ensureStatistics(context, existing._id)
    return existing
  }

  const userId = await context.db.insert('users', {
    ...profile,
  })
  await ensureStatistics(context, userId)
  return { _id: userId, ...profile }
}
