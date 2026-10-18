import { useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAccount } from '../../auth/useAccount'

export function useRefinementRoom(slug: string) {
  const account = useAccount()

  const room = useQuery(api.refinement.queries.getBySlug, {
    slug,
    guestId: account.guestId,
  })

  const join = useMutation(api.refinement.mutations.join)
  const heartbeat = useMutation(api.refinement.mutations.heartbeat)

  const roomId = room?.refinement._id

  useEffect(() => {
    if (
      account.loading ||
      !roomId ||
      (account.isAuthenticated ? !account.profileId : !account.guestId)
    ) {
      return
    }
    const presence = {
      slug,
      guestId: account.guestId,
      guestName: account.user?.username ?? account.guestName,
    }
    void join(presence).catch(() => undefined)
    const interval = window.setInterval(() => {
      void heartbeat(presence).catch(() => undefined)
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [
    account.guestId,
    account.guestName,
    account.isAuthenticated,
    account.loading,
    account.profileId,
    account.user?.username,
    heartbeat,
    join,
    roomId,
    slug,
  ])

  return room // undefined = chargement, null = introuvable, sinon { refinement, participants }
}
