import type { MutationCtx } from '../_generated/server'
import { authComponent } from '../auth/auth'

/**
 * Identité de l'appelant dans une salle (compte ou invité), sans écriture :
 * même résolution que les mutations de vote. `null` si la salle n'existe pas
 * ou si l'appelant n'y participe pas.
 */
export async function resolveActor(
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

  return { refinement, userId, participant }
}
