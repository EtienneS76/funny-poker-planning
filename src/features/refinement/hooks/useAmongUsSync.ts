import { useCallback, useEffect, useRef } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { AmongUsLocalState, AmongUsPlayerRecord } from '../themes/types'

type Options = {
  slug: string
  guestId: string
  /** Thème Among Us actif : sinon on ne s'abonne à rien. */
  active: boolean
}

/**
 * Synchronisation temps réel des positions et des poussées (Convex).
 *
 * - Les positions ne passent pas par `useQuery` : elles changent plusieurs fois
 *   par seconde et re-rendraient toute la salle. Le thème s'abonne directement.
 * - Une seule écriture de position en vol à la fois : si le réseau est lent, on
 *   n'empile pas les envois, seul le dernier état part (le débit s'adapte).
 * - Les erreurs réseau sont ignorées, la position suivante corrige tout.
 */
export function useAmongUsSync({ slug, guestId, active }: Options) {
  const convex = useConvex()
  const moveMutation = useMutation(api.amongUs.mutations.move)
  const pushMutation = useMutation(api.amongUs.mutations.push)

  const subscribe = useCallback(
    (listener: (players: AmongUsPlayerRecord[]) => void) => {
      if (!active) return () => undefined
      const watch = convex.watchQuery(api.amongUs.queries.list, { slug })
      const notify = () => {
        try {
          const players = watch.localQueryResult()
          if (players) listener(players)
        } catch {
          // requête en erreur : la prochaine mise à jour corrigera
        }
      }
      const unsubscribe = watch.onUpdate(notify)
      notify()
      return unsubscribe
    },
    [active, convex, slug],
  )

  const inFlight = useRef(false)
  const pending = useRef<AmongUsLocalState | null>(null)
  const send = useRef<(state: AmongUsLocalState) => void>(() => undefined)
  useEffect(() => {
    send.current = (state) => {
      if (inFlight.current) {
        pending.current = state
        return
      }
      inFlight.current = true
      void moveMutation({ slug, guestId, ...state })
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false
          const next = pending.current
          pending.current = null
          if (next) send.current(next)
        })
    }
  }, [guestId, moveMutation, slug])

  const move = useCallback((state: AmongUsLocalState) => {
    send.current(state)
  }, [])

  const push = useCallback(
    (targetUserId: string | null, power: number) => {
      void pushMutation({ slug, guestId, targetUserId, power }).catch(
        () => undefined,
      )
    },
    [guestId, pushMutation, slug],
  )

  return { subscribe, move, push }
}
