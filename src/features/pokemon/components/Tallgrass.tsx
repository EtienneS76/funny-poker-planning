import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'

/**
 * Touffe d'herbe haute (style Pokémon), dessinée en SVG.
 *
 * Props :
 *  - active      : true si au moins un joueur est actif → l'herbe bouge toutes les `intervalMs`
 *  - intervalMs  : délai entre deux frémissements (défaut 4000)
 *  - size        : largeur en px (défaut 120)
 *  - onFound     : callback optionnel au clic
 *
 * Usage :
 *   <TallGrass active={players.some(p => p.isActive)} intervalMs={5000} />
 */

interface Blade {
  x: number // position de la base
  w: number // demi-largeur
  h: number // hauteur
  lean: number // inclinaison du bout
  l: 0 | 1 | 2 // calque : 0 arrière, 1 milieu, 2 avant
}

// Variables CSS custom : TypeScript ne les connaît pas dans CSSProperties
type BladeStyle = CSSProperties & {
  '--dir': 1 | -1
  '--d': string
}

export interface TallGrassProps {
  /** true si au moins un joueur est actif */
  active?: boolean
  /** délai entre deux frémissements (ms) */
  intervalMs?: number
  /** largeur en px */
  size?: number
  /** callback optionnel au clic */
  onFound?: () => void
  /** callback si la touffe n'est pas en train de frémir */
  onMiss?: () => void
}

const BLADES: Blade[] = [
  // calque arrière (sombre)
  { x: 14, w: 5, h: 52, lean: -8, l: 0 },
  { x: 30, w: 5.5, h: 62, lean: 6, l: 0 },
  { x: 46, w: 6, h: 70, lean: -4, l: 0 },
  { x: 62, w: 5.5, h: 64, lean: 9, l: 0 },
  { x: 80, w: 5, h: 54, lean: -6, l: 0 },
  // calque milieu
  { x: 22, w: 6, h: 58, lean: 10, l: 1 },
  { x: 38, w: 6.5, h: 66, lean: -9, l: 1 },
  { x: 54, w: 6.5, h: 72, lean: 5, l: 1 },
  { x: 70, w: 6, h: 60, lean: -10, l: 1 },
  { x: 86, w: 5, h: 48, lean: 8, l: 1 },
  // calque avant (clair)
  { x: 10, w: 5, h: 36, lean: -10, l: 2 },
  { x: 32, w: 6, h: 44, lean: 8, l: 2 },
  { x: 50, w: 6.5, h: 50, lean: -6, l: 2 },
  { x: 68, w: 6, h: 42, lean: 9, l: 2 },
  { x: 90, w: 5, h: 34, lean: -8, l: 2 },
]

const BASE = 96 // y de la base des brins (viewBox 0 0 100 100)

const bladePath = ({ x, w, h, lean }: Blade): string => {
  const tipX = x + lean
  const tipY = BASE - h
  return [
    `M ${x - w} ${BASE}`,
    `C ${x - w} ${BASE - h * 0.5}, ${tipX - w * 0.2} ${BASE - h * 0.82}, ${tipX} ${tipY}`,
    `C ${tipX + w * 0.4} ${BASE - h * 0.7}, ${x + w} ${BASE - h * 0.4}, ${x + w} ${BASE}`,
    'Z',
  ].join(' ')
}

const CSS = `
.tg{all:unset;display:inline-block;cursor:pointer;line-height:0;-webkit-tap-highlight-color:transparent}
.tg:focus-visible{outline:3px solid #fff;outline-offset:3px;border-radius:12px}
.tg-blade{transform-box:fill-box;transform-origin:50% 100%}

@keyframes tg-rustle{
  0%{transform:rotate(0)}
  20%{transform:rotate(calc(var(--dir) * 5deg))}
  45%{transform:rotate(calc(var(--dir) * -4deg))}
  70%{transform:rotate(calc(var(--dir) * 2deg))}
  100%{transform:rotate(0)}
}
@keyframes tg-pop{
  0%{transform:scale(1)}
  40%{transform:scale(.92,1.06)}
  100%{transform:scale(1)}
}

.tg-rustle .tg-blade{animation:tg-rustle 1.4s ease-in-out var(--d) 1 both}
.tg--rustling:active svg{animation:tg-pop .25s ease-out}
@media (prefers-reduced-motion:reduce){
  .tg-rustle .tg-blade,.tg--rustling:active svg{animation:none}
}
`

export default function TallGrass({
  active = false,
  intervalMs = 4000,
  size = 120,
  onFound,
  onMiss,
}: TallGrassProps) {
  const uid = useId().replace(/:/g, '')
  const [rustle, setRustle] = useState<number>(0)
  const [rustling, setRustling] = useState(false)
  const rustlingRef = useRef(false)
  const foundDuringRustle = useRef(false)
  const rustleTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const startRustle = () => {
      if (rustleTimeout.current !== null) {
        window.clearTimeout(rustleTimeout.current)
      }
      rustlingRef.current = true
      foundDuringRustle.current = false
      setRustling(true)
      setRustle((n) => n + 1)
      rustleTimeout.current = window.setTimeout(() => {
        rustlingRef.current = false
        setRustling(false)
        rustleTimeout.current = null
      }, 1400)
    }

    const interval = window.setInterval(startRustle, intervalMs)
    return () => {
      window.clearInterval(interval)
      if (rustleTimeout.current !== null) {
        window.clearTimeout(rustleTimeout.current)
        rustleTimeout.current = null
      }
      rustlingRef.current = false
      setRustling(false)
    }
  }, [active, intervalMs])

  const handleClick = (): void => {
    if (!rustlingRef.current) {
      onMiss?.()
      return
    }
    if (foundDuringRustle.current) return
    foundDuringRustle.current = true
    setRustle((n) => n + 1)
    onFound?.()
  }

  const fills = [`url(#${uid}-back)`, `url(#${uid}-mid)`, `url(#${uid}-front)`]

  return (
    <>
      <style>{CSS}</style>
      <button
        type='button'
        className={`tg${rustling ? ' tg--rustling' : ''}`}
        onClick={handleClick}
        aria-label={
          rustling
            ? 'Herbe haute qui frémit : cliquer maintenant'
            : 'Herbe haute : attendre qu’elle frémisse'
        }
        aria-live='polite'
        style={{ width: size }}
      >
        {/* key change → remonte le groupe → relance l'animation */}
        <svg
          viewBox='0 0 100 100'
          width='100%'
          aria-hidden='true'
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={`${uid}-back`} x1='0' y1='1' x2='0' y2='0'>
              <stop offset='0' stopColor='#1f5a2a' />
              <stop offset='1' stopColor='#3b8a3a' />
            </linearGradient>
            <linearGradient id={`${uid}-mid`} x1='0' y1='1' x2='0' y2='0'>
              <stop offset='0' stopColor='#2f7a2f' />
              <stop offset='1' stopColor='#59b445' />
            </linearGradient>
            <linearGradient id={`${uid}-front`} x1='0' y1='1' x2='0' y2='0'>
              <stop offset='0' stopColor='#4aa23c' />
              <stop offset='1' stopColor='#9ad65a' />
            </linearGradient>
          </defs>

          {/* ombre au sol */}
          <ellipse cx='50' cy='96' rx='46' ry='5' fill='rgba(20,50,20,.35)' />

          <g key={rustle} className={rustle ? 'tg-rustle' : undefined}>
            {BLADES.map((b, i) => {
              const style: BladeStyle = {
                '--dir': i % 2 ? 1 : -1,
                '--d': `${(i % 5) * 45}ms`,
              }
              return (
                <path
                  key={i}
                  d={bladePath(b)}
                  className='tg-blade'
                  fill={fills[b.l]}
                  stroke='rgba(18,60,24,.45)'
                  strokeWidth='.8'
                  strokeLinejoin='round'
                  style={style}
                />
              )
            })}
          </g>
        </svg>
      </button>
    </>
  )
}
