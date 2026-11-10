import { useCallback, useEffect, useRef } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { ArcheryPose, ArcheryShot, ArcheryState } from '../themes/types'

type Options = {
  slug: string
  guestId: string
  /** Thème tir à l'arc actif : sinon on ne s'abonne à rien. */
  active: boolean
}

/**
 * Synchronisation du thème « Tir à l'arc » (Convex).
 *
 * Rien n'est envoyé en continu : une posture, un tir ou un impact = un message.
 * L'état ne passe pas par `useQuery` pour ne pas re-rendre toute la salle à
 * chaque flèche ; le thème s'abonne directement.
 */
export function useArcherySync({ slug, guestId, active }: Options) {
  const convex = useConvex()
  const setPoseMutation = useMutation(api.archery.mutations.setPose)
  const shootMutation = useMutation(api.archery.mutations.shoot)
  const reportHitMutation = useMutation(api.archery.mutations.reportHit)

  const subscribe = useCallback(
    (listener: (state: ArcheryState) => void) => {
      if (!active) return () => undefined
      const watch = convex.watchQuery(api.archery.queries.state, { slug })
      const notify = () => {
        try {
          const state = watch.localQueryResult()
          if (state) listener(state)
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

  // Une seule écriture de posture en vol : si le réseau est lent on n'empile
  // pas, seule la dernière posture part (sans jamais perdre un saut ni une parade).
  const inFlight = useRef(false)
  const pending = useRef<ArcheryPose | null>(null)
  const send = useRef<(pose: ArcheryPose) => void>(() => undefined)
  useEffect(() => {
    send.current = (pose) => {
      if (inFlight.current) {
        pending.current = {
          ...pose,
          jump: pose.jump || Boolean(pending.current?.jump),
          parry: pose.parry || Boolean(pending.current?.parry),
        }
        return
      }
      inFlight.current = true
      void setPoseMutation({ slug, guestId, ...pose })
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false
          const next = pending.current
          pending.current = null
          if (next) send.current(next)
        })
    }
  }, [guestId, setPoseMutation, slug])

  const setPose = useCallback((pose: ArcheryPose) => {
    send.current(pose)
  }, [])

  const shoot = useCallback(
    (shot: ArcheryShot) =>
      shootMutation({ slug, guestId, ...shot }).catch(() => false),
    [guestId, shootMutation, slug],
  )

  const reportHit = useCallback(
    (shotId: string, targetUserId: string, headshot: boolean) => {
      void reportHitMutation({
        slug,
        guestId,
        shotId: shotId as Id<'archeryShots'>,
        targetUserId,
        headshot,
      }).catch(() => undefined)
    },
    [guestId, reportHitMutation, slug],
  )

  return { subscribe, setPose, shoot, reportHit }
}
