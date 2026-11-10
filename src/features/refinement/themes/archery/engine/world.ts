/**
 * Monde logique du thème « Tir à l'arc ».
 *
 * Toute la simulation se fait dans un repère fixe de 2000 x 900 unités, mis à
 * l'échelle pour tenir dans la zone de jeu de chaque écran. Plateformes et
 * trajectoires sont donc identiques pour tous les clients : une flèche tirée
 * d'un écran touche (ou rate) au même endroit sur les autres.
 */

export const WORLD_W = 2000
export const WORLD_H = 900

export const PLATFORM_W = 150
export const PLATFORM_H = 18

export const ARROW_LENGTH = 64
export const ARROW_GRAVITY = 1500
export const ARROW_MIN_SPEED = 750
export const ARROW_MAX_SPEED = 2000

/** Emplacements du côté gauche (centre du dessus de la plateforme), par ordre de remplissage. */
const LEFT_SLOTS: readonly (readonly [number, number])[] = [
  [430, 520],
  [190, 340],
  [215, 720],
  [600, 800],
  [590, 260],
  [60, 545],
]

export type Slot = { x: number; y: number; facing: 1 | -1 }

/** Les joueurs alternent gauche / droite ; le côté droit est le miroir du gauche. */
export function slotAt(index: number): Slot {
  const left = index % 2 === 0
  const rank = Math.floor(index / 2)
  const [x, y] = LEFT_SLOTS[rank % LEFT_SLOTS.length]!
  // au-delà de 12 joueurs on réutilise les emplacements, légèrement décalés
  const lap = Math.floor(rank / LEFT_SLOTS.length)
  const sx = x + lap * 70
  return { x: left ? sx : WORLD_W - sx, y: y - lap * 40, facing: left ? 1 : -1 }
}

export const COLORS = [
  '#e5484d',
  '#f08c00',
  '#12a594',
  '#3e7bfa',
  '#8e4ec6',
  '#e93d82',
  '#46a758',
  '#0091b3',
  '#b0791f',
  '#6e56cf',
  '#c2410c',
  '#d6409f',
] as const

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Emplacement et couleur de chaque joueur, identiques sur tous les clients :
 * tout est dérivé des ids triés.
 */
export function assignSeats(
  ids: readonly string[],
): Map<string, { slot: Slot; color: string }> {
  const result = new Map<string, { slot: Slot; color: string }>()
  const used = new Set<number>()
  ;[...ids].sort().forEach((id, index) => {
    let color = hash(id) % COLORS.length
    for (let step = 0; step < COLORS.length && used.has(color); step++)
      color = (color + 1) % COLORS.length
    used.add(color)
    result.set(id, { slot: slotAt(index), color: COLORS[color]! })
  })
  return result
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t

/** Lissage exponentiel indépendant du framerate. */
export const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

export const pick = <T>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)]!
