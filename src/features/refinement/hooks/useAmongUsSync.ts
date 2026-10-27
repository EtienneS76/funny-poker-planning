import { useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { AmongUsLocalState } from '../themes/types'

type Options = {
  slug: string
  guestId: string
  /** Thème Among Us actif : sinon on ne s'abonne à rien. */
  active: boolean
}

/**
 * Synchronisation temps réel des positions et des poussées (Convex).
 * Les écritures sont limitées par le moteur (~4/s en mouvement, 1 toutes les
 * 5 s à l'arrêt) ; les erreurs réseau sont ignorées, la position suivante
 * corrige tout.
 */
export function useAmongUsSync({ slug, guestId, active }: Options) {
  const players = useQuery(
    api.amongUs.queries.list,
    active ? { slug } : 'skip',
  )
  const moveMutation = useMutation(api.amongUs.mutations.move)
  const pushMutation = useMutation(api.amongUs.mutations.push)

  const move = useCallback(
    (state: AmongUsLocalState) => {
      void moveMutation({ slug, guestId, ...state }).catch(() => undefined)
    },
    [guestId, moveMutation, slug],
  )

  const push = useCallback(
    (targetUserId: string | null) => {
      void pushMutation({ slug, guestId, targetUserId }).catch(
        () => undefined,
      )
    },
    [guestId, pushMutation, slug],
  )

  return { players, move, push }
}
