import type { CSSProperties, ReactNode } from 'react'
import '../../styles/avatar-frame.css'

type Props = {
  frameId: string | null | undefined
  className?: string
  children: ReactNode
}

type Fx = {
  kind: 'glow' | 'orb' | 'prism' | 'spark' | 'ember' | 'wave'
  vars?: Record<string, string>
}

const glow = (g: string, inset: string, t = '2.4s', g2?: string): Fx => ({
  kind: 'glow',
  vars: { '--g': g, '--gi': inset, '--t': t, ...(g2 ? { '--g2': g2 } : {}) },
})
const orb = (r: string, d: string, c: string, delay?: string): Fx => ({
  kind: 'orb',
  vars: {
    '--r': r,
    '--d': d,
    '--c': c,
    ...(delay ? { animationDelay: delay } : {}),
  },
})
const prism = (r: string, d: string, reverse = false): Fx => ({
  kind: 'prism',
  vars: { '--r': r, '--d': d, ...(reverse ? { '--dir': 'reverse' } : {}) },
})
const spark = (
  x: string,
  y: string,
  extra: Record<string, string> = {},
): Fx => ({
  kind: 'spark',
  vars: { '--x': x, '--y': y, ...extra },
})
const ember = (x: string, dl?: string): Fx => ({
  kind: 'ember',
  vars: { '--x': x, ...(dl ? { '--dl': dl } : {}) },
})
const wave = (dl?: string): Fx => ({
  kind: 'wave',
  vars: dl ? { '--dl': dl } : {},
})

const cosmic = { '--c': '#edddff', '--g': '#c7a4ff' }

// Les anneaux sont en CSS pur (avatar-frames.css) ; seuls les effets
// qui ont besoin d'un élément à part (halo, orbites, étincelles…) sont listés ici.
const frameEffects: Record<string, Fx[]> = {
  aurora: [glow('#69e0c8aa', '-11cqi')],
  frost: [glow('#91d5efcc', '-12cqi')],
  neon: [glow('#ff4fd8', '-8cqi', '2.4s', '#4fe6ff')],
  lightning: [glow('#5fb4ff', '-9.7cqi', '1.2s')],
  gold: [
    glow('#e9b84d', '-10cqi'),
    spark('92%', '-8%'),
    spark('-10%', '78%', { '--dl': '0.6s' }),
    spark('80%', '96%', { '--dl': '1s', '--ss': '12cqi' }),
  ],
  'emerald-dragon': [
    glow('#3fd08f', '-11cqi', '3s'),
    orb('-6cqi', '5s', '#f2d984'),
    orb('-6cqi', '5s', '#f2d984', '-2.5s'),
  ],
  phoenix: [
    glow('#ff7a2b', '-11cqi', '1.2s'),
    ember('2%'),
    ember('88%', '0.7s'),
    ember('20%', '1.2s'),
    ember('72%', '0.3s'),
  ],
  galaxy: [
    glow('#9a76e2', '-11cqi'),
    orb('-6cqi', '6s', '#fff'),
    spark('94%', '-6%', cosmic),
    spark('-8%', '84%', { ...cosmic, '--dl': '0.8s' }),
  ],
  multiverse: [
    glow('#b57bff', '-10cqi', '2.2s', '#59f0d8'),
    wave(),
    wave('1.5s'),
    prism('-15cqi', '6s'),
    prism('-22cqi', '9s', true),
    orb('-29cqi', '13s', '#ffe78a'),
    spark('104%', '6%'),
    spark('-14%', '20%', { '--dl': '0.4s', '--c': '#a7f3e6' }),
    spark('92%', '96%', { '--dl': '0.9s', '--c': '#ffc2e6' }),
    spark('-6%', '94%', { '--dl': '0.2s' }),
  ],
}

export function AvatarFrame({ frameId, className = '', children }: Props) {
  const effects = frameId ? frameEffects[frameId] : undefined

  return (
    <span
      className={`avatar-frame${frameId ? ` avatar-frame--${frameId}` : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
      {effects?.map((fx, index) => {
        const { animationDelay, ...vars } = fx.vars ?? {}
        return (
          <i
            key={`${frameId}-${index}`}
            className={`avatar-frame-fx avatar-frame-fx--${fx.kind}`}
            style={{ ...vars, animationDelay } as CSSProperties}
            aria-hidden='true'
          />
        )
      })}
    </span>
  )
}
