import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type ReactionSeat = {
  id: string
  name: string
  isMe: boolean
  position: CSSProperties
}
type Props = {
  seats: ReactionSeat[]
  targetId: string | null
  onClose: () => void
  onDodge: (seatId: string, active: boolean) => void
}

const reactions = [
  { id: 'tomato', symbol: '🍅', label: 'Tomate', description: 'une tomate' },
  { id: 'poop', symbol: '💩', label: 'Caca', description: 'un caca' },
  { id: 'egg', symbol: '🥚', label: 'Œuf', description: 'un œuf' },
  { id: 'soap', symbol: '🧽', label: 'Éponge', description: 'une éponge' },
] as const

type Reaction = (typeof reactions)[number]
type StainKind = 'tomato' | 'poop'
type Throw = {
  id: number
  expiresAt: number
  target: ReactionSeat
  source: ReactionSeat
  reaction: Reaction
  hatched: boolean
  dodged: boolean
  escapeOrigin: {
    x: number
    y: number
    travelX: number
    travelY: number
    angle: number
  } | null
}

export function RefinementRoomReactions({
  seats,
  targetId,
  onClose,
  onDodge,
}: Props) {
  const [activeThrows, setActiveThrows] = useState<Throw[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [hits, setHits] = useState<
    Record<string, Partial<Record<StainKind, number>>>
  >({})
  const impactTimers = useRef(new Set<number>())
  const lastThrow = useRef(-Infinity)
  const nextThrowId = useRef(0)
  const menu = useRef<HTMLDivElement>(null)
  const target = seats.find((seat) => seat.id === targetId)
  const source = seats.find((seat) => seat.isMe)

  useEffect(() => {
    const timers = impactTimers.current
    return () => {
      timers.forEach((timeout) => window.clearTimeout(timeout))
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (!targetId) return
    menu.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus()
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        onClose()
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [targetId, onClose])

  useEffect(() => {
    if (!activeThrows.length) return
    const timeout = window.setTimeout(
      () => {
        setActiveThrows((previous) =>
          previous.filter((item) => item.expiresAt > Date.now()),
        )
      },
      Math.max(
        0,
        Math.min(...activeThrows.map((item) => item.expiresAt)) - Date.now(),
      ),
    )
    return () => window.clearTimeout(timeout)
  }, [activeThrows])

  function sendReaction(reaction: Reaction) {
    const now = performance.now()
    if (!source || !target || now - lastThrow.current < 100) return
    lastThrow.current = now
    const hatched = reaction.id === 'egg' && Math.random() < 0.1
    const dodged = !hatched && reaction.id !== 'soap' && Math.random() < 0.15
    const table = hatched
      ? menu.current?.closest('.pp-table-area')?.getBoundingClientRect()
      : null
    const escapeAngle = table ? Math.random() * Math.PI * 2 : 0
    const escapeDistance = table
      ? Math.hypot(window.innerWidth, window.innerHeight) + 96
      : 0
    const item: Throw = {
      id: nextThrowId.current++,
      expiresAt: Date.now() + (hatched ? 4800 : 1900),
      target,
      source,
      reaction,
      hatched,
      dodged,
      escapeOrigin: table
        ? {
            x:
              table.left +
              (table.width * Number.parseFloat(String(target.position.left))) /
                100,
            y:
              table.top +
              (table.height * Number.parseFloat(String(target.position.top))) /
                100,
            travelX: Math.cos(escapeAngle) * escapeDistance,
            travelY: Math.sin(escapeAngle) * escapeDistance,
            angle: escapeAngle,
          }
        : null,
    }
    setActiveThrows((previous) => [
      ...previous.filter((active) => active.expiresAt > Date.now()).slice(-39),
      item,
    ])
    if (dodged) {
      onDodge(target.id, true)
      const end = window.setTimeout(() => {
        impactTimers.current.delete(end)
        onDodge(target.id, false)
      }, 1000)
      impactTimers.current.add(end)
    }
    const stainKind = reaction.id
    if (
      !dodged &&
      (stainKind === 'tomato' || stainKind === 'poop' || stainKind === 'soap')
    ) {
      const timeout = window.setTimeout(() => {
        impactTimers.current.delete(timeout)
        setHits((previous) => {
          if (stainKind === 'soap') {
            const cleaned = { ...previous }
            delete cleaned[target.id]
            return cleaned
          }
          return {
            ...previous,
            [target.id]: {
              ...previous[target.id],
              [stainKind]: Math.min(
                10,
                (previous[target.id]?.[stainKind] ?? 0) + 1,
              ),
            },
          }
        })
      }, 700)
      impactTimers.current.add(timeout)
    }
    setAnnouncement(
      `${source.name} envoie ${reaction.description} à ${target.name}.${dodged ? ` ${target.name} esquive !` : hatched ? ' Surprise : un poussin éclot et s’enfuit !' : ''}`,
    )
  }

  return (
    <>
      {target && (
        <div
          id='room-reaction-menu'
          ref={menu}
          className='room-reaction-menu'
          role='group'
          aria-label={`Réaction pour ${target.name}`}
          data-below={Number.parseFloat(String(target.position.top)) < 35}
          style={
            {
              '--target-x': target.position.left,
              '--target-y': target.position.top,
            } as CSSProperties
          }
        >
          <span className='room-reaction-target'>{target.name}</span>
          <div className='room-reaction-options'>
            {reactions.map((reaction) => (
              <button
                key={reaction.id}
                type='button'
                title={`Envoyer ${reaction.description}`}
                aria-label={`Envoyer : ${reaction.label}`}
                onClick={() => sendReaction(reaction)}
              >
                <span aria-hidden='true'>{reaction.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className='room-reaction-stains'>
        {seats.flatMap((seat) =>
          (['tomato', 'poop'] as const).map(
            (kind) =>
              (hits[seat.id]?.[kind] ?? 0) >= 10 && (
                <span
                  key={`${seat.id}-${kind}`}
                  className={`room-reaction-stain room-reaction-stain--${kind}`}
                  role='img'
                  aria-label={`Trace de ${kind === 'tomato' ? 'tomate' : 'caca'} sur ${seat.name}`}
                  style={{ left: seat.position.left, top: seat.position.top }}
                />
              ),
          ),
        )}
      </div>
      {activeThrows.map((activeThrow) => (
        <div
          key={activeThrow.id}
          className={`room-reaction-effect room-reaction-effect--${activeThrow.reaction.id}${activeThrow.hatched ? ' room-reaction-effect--hatched' : ''}${activeThrow.dodged ? ' room-reaction-effect--dodged' : ''}`}
          aria-hidden='true'
          style={
            {
              '--source-x': activeThrow.source.position.left,
              '--source-y': activeThrow.source.position.top,
              '--target-x': activeThrow.target.position.left,
              '--target-y': activeThrow.target.position.top,
            } as CSSProperties
          }
        >
          <span className='room-reaction-projectile'>
            {activeThrow.reaction.symbol}
          </span>
          <span className='room-reaction-impact'>
            <span className='room-reaction-arrival'>
              {activeThrow.hatched ? '🐣' : activeThrow.reaction.symbol}
            </span>
            {Array.from({ length: 12 }, (_, index) => (
              <i
                key={index}
                style={
                  { '--particle-angle': `${index * 30}deg` } as CSSProperties
                }
              />
            ))}
          </span>
        </div>
      ))}
      {activeThrows.some((item) => item.hatched && item.escapeOrigin) &&
        createPortal(
          <div className='room-chick-overlay' aria-hidden='true'>
            {activeThrows
              .filter((item) => item.hatched && item.escapeOrigin)
              .map((item) => (
                <div
                  key={item.id}
                  className='room-chick-escape'
                  style={
                    {
                      left: item.escapeOrigin!.x,
                      top: item.escapeOrigin!.y,
                      '--escape-x': `${item.escapeOrigin!.travelX}px`,
                      '--escape-y': `${item.escapeOrigin!.travelY}px`,
                      '--escape-angle': `${(item.escapeOrigin!.angle * 180) / Math.PI}deg`,
                      '--chick-facing': item.escapeOrigin!.travelX < 0 ? -1 : 1,
                    } as CSSProperties
                  }
                >
                  <span className='room-chick-runner'>
                    <span className='room-chick'>🐥</span>
                  </span>
                  <span className='room-chick-trail'>
                    {Array.from({ length: 12 }, (_, index) => (
                      <i
                        key={index}
                        style={
                          {
                            left:
                              ((index + 1) / 14) * item.escapeOrigin!.travelX -
                              Math.sin(item.escapeOrigin!.angle) *
                                (index % 2 ? -5 : 5),
                            top:
                              ((index + 1) / 14) * item.escapeOrigin!.travelY +
                              Math.cos(item.escapeOrigin!.angle) *
                                (index % 2 ? -5 : 5) +
                              8,
                            '--footstep-delay': `${1430 + ((index + 1) * 1870) / 14}ms`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </span>
                </div>
              ))}
          </div>,
          document.body,
        )}
      <span className='room-reaction-announcement' role='status'>
        {announcement}
      </span>
    </>
  )
}

export function ConsensusCelebration({ revealDelay }: { revealDelay: number }) {
  const [phase, setPhase] = useState<'pending' | 'active' | 'finished'>('pending')
  useEffect(() => {
    const start = window.setTimeout(() => setPhase('active'), revealDelay)
    const finish = window.setTimeout(() => setPhase('finished'), revealDelay + 5200)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(finish)
    }
  }, [revealDelay])

  if (phase !== 'active') return null
  return createPortal(
    <div className='room-consensus-confetti' aria-hidden='true'>
      {(['left', 'right'] as const).map(side => (
        <div key={side} className={`room-consensus-cannon room-consensus-cannon--${side}`} style={{ '--cannon-direction': side === 'left' ? 1 : -1 } as CSSProperties}>
          <span className='room-consensus-party'>🎉</span>
          <span className='room-consensus-burst'>
            {Array.from({ length: 64 }, (_, index) => (
              <i key={index} style={{
                '--confetti-color': ['#e34b57', '#31846b', '#e8ba3f', '#428fb4'][index % 4],
                '--confetti-delay': `${500 + Math.floor(index / 16) * 300 + index % 4 * 30}ms`,
                '--confetti-duration': `${2600 + index % 7 * 160}ms`,
                '--burst-x': `${(side === 'left' ? 1 : -1) * (14 + index % 8 * 7)}vw`,
                '--burst-y': `${-(34 + index % 7 * 7)}dvh`,
                '--burst-land-y': `${20 + index % 5 * 5}dvh`,
              } as CSSProperties} />
            ))}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  )
}
