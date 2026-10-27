import { useEffect, useRef } from 'react'
import type { RoomProps } from '../types'
import {
  AmongUsEngine,
  type CrewDef,
  type Geometry,
} from './engine/AmongUsEngine'
import './among-us.css'

/**
 * Thème Among Us : les joueurs sont des crewmates qui se baladent autour de la
 * table avec Z Q S D. Espace pousse (3 s au sol); la révélation reste dans les
 * commandes classiques de la salle.
 *
 * La zone de jeu est lue dans le DOM de la salle : entre la barre du haut et la
 * main de cartes, et la vraie table `.pp-table` sert d'obstacle.
 */

function readGeometry(): Geometry {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const room = document.querySelector('.multivers--room .pp-room')
  const hand = document.querySelector('.multivers--room .pp-hand-area')
  const table = document.querySelector('.multivers--room .pp-table')

  let top = 0
  let bottom = viewportHeight
  if (room) top = Math.max(0, room.getBoundingClientRect().top)
  if (hand) bottom = Math.min(viewportHeight, hand.getBoundingClientRect().top)
  if (bottom - top < 160) {
    top = 0
    bottom = viewportHeight
  }

  let tableRect: Geometry['table'] = null
  if (table) {
    const rect = table.getBoundingClientRect()
    tableRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }
  return {
    arena: { left: 0, top, width: viewportWidth, height: bottom - top },
    table: tableRect,
  }
}

export function AmongUsLayer({ vm }: RoomProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<AmongUsEngine | null>(null)
  // dernier view model, lu par les callbacks du moteur (créé une seule fois)
  const latest = useRef(vm)
  // derniers événements vus par joueur : un coup = hitAt / pushAt qui change
  const seen = useRef(
    new Map<string, { hitAt: number | undefined; pushAt: number | undefined }>(),
  )

  useEffect(() => {
    latest.current = vm
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const seenEvents = seen.current
    const engine = new AmongUsEngine(host, {
      localId: null,
      getGeometry: readGeometry,
      onLocalState: (state) => latest.current.amongUs.move(state),
      onPush: (targetId) => latest.current.amongUs.push(targetId),
    })
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
      seenEvents.clear()
    }
  }, [])

  // joueurs de la salle -> crewmates (nom, vote visible au-dessus de la tête)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const defs: CrewDef[] = vm.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      card: {
        voted: !seat.isSpectator && seat.hasVoted,
        revealed: vm.table.revealed,
        value: seat.vote,
      },
    }))
    engine.setLocalId(vm.seats.find((seat) => seat.isMe)?.id ?? null)
    engine.setPlayers(defs)
  }, [vm.seats, vm.table.revealed])

  useEffect(() => {
    engineRef.current?.setPushEnabled(vm.amongUs.pushEnabled)
  }, [vm.amongUs.pushEnabled])

  // positions et coups venus de Convex
  const { players } = vm.amongUs
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !players) return
    const localId = vm.seats.find((seat) => seat.isMe)?.id
    for (const player of players) {
      const previous = seen.current.get(player.userId)
      if (player.userId !== localId) engine.applyRemoteState(player.userId, player)
      // premier instantané = référence : on ne rejoue pas les anciens coups
      if (previous) {
        if (
          player.pushAt !== undefined &&
          player.pushAt !== previous.pushAt &&
          player.userId !== localId
        ) {
          engine.playPush(player.userId, player.pushDx ?? player.dir)
        }
        if (player.hitAt !== undefined && player.hitAt !== previous.hitAt) {
          engine.hit(player.userId, player.hitDx ?? player.dir, player.hitDy ?? 0)
        }
      }
      seen.current.set(player.userId, {
        hitAt: player.hitAt,
        pushAt: player.pushAt,
      })
    }
  }, [players, vm.seats])

  return <div ref={hostRef} className='au-layer' aria-hidden='true' />
}
