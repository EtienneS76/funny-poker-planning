import { ARROW_LOOKS, RAINBOW, type ArrowSkin } from './skins'
import { ARROW_LENGTH, clamp, ease, lerp } from './world'

/**
 * Bonhomme bâton : pose procédurale (jambes et bras résolus par cinématique
 * inverse), boîtes de collision tirées des mêmes articulations, et ragdoll
 * Verlet quand il se prend une flèche.
 *
 * Pose et ragdoll partagent la même disposition de points (x, y à la suite),
 * donc un seul code de dessin.
 */

export const HEAD = 0
export const NECK = 1
export const HIP = 2
const KNEE_L = 3
const KNEE_R = 4
const FOOT_L = 5
const FOOT_R = 6
const ELBOW_B = 7 // bras qui tient l'arc
const ELBOW_S = 8 // bras qui tire la corde
export const HAND_B = 9
const HAND_S = 10
const POINTS = 11

const HEAD_R = 16
const TORSO = 50
const NECK_LEN = 17
const THIGH = 34
const SHIN = 34
const ARM = 24
const BAND = 13

const JUMP_SPEED = 780
const JUMP_GRAVITY = 2600
const INK = '#0d111b'

/** Pas fixe des simulations Verlet (ragdoll, plumet du casque) : même rendu à 60 ou 144 Hz. */
export const FIXED_STEP = 1 / 60

const LINKS: readonly (readonly [number, number, number])[] = [
  [HEAD, NECK, NECK_LEN],
  [NECK, HIP, TORSO],
  [HIP, KNEE_L, THIGH],
  [KNEE_L, FOOT_L, SHIN],
  [HIP, KNEE_R, THIGH],
  [KNEE_R, FOOT_R, SHIN],
  [NECK, ELBOW_B, ARM],
  [ELBOW_B, HAND_B, ARM],
  [NECK, ELBOW_S, ARM],
  [ELBOW_S, HAND_S, ARM],
]

/** Flèche plantée dans un bonhomme, exprimée dans le repère de son torse. */
export type Attach = {
  u: number
  v: number
  angle: number
  color: string
  skin: ArrowSkin | null
}

type Ragdoll = { pts: Float32Array; prev: Float32Array }

export type Stick = {
  id: string
  isLocal: boolean
  color: string
  /** Pieds (au repos) : position courante et plateforme visée. */
  x: number
  y: number
  tx: number
  ty: number
  baseFacing: 1 | -1
  facing: 1 | -1
  crouching: boolean
  crouch: number
  /** Hauteur et vitesse verticale du saut (unités du monde, positif = en l'air). */
  jy: number
  jv: number
  land: number
  aiming: boolean
  aim: number
  ready: number
  readyHold: number
  draw: number
  bowAngle: number
  flinch: number
  phase: number
  pts: Float32Array
  rag: Ragdoll | null
  /** Au tapis : secondes restantes avant de réapparaître. */
  down: number
  /** Invulnérable (réapparition) : secondes restantes. */
  shield: number
  band: Float32Array
  stuck: Attach[]
  /** Flèche cosmétique équipée : visible sur la flèche encochée. */
  skin: ArrowSkin | null
  /** Parade en cours : secondes restantes pendant lesquelles une flèche est déviée. */
  parry: number
  /** Couleur du corps le temps d'un effet (gelé, carbonisé) ; null = encre normale. */
  tint: string | null
}

export function createStick(
  id: string,
  x: number,
  y: number,
  facing: 1 | -1,
  color: string,
): Stick {
  const stick: Stick = {
    id,
    isLocal: false,
    color,
    x,
    y,
    tx: x,
    ty: y,
    baseFacing: facing,
    facing,
    crouching: false,
    crouch: 0,
    jy: 0,
    jv: 0,
    land: 0,
    aiming: false,
    aim: facing > 0 ? 0 : Math.PI,
    ready: 0,
    readyHold: 0,
    draw: 0,
    bowAngle: 0,
    flinch: 0,
    phase: Math.random() * 6.28,
    pts: new Float32Array(POINTS * 2),
    rag: null,
    down: 0,
    shield: 0,
    band: new Float32Array(8),
    stuck: [],
    skin: null,
    parry: 0,
    tint: null,
  }
  solvePose(stick, 0)
  resetBand(stick)
  return stick
}

export const grounded = (stick: Stick) => stick.jy <= 0 && stick.jv <= 0

export function jump(stick: Stick) {
  if (!grounded(stick) || stick.down > 0) return false
  stick.jv = JUMP_SPEED
  stick.jy = 0.01
  return true
}

/** Le bonhomme retombe du ciel sur sa plateforme. */
export function respawn(stick: Stick) {
  stick.rag = null
  stick.down = 0
  stick.shield = 0.9
  stick.jy = 340
  stick.jv = -1
  stick.crouch = 0
  stick.flinch = 0
  stick.tint = null
  stick.facing = stick.baseFacing
  resetBand(stick)
}

/** Avance la pose d'un pas de rendu. Renvoie true à l'atterrissage. */
export function updateStick(stick: Stick, dt: number, time: number) {
  stick.x += (stick.tx - stick.x) * ease(9, dt)
  stick.y += (stick.ty - stick.y) * ease(9, dt)
  const crouchTarget = stick.crouching && stick.down <= 0 ? 1 : 0
  stick.crouch += (crouchTarget - stick.crouch) * ease(24, dt)

  let landed = false
  if (!grounded(stick)) {
    stick.jv -= JUMP_GRAVITY * dt
    stick.jy += stick.jv * dt
    if (stick.jy <= 0) {
      stick.land = clamp(-stick.jv / 900, 0.35, 1)
      stick.jy = 0
      stick.jv = 0
      landed = true
    }
  }
  stick.land *= Math.exp(-9 * dt)
  stick.flinch *= Math.exp(-7 * dt)
  if (stick.shield > 0) stick.shield -= dt
  if (stick.parry > 0) stick.parry -= dt

  if (stick.readyHold > 0) stick.readyHold -= dt
  const readyTarget = stick.aiming || stick.readyHold > 0 ? 1 : 0
  stick.ready += (readyTarget - stick.ready) * ease(readyTarget ? 26 : 7, dt)
  // corde relâchée : elle claque en avant
  if (!stick.aiming) stick.draw += (0 - stick.draw) * ease(45, dt)

  solvePose(stick, time)
  return landed
}

/** Articulation intermédiaire d'un membre à deux os (genou, coude). */
function bend(
  p: Float32Array,
  root: number,
  end: number,
  mid: number,
  length: number,
  preferX: number,
  preferY: number,
) {
  const ax = p[root * 2]!
  const ay = p[root * 2 + 1]!
  const dx = p[end * 2]! - ax
  const dy = p[end * 2 + 1]! - ay
  const distance = Math.hypot(dx, dy) || 0.001
  const reach = clamp(distance, 1, length * 2 - 0.5)
  const along = reach / 2
  const side = Math.sqrt(Math.max(0, length * length - along * along))
  const ux = dx / distance
  const uy = dy / distance
  let nx = -uy
  let ny = ux
  if (nx * preferX + ny * preferY < 0) {
    nx = -nx
    ny = -ny
  }
  p[mid * 2] = ax + ux * along + nx * side
  p[mid * 2 + 1] = ay + uy * along + ny * side
}

function solvePose(stick: Stick, time: number) {
  const p = stick.pts
  const f = stick.facing
  const c = stick.crouch
  const tuck = clamp(stick.jy / 80, 0, 1)
  const breath = Math.sin(time * 2.2 + stick.phase) * (1 - c)
  const hipHeight = lerp(64, 27, c) - stick.land * 13 * (1 - c) + breath * 1.3
  const baseY = stick.y - stick.jy
  const stance = lerp(13, 21, c)
  const footY = baseY - tuck * 24

  const hipX = stick.x + f * 3 * c - f * stick.flinch * 8
  const hipY = baseY - hipHeight
  p[HIP * 2] = hipX
  p[HIP * 2 + 1] = hipY
  p[FOOT_L * 2] = stick.x - stance
  p[FOOT_L * 2 + 1] = footY
  p[FOOT_R * 2] = stick.x + stance
  p[FOOT_R * 2 + 1] = footY
  bend(p, HIP, FOOT_L, KNEE_L, THIGH, f, -0.15)
  bend(p, HIP, FOOT_R, KNEE_R, THIGH, f, -0.15)

  const lean = f * (0.08 + 0.5 * c + 0.1 * tuck - 0.55 * stick.flinch)
  const sin = Math.sin(lean)
  const cos = Math.cos(lean)
  const neckX = hipX + sin * TORSO
  const neckY = hipY - cos * TORSO
  p[NECK * 2] = neckX
  p[NECK * 2 + 1] = neckY
  p[HEAD * 2] = neckX + sin * NECK_LEN
  p[HEAD * 2 + 1] = neckY - cos * NECK_LEN

  // bras : au repos ils pendent, en visée l'arc pointe et la corde recule
  const r = stick.ready
  const aimX = Math.cos(stick.aim)
  const aimY = Math.sin(stick.aim)
  p[HAND_B * 2] = lerp(neckX + f * 18, neckX + aimX * 46, r)
  p[HAND_B * 2 + 1] = lerp(neckY + 38, neckY + aimY * 46, r)
  const pull = 34 - 30 * stick.draw
  p[HAND_S * 2] = lerp(neckX - f * 8, neckX + aimX * pull, r)
  p[HAND_S * 2 + 1] = lerp(neckY + 40, neckY + aimY * pull, r)
  bend(p, NECK, HAND_B, ELBOW_B, ARM, 0, 1)
  bend(p, NECK, HAND_S, ELBOW_S, ARM, -aimX, -aimY - 0.4)

  const idle = f > 0 ? 1.15 : Math.PI - 1.15
  let delta = (stick.aim - idle) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  stick.bowAngle = idle + delta * r
}

/* ------------------------------------------------------------ Collisions */

function segmentDistance2(
  x: number,
  y: number,
  p: Float32Array,
  a: number,
  b: number,
) {
  const ax = p[a * 2]!
  const ay = p[a * 2 + 1]!
  const dx = p[b * 2]! - ax
  const dy = p[b * 2 + 1]! - ay
  const t = clamp(
    ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1),
    0,
    1,
  )
  const cx = ax + dx * t - x
  const cy = ay + dy * t - y
  return cx * cx + cy * cy
}

/** 0 = raté, 1 = touché au corps, 2 = en pleine tête. */
export function hitTest(stick: Stick, x: number, y: number): 0 | 1 | 2 {
  const p = stick.pts
  if (Math.abs(x - p[HIP * 2]!) > 80 || Math.abs(y - p[HIP * 2 + 1]!) > 110)
    return 0
  const hx = x - p[HEAD * 2]!
  const hy = y - p[HEAD * 2 + 1]!
  if (hx * hx + hy * hy <= (HEAD_R + 3) ** 2) return 2
  if (segmentDistance2(x, y, p, HIP, NECK) <= 12 * 12) return 1
  if (
    segmentDistance2(x, y, p, HIP, KNEE_L) <= 81 ||
    segmentDistance2(x, y, p, KNEE_L, FOOT_L) <= 81 ||
    segmentDistance2(x, y, p, HIP, KNEE_R) <= 81 ||
    segmentDistance2(x, y, p, KNEE_R, FOOT_R) <= 81
  )
    return 1
  return 0
}

/* ------------------------------------------------------------ Ragdoll */

/** Transforme la pose courante en ragdoll, projeté par l'impact. */
export function startRagdoll(
  stick: Stick,
  impulseX: number,
  impulseY: number,
  hitX: number,
  hitY: number,
) {
  const pts = new Float32Array(stick.pts)
  const prev = new Float32Array(POINTS * 2)
  for (let i = 0; i < POINTS; i++) {
    const x = pts[i * 2]!
    const y = pts[i * 2 + 1]!
    // les points proches de l'impact partent plus fort : le corps vrille
    const near = 1 + 1.4 * Math.exp(-Math.hypot(x - hitX, y - hitY) / 40)
    const vx = impulseX * near + (Math.random() - 0.5) * 90
    const vy = impulseY * near - 400 + (Math.random() - 0.5) * 90
    prev[i * 2] = x - vx * FIXED_STEP
    prev[i * 2 + 1] = y - vy * FIXED_STEP
  }
  stick.rag = { pts, prev }
  stick.aiming = false
  stick.jy = 0
  stick.jv = 0
}

/**
 * Un pas fixe de ragdoll. `platforms` : rectangles à plat (gauche, haut,
 * droite, bas) sur lesquels le corps s'affale ou rebondit.
 */
export function stepRagdoll(stick: Stick, platforms: Float32Array) {
  const rag = stick.rag
  if (!rag) return
  const { pts, prev } = rag
  for (let i = 0; i < POINTS * 2; i += 2) {
    const x = pts[i]!
    const y = pts[i + 1]!
    const vx = (x - prev[i]!) * 0.992
    const vy = (y - prev[i + 1]!) * 0.992
    prev[i] = x
    prev[i + 1] = y
    pts[i] = x + vx
    pts[i + 1] = y + vy + 2200 * FIXED_STEP * FIXED_STEP
  }
  for (let iteration = 0; iteration < 3; iteration++) {
    for (const [a, b, length] of LINKS) {
      const dx = pts[b * 2]! - pts[a * 2]!
      const dy = pts[b * 2 + 1]! - pts[a * 2 + 1]!
      const distance = Math.hypot(dx, dy) || 0.001
      const push = ((distance - length) / distance) * 0.5
      pts[a * 2]! += dx * push
      pts[a * 2 + 1]! += dy * push
      pts[b * 2]! -= dx * push
      pts[b * 2 + 1]! -= dy * push
    }
    // seuls la tête et le torse butent sur les plateformes : bras et jambes
    // passent au travers, sinon le corps reste accroché par un pied
    for (let i = 0; i <= HIP * 2; i += 2) {
      const x = pts[i]!
      const y = pts[i + 1]!
      for (let r = 0; r < platforms.length; r += 4) {
        const left = platforms[r]! - 4
        const top = platforms[r + 1]! - 4
        const right = platforms[r + 2]! + 4
        const bottom = platforms[r + 3]! + 4
        if (x <= left || x >= right || y <= top || y >= bottom) continue
        const toTop = y - top
        const toBottom = bottom - y
        const toLeft = x - left
        const toRight = right - x
        const nearest = Math.min(toTop, toBottom, toLeft, toRight)
        if (nearest === toTop) {
          pts[i + 1] = top
          // frottement léger : le corps glisse jusqu'au bord et bascule
          prev[i] = pts[i]! - (pts[i]! - prev[i]!) * 0.9
        } else if (nearest === toBottom) pts[i + 1] = bottom
        else if (nearest === toLeft) pts[i] = left
        else pts[i] = right
        break
      }
    }
  }
}

/* ------------------------------------------------------------ Plumet du casque */

function resetBand(stick: Stick) {
  const b = stick.band
  const x = stick.pts[HEAD * 2]!
  const y = stick.pts[HEAD * 2 + 1]! - HEAD_R - 3
  for (let i = 0; i < 8; i += 2) {
    b[i] = x - stick.facing * BAND * (((i / 2) % 2) + 1)
    b[i + 1] = y
  }
}

/**
 * Le plumet (aux couleurs du joueur) est accroché au sommet du casque et suit
 * la tête avec un temps de retard (pas fixe).
 */
export function stepBand(stick: Stick) {
  const p = stick.rag ? stick.rag.pts : stick.pts
  const b = stick.band
  // sommet du casque : dans l'axe cou -> tête, pour suivre une tête penchée
  const upX = p[HEAD * 2]! - p[NECK * 2]!
  const upY = p[HEAD * 2 + 1]! - p[NECK * 2 + 1]!
  const upLength = Math.hypot(upX, upY) || 1
  let parentX = p[HEAD * 2]! + (upX / upLength) * (HEAD_R + 3)
  let parentY = p[HEAD * 2 + 1]! + (upY / upLength) * (HEAD_R + 3)
  if (Math.abs(b[0]! - parentX) + Math.abs(b[1]! - parentY) > 220) resetBand(stick)
  for (let i = 0; i < 4; i += 2) {
    const x = b[i]!
    const y = b[i + 1]!
    let nx = x + (x - b[i + 4]!) * 0.9 - stick.facing * 0.25
    let ny = y + (y - b[i + 5]!) * 0.9 + 0.22
    b[i + 4] = x
    b[i + 5] = y
    const dx = nx - parentX
    const dy = ny - parentY
    const distance = Math.hypot(dx, dy) || 0.001
    if (distance > BAND) {
      nx = parentX + (dx / distance) * BAND
      ny = parentY + (dy / distance) * BAND
    }
    b[i] = nx
    b[i + 1] = ny
    parentX = nx
    parentY = ny
  }
}

/* ------------------------------------------------------------ Flèches plantées */

export function attachArrow(
  stick: Stick,
  x: number,
  y: number,
  angle: number,
  color: string,
  skin: ArrowSkin | null = null,
): Attach {
  const p = stick.rag ? stick.rag.pts : stick.pts
  const hipX = p[HIP * 2]!
  const hipY = p[HIP * 2 + 1]!
  const ex = p[NECK * 2]! - hipX
  const ey = p[NECK * 2 + 1]! - hipY
  const length = Math.hypot(ex, ey) || 1
  const ux = ex / length
  const uy = ey / length
  const attach: Attach = {
    u: clamp((x - hipX) * ux + (y - hipY) * uy, -20, TORSO + NECK_LEN + 8),
    v: clamp(-(x - hipX) * uy + (y - hipY) * ux, -12, 12),
    angle: angle - Math.atan2(uy, ux),
    color,
    skin,
  }
  stick.stuck.push(attach)
  if (stick.stuck.length > 5) stick.stuck.shift()
  return attach
}

/* ------------------------------------------------------------ Dessin */

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  color: string,
  headless = false,
  skin: ArrowSkin | null = null,
) {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const tailX = tipX - dx * ARROW_LENGTH
  const tailY = tipY - dy * ARROW_LENGTH
  const look = skin ? ARROW_LOOKS[skin] : null
  if (look) {
    // halo : un trait large et translucide sous la flèche (pas de flou, trop coûteux)
    ctx.lineWidth = 10
    ctx.strokeStyle = look.halo
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
  }
  ctx.lineWidth = look ? 4 : 3
  if (skin === 'rainbow') {
    // hampe en six tronçons de couleur
    const part = ARROW_LENGTH / RAINBOW.length
    RAINBOW.forEach((band, index) => {
      ctx.strokeStyle = band
      ctx.beginPath()
      ctx.moveTo(tailX + dx * part * index, tailY + dy * part * index)
      ctx.lineTo(
        tailX + dx * part * (index + 1),
        tailY + dy * part * (index + 1),
      )
      ctx.stroke()
    })
  } else {
    ctx.strokeStyle = look ? look.shaft : '#5b4636'
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
  }
  ctx.lineWidth = 3
  // empennage aux couleurs du tireur
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const offset of [2, 11]) {
    const bx = tailX + dx * offset
    const by = tailY + dy * offset
    ctx.moveTo(bx - dx * 8 - dy * 6, by - dy * 8 + dx * 6)
    ctx.lineTo(bx, by)
    ctx.lineTo(bx - dx * 8 + dy * 6, by - dy * 8 - dx * 6)
  }
  ctx.stroke()
  if (headless) return
  // pointe, plus grosse sur les flèches spéciales
  const size = look ? 1.35 : 1
  ctx.fillStyle = look ? look.head : '#25324a'
  ctx.beginPath()
  ctx.moveTo(tipX + dx * 3 * size, tipY + dy * 3 * size)
  ctx.lineTo(
    tipX - (dx * 11 + dy * 5) * size,
    tipY - (dy * 11 - dx * 5) * size,
  )
  ctx.lineTo(
    tipX - (dx * 11 - dy * 5) * size,
    tipY - (dy * 11 + dx * 5) * size,
  )
  ctx.fill()
}

export function drawStick(ctx: CanvasRenderingContext2D, stick: Stick) {
  const p = stick.rag ? stick.rag.pts : stick.pts
  const f = stick.facing

  // arc, derrière le corps
  const gripX = p[HAND_B * 2]!
  const gripY = p[HAND_B * 2 + 1]!
  const bowAngle = stick.rag
    ? Math.atan2(gripY - p[ELBOW_B * 2 + 1]!, gripX - p[ELBOW_B * 2]!)
    : stick.bowAngle
  const draw = stick.rag ? 0 : stick.draw * stick.ready
  const dx = Math.cos(bowAngle)
  const dy = Math.sin(bowAngle)
  const back = 8 + 7 * draw
  const tipAX = gripX - dy * 38 - dx * back
  const tipAY = gripY + dx * 38 - dy * back
  const tipBX = gripX + dy * 38 - dx * back
  const tipBY = gripY - dx * 38 - dy * back
  const nockX = gripX - dx * (8 + 30 * draw)
  const nockY = gripY - dy * (8 + 30 * draw)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(37,50,74,.7)'
  ctx.beginPath()
  ctx.moveTo(tipAX, tipAY)
  ctx.lineTo(nockX, nockY)
  ctx.lineTo(tipBX, tipBY)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.strokeStyle = stick.color
  ctx.beginPath()
  ctx.moveTo(tipAX, tipAY)
  ctx.quadraticCurveTo(gripX + dx * 18, gripY + dy * 18, tipBX, tipBY)
  ctx.stroke()
  if (stick.aiming)
    drawArrow(
      ctx,
      nockX + dx * ARROW_LENGTH,
      nockY + dy * ARROW_LENGTH,
      bowAngle,
      stick.color,
      false,
      stick.skin,
    )

  // corps : un seul tracé
  const ink = stick.tint ?? INK
  ctx.lineWidth = 7
  ctx.strokeStyle = ink
  ctx.beginPath()
  ctx.moveTo(p[FOOT_L * 2]!, p[FOOT_L * 2 + 1]!)
  ctx.lineTo(p[KNEE_L * 2]!, p[KNEE_L * 2 + 1]!)
  ctx.lineTo(p[HIP * 2]!, p[HIP * 2 + 1]!)
  ctx.lineTo(p[KNEE_R * 2]!, p[KNEE_R * 2 + 1]!)
  ctx.lineTo(p[FOOT_R * 2]!, p[FOOT_R * 2 + 1]!)
  ctx.moveTo(p[HIP * 2]!, p[HIP * 2 + 1]!)
  ctx.lineTo(p[NECK * 2]!, p[NECK * 2 + 1]!)
  ctx.moveTo(p[HAND_B * 2]!, p[HAND_B * 2 + 1]!)
  ctx.lineTo(p[ELBOW_B * 2]!, p[ELBOW_B * 2 + 1]!)
  ctx.lineTo(p[NECK * 2]!, p[NECK * 2 + 1]!)
  ctx.lineTo(p[ELBOW_S * 2]!, p[ELBOW_S * 2 + 1]!)
  ctx.lineTo(p[HAND_S * 2]!, p[HAND_S * 2 + 1]!)
  ctx.stroke()

  const headX = p[HEAD * 2]!
  const headY = p[HEAD * 2 + 1]!
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2)
  ctx.fill()

  // œil : un point, ou un trait quand il est sonné
  ctx.fillStyle = '#f4f7ff'
  if (stick.rag) ctx.fillRect(headX + f * 2, headY + 4, 7, 2.2)
  else {
    ctx.beginPath()
    ctx.arc(headX + f * 6, headY + 5, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // casque médiéval (chapel de fer + nasal), incliné comme la tête
  const upX = headX - p[NECK * 2]!
  const upY = headY - p[NECK * 2 + 1]!
  const upLength = Math.hypot(upX, upY) || 1
  const crestX = headX + (upX / upLength) * (HEAD_R + 3)
  const crestY = headY + (upY / upLength) * (HEAD_R + 3)
  // plumet aux couleurs du joueur, derrière la calotte
  const b = stick.band
  ctx.strokeStyle = stick.color
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(crestX, crestY)
  ctx.lineTo(b[0]!, b[1]!)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(b[0]!, b[1]!)
  ctx.lineTo(b[2]!, b[3]!)
  ctx.stroke()

  ctx.save()
  ctx.translate(headX, headY)
  ctx.rotate(Math.atan2(upX, -upY))
  // calotte
  ctx.fillStyle = '#aab6c6'
  ctx.beginPath()
  ctx.arc(0, -2, HEAD_R + 2.5, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  // reflet
  ctx.strokeStyle = 'rgba(255,255,255,.6)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, -2, HEAD_R - 2.5, Math.PI * 1.15, Math.PI * 1.45)
  ctx.stroke()
  // bord du chapel et nasal, en acier plus sombre
  ctx.strokeStyle = '#6f7f95'
  ctx.lineWidth = 4.5
  ctx.beginPath()
  ctx.moveTo(-HEAD_R - 6, -2)
  ctx.lineTo(HEAD_R + 6, -2)
  ctx.moveTo(f * 12, -2)
  ctx.lineTo(f * 12, 9)
  ctx.stroke()
  // rivet à la base du plumet
  ctx.fillStyle = '#6f7f95'
  ctx.beginPath()
  ctx.arc(0, -HEAD_R - 4, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // flèches plantées, dans le repère du torse
  if (stick.stuck.length) {
    const hipX = p[HIP * 2]!
    const hipY = p[HIP * 2 + 1]!
    const ex = p[NECK * 2]! - hipX
    const ey = p[NECK * 2 + 1]! - hipY
    const length = Math.hypot(ex, ey) || 1
    const ux = ex / length
    const uy = ey / length
    const base = Math.atan2(uy, ux)
    for (const arrow of stick.stuck)
      drawArrow(
        ctx,
        hipX + ux * arrow.u - uy * arrow.v,
        hipY + uy * arrow.u + ux * arrow.v,
        base + arrow.angle,
        arrow.color,
        true,
        arrow.skin,
      )
  }
}
