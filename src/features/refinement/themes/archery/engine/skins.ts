/**
 * Flèches cosmétiques (boutique) : purement visuelles, vues par tous les
 * joueurs. Les ids correspondent à convex/user/arrowSkins.ts.
 */
export type ArrowSkin = 'fire' | 'ice' | 'rainbow' | 'dragon'

export const RAINBOW = [
  '#e5484d',
  '#f08c00',
  '#f2c200',
  '#46a758',
  '#3e7bfa',
  '#8e4ec6',
] as const

type Look = {
  shaft: string
  head: string
  halo: string
  /** Couleurs des particules (traînée, tir, impact). */
  sparks: readonly string[]
  /** Gravité des particules : négative = elles montent (flammes). */
  gravity: number
  /** Teinte du bonhomme touché, le temps de sa chute. */
  tint: string | null
}

export const ARROW_LOOKS: Record<ArrowSkin, Look> = {
  fire: {
    shaft: '#8a2c0d',
    head: '#ff6a1a',
    halo: 'rgba(255,138,30,.35)',
    sparks: ['#ff5a1f', '#ff8a1e', '#ffc23d', '#ffe27a'],
    gravity: -520,
    tint: '#5a1e0c',
  },
  ice: {
    shaft: '#3f9fd6',
    head: '#8fdcff',
    halo: 'rgba(120,205,255,.4)',
    sparks: ['#8fdcff', '#c9f0ff', '#ffffff', '#5fb7e6'],
    gravity: 260,
    tint: '#4aa9de',
  },
  rainbow: {
    shaft: '#8e4ec6',
    head: '#e5484d',
    halo: 'rgba(255,255,255,.5)',
    sparks: RAINBOW,
    gravity: 520,
    tint: null,
  },
  // clin d'œil à la Tempête du dragon : deux dragons d'esprit en spirale (voir drawDragons)
  dragon: {
    shaft: '#1d6fd6',
    head: '#9fe8ff',
    halo: 'rgba(70,170,255,.38)',
    sparks: ['#49b6ff', '#8fe3ff', '#d6f6ff', '#2f8be6'],
    gravity: -120,
    tint: '#2f8be6',
  },
}

export const asSkin = (value: string | null | undefined): ArrowSkin | null =>
  value === 'fire' ||
  value === 'ice' ||
  value === 'rainbow' ||
  value === 'dragon'
    ? value
    : null

const DRAGON_COLORS = ['#49b6ff', '#9fe8ff'] as const
const DRAGON_LENGTH = 300
const DRAGON_SEGMENTS = 18

/**
 * Deux dragons d'esprit qui s'enroulent en double hélice autour de la flèche.
 * L'hélice est simulée à plat : un sinus pour l'écart à la trajectoire, son
 * cosinus pour la « profondeur » (un corps plus fin et plus pâle quand il passe
 * derrière). `time` fait tourner la spirale.
 */
export function drawDragons(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  time: number,
) {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const step = DRAGON_LENGTH / DRAGON_SEGMENTS
  for (let dragon = 0; dragon < 2; dragon++) {
    const offset = dragon * Math.PI
    let previousX = 0
    let previousY = 0
    for (let i = 0; i <= DRAGON_SEGMENTS; i++) {
      // de la tête (un peu devant la pointe) à la queue
      const along = 26 - i * step
      const turn = time * 16 - i * 0.62 + offset
      const taper = 1 - i / DRAGON_SEGMENTS
      const spread = Math.sin(turn) * (20 + 10 * (1 - taper))
      const depth = Math.cos(turn)
      const x = tipX + dx * along - dy * spread
      const y = tipY + dy * along + dx * spread
      if (i > 0) {
        ctx.globalAlpha = (0.55 + 0.4 * depth) * (0.35 + 0.65 * taper)
        ctx.strokeStyle = DRAGON_COLORS[dragon]!
        ctx.lineWidth = (4 + 9 * taper) * (0.8 + 0.2 * depth)
        ctx.beginPath()
        ctx.moveTo(previousX, previousY)
        ctx.lineTo(x, y)
        ctx.stroke()
      } else {
        // tête : un museau clair et un œil
        ctx.globalAlpha = 0.95
        ctx.fillStyle = DRAGON_COLORS[dragon]!
        ctx.beginPath()
        ctx.arc(x, y, 10, 0, Math.PI * 2)
        ctx.arc(x + dx * 11, y + dy * 11, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(x + dx * 4, y + dy * 4, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      previousX = x
      previousY = y
    }
  }
  ctx.globalAlpha = 1
}
