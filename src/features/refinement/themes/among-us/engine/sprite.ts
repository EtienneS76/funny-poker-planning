/** Couleurs officielles d'Among Us : [principale, ombre]. */
export const PALETTE = {
  red: ['#C51111', '#7A0838'],
  blue: ['#132ED1', '#09158E'],
  green: ['#117F2D', '#0A4D2E'],
  pink: ['#ED54BA', '#AB2BAD'],
  orange: ['#EF7D0D', '#B33E15'],
  yellow: ['#F5F557', '#C38823'],
  black: ['#3F474E', '#1E1F26'],
  white: ['#D6E0F0', '#8394BF'],
  purple: ['#6B2FBB', '#3B177C'],
  brown: ['#71491E', '#5E2615'],
  cyan: ['#38FEDC', '#24A8BE'],
  lime: ['#50EF39', '#15A742'],
} as const

export type ColorKey = keyof typeof PALETTE
const COLOR_KEYS = Object.keys(PALETTE) as ColorKey[]

export function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Couleur pseudo-aléatoire mais déterministe : tous les clients calculent la
 * même à partir des mêmes ids. Les ids sont traités dans l'ordre pour éviter
 * les doublons tant qu'il reste des couleurs libres.
 */
export function assignColors(ids: readonly string[]): Map<string, ColorKey> {
  const result = new Map<string, ColorKey>()
  const used = new Set<ColorKey>()
  for (const id of [...ids].sort()) {
    const start = hash(id) % COLOR_KEYS.length
    let key = COLOR_KEYS[start]!
    for (let step = 0; step < COLOR_KEYS.length; step++) {
      const candidate = COLOR_KEYS[(start + step) % COLOR_KEYS.length]!
      if (!used.has(candidate)) {
        key = candidate
        break
      }
    }
    used.add(key)
    result.set(id, key)
  }
  return result
}

/** Crewmate tourné vers la droite. Les jambes sont deux groupes animés en CSS. */
export const SPRITE = `
<svg class="au-svg" viewBox="0 0 60 72" aria-hidden="true">
  <g class="au-leg au-leg-l"><rect class="au-c2" x="13" y="50" width="16" height="21" rx="6"/></g>
  <g class="au-leg au-leg-r"><rect class="au-c2" x="31" y="50" width="16" height="21" rx="6"/></g>
  <rect class="au-c2" x="2" y="24" width="14" height="26" rx="6"/>
  <path class="au-c" d="M9 26C9 13 18 5 30 5s21 8 21 21v26q0 6-6 6H15q-6 0-6-6z"/>
  <path d="M14 25c0-6 4-11 10-13" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" fill="none"/>
  <rect class="au-visor" x="27" y="15" width="29" height="19" rx="9.5"/>
  <rect x="33" y="18" width="14" height="4" rx="2" fill="#fff" fill-opacity=".75"/>
  <rect class="au-c au-arm" x="40" y="37" width="24" height="9" rx="4.5"/>
</svg>`
