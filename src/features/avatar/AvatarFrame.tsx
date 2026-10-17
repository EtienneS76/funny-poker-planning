import type { ReactNode } from 'react'

type Props = {
  frameId: string | null | undefined
  className?: string
  children: ReactNode
}

const frameOrnaments: Record<string, { kind: string; count: number }> = {
  flower: { kind: 'flower', count: 8 },
  clover: { kind: 'leaf', count: 8 },
  stardust: { kind: 'star', count: 8 },
  waterlily: { kind: 'water', count: 8 },
  aurora: { kind: 'aurora', count: 6 },
  frost: { kind: 'crystal', count: 6 },
  neon: { kind: 'neon', count: 8 },
  lightning: { kind: 'lightning', count: 8 },
  gold: { kind: 'sparkle', count: 8 },
  phoenix: { kind: 'ember', count: 8 },
  galaxy: { kind: 'galaxy', count: 8 },
  'emerald-dragon': { kind: 'scale', count: 8 },
  multiverse: { kind: 'prism', count: 8 },
}

const ornamentPositions = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
]

export function AvatarFrame({ frameId, className = '', children }: Props) {
  const ornaments = frameId ? frameOrnaments[frameId] : undefined

  return (
    <span
      className={`avatar-frame${frameId ? ` avatar-frame--${frameId}` : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
      {ornaments?.count &&
        Array.from({ length: ornaments.count }, (_, index) => (
          <span
            key={`${frameId}-${index}`}
            className={`avatar-frame-ornament avatar-frame-ornament--${ornaments.kind} avatar-frame-ornament--${ornamentPositions[index]}`}
            aria-hidden='true'
          />
        ))}
    </span>
  )
}