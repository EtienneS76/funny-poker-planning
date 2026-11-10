import { useEffect, useRef } from 'react'
import type { RoomProps } from '../types'
import {
  ArcheryEngine,
  type ArcherDef,
  type Rect,
} from './engine/ArcheryEngine'
// dos de carte et designs réutilisés pour le vote affiché sous chaque plateforme
import '../among-us/among-us.css'
import './archery.css'

/**
 * Thème « Tir à l'arc » : chaque joueur est un bonhomme bâton sur sa
 * plateforme, autour de la table. Clic-glissé pour bander l'arc (on tire dans
 * le sens opposé, comme un lance-pierre), Z pour sauter, S pour s'accroupir.
 * 2 flèches par manche ; une flèche au but rapporte 2 Pokisous.
 *
 * La zone de jeu est lue dans le DOM de la salle : entre la barre du haut et
 * la main de cartes.
 */

function readArena(): Rect {
  const viewportHeight = window.innerHeight
  const room = document.querySelector('.multivers--room .pp-room')
  const hand = document.querySelector('.multivers--room .pp-hand-area')
  let top = 0
  let bottom = viewportHeight
  if (room) top = Math.max(0, room.getBoundingClientRect().top)
  if (hand) bottom = Math.min(viewportHeight, hand.getBoundingClientRect().top)
  if (bottom - top < 160) {
    top = 0
    bottom = viewportHeight
  }
  return { left: 0, top, width: window.innerWidth, height: bottom - top }
}

export function ArcheryLayer({ vm }: RoomProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ArcheryEngine | null>(null)
  // dernier view model, lu par les callbacks du moteur (créé une seule fois)
  const latest = useRef(vm)

  useEffect(() => {
    latest.current = vm
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = new ArcheryEngine(host, {
      getArena: readArena,
      onPose: (pose) => latest.current.archery.setPose(pose),
      onShoot: (shot) => latest.current.archery.shoot(shot),
      onHit: (shotId, targetId, headshot) =>
        latest.current.archery.reportHit(shotId, targetId, headshot),
    })
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  // joueurs de la salle -> archers (nom, vote visible sous la plateforme)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const defs: ArcherDef[] = vm.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      isSpectator: seat.isSpectator,
      card: {
        voted: !seat.isSpectator && seat.hasVoted,
        revealed: vm.table.revealed,
        value: seat.vote,
        designId: seat.cardDesignId,
      },
    }))
    engine.setPlayers(defs)
    engine.setLocalId(vm.seats.find((seat) => seat.isMe)?.id ?? null)
  }, [vm.seats, vm.table.revealed])

  // postures et flèches venues de Convex, sans passer par un rendu React
  const { subscribe } = vm.archery
  useEffect(
    () => subscribe((state) => engineRef.current?.applyState(state)),
    [subscribe],
  )

  return <div ref={hostRef} className='ar-layer' aria-hidden='true' />
}
