import { PALETTE, SPRITE, assignColors, type ColorKey } from './sprite'

/**
 * Moteur du thème Among Us : des crewmates qui se baladent dans la zone de jeu.
 * Impératif et sans React (60 fps via requestAnimationFrame, pas de setState par
 * frame). Le composant AmongUsLayer le pilote et le branche sur Convex.
 *
 * Les positions sont normalisées (0..1) dans la zone de jeu : deux écrans de
 * tailles différentes voient la même scène.
 */

export type Rect = { left: number; top: number; width: number; height: number }
/** Coordonnées en pixels viewport. `table` est un obstacle elliptique (la vraie table de la salle). */
export type Geometry = { arena: Rect; table: Rect | null }
export type CrewCard = {
  voted: boolean
  revealed: boolean
  value: string | null
  designId?: string | null
}
export type CrewDef = {
  id: string
  name: string
  avatarFrameId?: string | null
  isSpectator?: boolean
  card?: CrewCard
}
export type LocalState = { x: number; y: number; dir: 1 | -1 }
export type RemoteState = {
  x: number
  y: number
  dir: number
  updatedAt?: number
}

export type EngineOptions = {
  localId: string | null
  getGeometry: () => Geometry
  /** Position locale throttled; les déplacements distants sont interpolés. */
  onLocalState?: (state: LocalState) => void
  /** Le joueur a relâché l'attaque : cible et puissance normalisée 0..1. */
  onPush?: (targetId: string | null, power: number) => void
  pushEnabled?: boolean
  fallDuration?: number
  pushCooldown?: number
}

type Crew = {
  id: string
  el: HTMLElement
  nameWrapperEl: HTMLElement
  nameEl: HTMLElement
  spectatorEl: HTMLElement
  afkEl: HTMLElement
  bubbleEl: HTMLElement
  cardEl: HTMLElement
  colorKey: ColorKey
  isLocal: boolean
  nx: number
  ny: number
  tnx: number
  tny: number
  hasState: boolean
  remoteStartX: number
  remoteStartY: number
  remoteStartAt: number
  lastRemoteUpdatedAt: number | undefined
  lastHeardAt: number
  isAfk: boolean
  dir: 1 | -1
  moving: boolean
  fallen: boolean
  vx: number
  vy: number
  knockbackDrag: number
  lastPush: number
  fallTimer: number | undefined
  pushTimer: number | undefined
  bubbleTimer: number | undefined
  renderedDir: number | undefined
  renderedWalk: boolean | undefined
}

const MOVE_KEYS = {
  up: ['z', 'w', 'arrowup'],
  left: ['q', 'a', 'arrowleft'],
  down: ['s', 'arrowdown'],
  right: ['d', 'arrowright'],
} as const
type Direction = keyof typeof MOVE_KEYS

const SCREAMS = [
  'Aïe !',
  'AAAH !',
  'Sus…',
  'Pourquoi ?!',
  'Éjecté !',
  'Mon dos…',
  '🤕',
  'Hého !',
]

const EMIT_EVERY_MS = 240
const HEARTBEAT_MS = 5_000
const AFK_AFTER_MS = 30_000
const REMOTE_INTERPOLATION_MS = 260
const MAX_CHARGE_MS = 5_000

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function inputBlocked(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    )
      return true
  }
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null
}

export class AmongUsEngine {
  private readonly host: HTMLElement
  private readonly opts: Required<
    Pick<EngineOptions, 'pushEnabled' | 'fallDuration' | 'pushCooldown'>
  > &
    EngineOptions
  private readonly crew = new Map<string, Crew>()
  private readonly keys = new Set<string>()
  private readonly timers = new Set<number>()
  private readonly hintEl: HTMLElement
  private chargeStartedAt: number | undefined
  private chargeTimer: number | undefined

  private arena: Rect = { left: 0, top: 0, width: 800, height: 400 }
  private table: Rect | null = null
  private size = 64
  private speed = 220

  private raf = 0
  private lastFrame = 0
  private lastEmit = 0
  private lastSent = ''
  private geometryTimer = 0
  private resizeObserver: ResizeObserver | undefined

  constructor(host: HTMLElement, options: EngineOptions) {
    this.host = host
    this.opts = {
      pushEnabled: true,
      fallDuration: 3000,
      pushCooldown: 700,
      ...options,
    }

    this.hintEl = document.createElement('div')
    this.hintEl.className = 'au-hint'
    this.hintEl.innerHTML =
      '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> Se déplac<span></span>' +
      '<kbd>Espace</kbd> Pousser<span class="au-charge-meter"><i></i></span>'
    host.append(this.hintEl)

    this.refreshGeometry()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('resize', this.refreshGeometry)
    window.addEventListener('scroll', this.refreshGeometry, { passive: true })
    this.geometryTimer = window.setInterval(this.refreshGeometry, 500)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.refreshGeometry)
      this.resizeObserver.observe(document.body)
    }

    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  /* ------------------------------------------------------------ API */

  setLocalId(id: string | null) {
    if (this.opts.localId === id) return
    this.opts.localId = id
    for (const crew of this.crew.values()) this.applyLocalFlag(crew)
  }

  setPushEnabled(enabled: boolean) {
    this.opts.pushEnabled = enabled
  }

  /** Synchronise la liste des joueurs (ajoute, met à jour, retire). */
  setPlayers(defs: readonly CrewDef[]) {
    const ids = new Set(defs.map((def) => def.id))
    for (const id of [...this.crew.keys()]) {
      if (!ids.has(id)) this.removeCrew(id)
    }
    const colors = assignColors(defs.map((def) => def.id))
    defs.forEach((def, index) => {
      const crew =
        this.crew.get(def.id) ?? this.addCrew(def, index, defs.length)
      crew.nameEl.textContent = def.name
      crew.spectatorEl.hidden = !def.isSpectator
      crew.nameWrapperEl.className = 'au-name'
      this.setColor(crew, colors.get(def.id) ?? crew.colorKey)
      this.renderCard(crew, def.card)
    })
  }

  /** Position d'un joueur distant (coordonnées normalisées). */
  applyRemoteState(id: string, state: RemoteState) {
    const crew = this.crew.get(id)
    if (!crew || crew.isLocal) return
    const updatedAt = state.updatedAt ?? Date.now()
    if (updatedAt !== crew.lastRemoteUpdatedAt) {
      crew.lastRemoteUpdatedAt = updatedAt
      crew.lastHeardAt = performance.now() - Math.max(0, Date.now() - updatedAt)
      crew.isAfk = false
      crew.afkEl.hidden = true
    }
    const dir = state.dir < 0 ? -1 : 1
    const nextX = clamp(state.x, 0, 1)
    const nextY = clamp(state.y, 0, 1)
    if (!crew.hasState) {
      crew.nx = nextX
      crew.ny = nextY
      crew.remoteStartX = nextX
      crew.remoteStartY = nextY
      crew.remoteStartAt = performance.now()
      crew.hasState = true
    } else if (nextX !== crew.tnx || nextY !== crew.tny || dir !== crew.dir) {
      crew.remoteStartX = crew.nx
      crew.remoteStartY = crew.ny
      crew.remoteStartAt = performance.now()
    }
    crew.tnx = nextX
    crew.tny = nextY
    crew.dir = dir
  }

  /** Un joueur vient de se faire pousser (événement serveur). */
  hit(id: string, dx: number, _dy: number, power = 0) {
    const crew = this.crew.get(id)
    if (!crew || crew.fallen) return
    crew.fallen = true
    crew.moving = false
    crew.el.style.setProperty('--fall', dx < 0 ? '-1' : '1')
    crew.el.classList.remove('au-getup')
    crew.el.classList.add('au-fallen')
    this.say(id, SCREAMS[Math.floor(Math.random() * SCREAMS.length)] ?? 'Aïe !')
    if (crew.isLocal) {
      const charge = clamp(power, 0, 1)
      const knockback = this.size * 2 + this.arena.width * 2.5 * charge
      crew.knockbackDrag = 5 - charge * 2.8
      crew.vx = (dx < 0 ? -1 : 1) * knockback
      crew.vy = 0
    }
    window.clearTimeout(crew.fallTimer)
    crew.fallTimer = this.later(() => this.getUp(crew), this.opts.fallDuration)
  }

  /** Animation du coup de bras d'un autre joueur. */
  playPush(id: string, dx: number) {
    const crew = this.crew.get(id)
    if (!crew || crew.fallen) return
    if (dx) crew.dir = dx < 0 ? -1 : 1
    crew.el.classList.remove('au-pushing')
    void crew.el.offsetWidth // relance l'animation CSS
    crew.el.classList.add('au-pushing')
    window.clearTimeout(crew.pushTimer)
    crew.pushTimer = this.later(
      () => crew.el.classList.remove('au-pushing'),
      340,
    )
  }

  say(id: string, text: string, duration = 1600) {
    const crew = this.crew.get(id)
    if (!crew) return
    crew.bubbleEl.textContent = text
    crew.bubbleEl.classList.add('au-show')
    window.clearTimeout(crew.bubbleTimer)
    crew.bubbleTimer = this.later(
      () => crew.bubbleEl.classList.remove('au-show'),
      duration,
    )
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.clearInterval(this.geometryTimer)
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.refreshGeometry)
    window.removeEventListener('scroll', this.refreshGeometry)
    this.resizeObserver?.disconnect()
    for (const crew of this.crew.values()) crew.el.remove()
    this.crew.clear()
    this.hintEl.remove()
  }

  /* ------------------------------------------------------------ Actions locales */

  private local(): Crew | undefined {
    const id = this.opts.localId
    return id === null ? undefined : this.crew.get(id)
  }

  private push(power: number) {
    const me = this.local()
    const now = performance.now()
    if (
      !me ||
      me.fallen ||
      !this.opts.pushEnabled ||
      now - me.lastPush < this.opts.pushCooldown
    )
      return
    me.lastPush = now

    const hitRadiusX = this.size * (0.48 + power * 1.35)
    const hitRadiusY = this.size * (0.52 + power * 1.1)
    let target: Crew | undefined
    let best = Infinity
    let tx = 0
    for (const other of this.crew.values()) {
      if (other === me || other.fallen) continue
      const dx = (other.nx - me.nx) * this.arena.width
      const dy = (other.ny - me.ny) * this.arena.height
      const distance = Math.hypot(dx / hitRadiusX, dy / hitRadiusY)
      if (distance <= 1 && distance < best) {
        best = distance
        target = other
        tx = dx
      }
    }
    if (target && tx) me.dir = tx < 0 ? -1 : 1

    this.playPush(me.id, me.dir)
    this.opts.onPush?.(target ? target.id : null, power)
  }

  private startCharge() {
    const me = this.local()
    if (
      !me ||
      me.fallen ||
      !this.opts.pushEnabled ||
      this.chargeStartedAt !== undefined
    )
      return
    this.chargeStartedAt = performance.now()
    this.hintEl.classList.add('au-charging')
    this.chargeTimer = this.later(() => {
      this.chargeTimer = undefined
      this.releaseCharge()
    }, MAX_CHARGE_MS)
  }

  private releaseCharge() {
    if (this.chargeStartedAt === undefined) return
    if (this.chargeTimer !== undefined) {
      window.clearTimeout(this.chargeTimer)
      this.timers.delete(this.chargeTimer)
      this.chargeTimer = undefined
    }
    const power = clamp(
      (performance.now() - this.chargeStartedAt) / MAX_CHARGE_MS,
      0,
      1,
    )
    this.chargeStartedAt = undefined
    this.hintEl.classList.remove('au-charging')
    this.hintEl.style.setProperty('--charge', '0%')
    this.push(power)
  }

  /* ------------------------------------------------------------ Crew */

  private addCrew(def: CrewDef, index: number, total: number): Crew {
    const colorKey = assignColors([def.id]).get(def.id) ?? 'red'
    const el = document.createElement('div')
    el.className = 'au-player'
    el.style.setProperty('--dir', '1')
    el.style.setProperty('--fall', '1')
    el.innerHTML =
      '<div class="au-bubble"></div><div class="au-name"><span class="au-name-text"></span>' +
      '<small class="au-spectator" hidden>Spectateur</small><small class="au-afk" hidden>AFK</small></div>' +
      '<div class="au-card" hidden></div><div class="au-stars">💫</div>' +
      '<div class="au-shadow"></div><div class="au-flip"><div class="au-lunge">' +
      `<div class="au-sprite">${SPRITE}</div></div></div>`
    this.host.append(el)

    let px: number
    let py: number
    if (this.table) {
      const angle = Math.PI / 2 + (index / Math.max(total, 1)) * Math.PI * 2
      const centerX = this.table.left + this.table.width / 2
      const centerY = this.table.top + this.table.height / 2
      const radiusX = this.table.width / 2 + this.size * 0.9
      const radiusY = this.table.height / 2 + this.size * 0.7
      px = centerX + Math.cos(angle) * radiusX
      py = centerY + Math.sin(angle) * radiusY
    } else {
      px = this.arena.left + this.arena.width * 0.5
      py = this.arena.top + this.arena.height * 0.5
    }
    const minX = this.arena.left + this.size * 0.4
    const maxX = this.arena.left + this.arena.width - this.size * 0.4
    const minY = this.arena.top + this.size * 1.35
    const maxY = this.arena.top + this.arena.height - 4
    px = clamp(px, minX, Math.max(minX, maxX))
    py = clamp(py, minY, Math.max(minY, maxY))
    ;[px, py] = this.collideTable(px, py)
    px = clamp(px, minX, Math.max(minX, maxX))
    py = clamp(py, minY, Math.max(minY, maxY))
    const [nx, ny] = this.toNormalized(px, py)

    const crew: Crew = {
      id: def.id,
      el,
      nameWrapperEl: el.querySelector<HTMLElement>('.au-name')!,
      nameEl: el.querySelector<HTMLElement>('.au-name-text')!,
      spectatorEl: el.querySelector<HTMLElement>('.au-spectator')!,
      afkEl: el.querySelector<HTMLElement>('.au-afk')!,
      bubbleEl: el.querySelector<HTMLElement>('.au-bubble')!,
      cardEl: el.querySelector<HTMLElement>('.au-card')!,
      colorKey,
      isLocal: false,
      nx,
      ny,
      tnx: nx,
      tny: ny,
      hasState: false,
      remoteStartX: nx,
      remoteStartY: ny,
      remoteStartAt: performance.now(),
      lastRemoteUpdatedAt: undefined,
      lastHeardAt: performance.now(),
      isAfk: false,
      dir: 1,
      moving: false,
      fallen: false,
      vx: 0,
      vy: 0,
      knockbackDrag: 5,
      lastPush: 0,
      fallTimer: undefined,
      pushTimer: undefined,
      bubbleTimer: undefined,
      renderedDir: undefined,
      renderedWalk: undefined,
    }
    this.applyLocalFlag(crew)
    this.setColor(crew, colorKey)
    this.crew.set(def.id, crew)
    return crew
  }

  private removeCrew(id: string) {
    const crew = this.crew.get(id)
    if (!crew) return
    window.clearTimeout(crew.fallTimer)
    window.clearTimeout(crew.pushTimer)
    window.clearTimeout(crew.bubbleTimer)
    crew.el.remove()
    this.crew.delete(id)
  }

  private applyLocalFlag(crew: Crew) {
    crew.isLocal = crew.id === this.opts.localId
    crew.el.classList.toggle('au-me', crew.isLocal)
    if (crew.isLocal) {
      crew.lastHeardAt = performance.now()
      crew.isAfk = false
      crew.afkEl.hidden = true
    }
  }

  private setColor(crew: Crew, key: ColorKey) {
    const [main, shade] = PALETTE[key]
    crew.colorKey = key
    crew.el.style.setProperty('--c', main)
    crew.el.style.setProperty('--c2', shade)
  }

  private renderCard(crew: Crew, card: CrewCard | undefined) {
    const visible = Boolean(card?.voted)
    crew.cardEl.hidden = !visible
    if (!card || !visible) {
      delete crew.cardEl.dataset.cardDesign
      crew.cardEl.classList.remove('au-card--face')
      crew.cardEl.replaceChildren()
      return
    }
    if (card.designId) crew.cardEl.dataset.cardDesign = card.designId
    else delete crew.cardEl.dataset.cardDesign
    crew.cardEl.classList.toggle('au-card--face', card.revealed)
    crew.cardEl.replaceChildren()
    if (card.revealed && card.value !== null) {
      const value = document.createElement('span')
      value.className = 'au-card-value'
      value.textContent = card.value
      crew.cardEl.append(value)
    }
  }

  private getUp(crew: Crew) {
    crew.fallen = false
    crew.el.classList.remove('au-fallen')
    crew.el.classList.add('au-getup')
    this.later(() => crew.el.classList.remove('au-getup'), 420)
  }

  private later(callback: () => void, delay: number) {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      callback()
    }, delay)
    this.timers.add(id)
    return id
  }

  /* ------------------------------------------------------------ Géométrie */

  private readonly refreshGeometry = () => {
    const geometry = this.opts.getGeometry()
    this.arena = geometry.arena
    this.table = geometry.table
    this.size = clamp(
      Math.min(geometry.arena.height * 0.14, geometry.arena.width * 0.09),
      44,
      80,
    )
    this.speed = clamp(geometry.arena.width * 0.18, 190, 300)
    this.host.style.setProperty('--au-s', `${this.size}px`)
  }

  private toNormalized(x: number, y: number): [number, number] {
    return [
      (x - this.arena.left) / this.arena.width,
      (y - this.arena.top) / this.arena.height,
    ]
  }

  /** Les pieds ne peuvent pas entrer dans l'ellipse de la table. */
  private collideTable(px: number, py: number): [number, number] {
    const table = this.table
    if (!table) return [px, py]
    const cx = table.left + table.width / 2
    const cy = table.top + table.height / 2
    const rx = table.width / 2 + this.size * 0.25
    const ry = table.height / 2 + this.size * 0.15
    const nx = (px - cx) / rx
    const ny = (py - cy) / ry
    const d = nx * nx + ny * ny
    if (d >= 1) return [px, py]
    if (d < 1e-4) return [cx, cy + ry]
    const f = 1 / Math.sqrt(d)
    return [cx + nx * f * rx, cy + ny * f * ry]
  }

  /* ------------------------------------------------------------ Clavier */

  private down(direction: Direction) {
    return MOVE_KEYS[direction].some((key) => this.keys.has(key))
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      inputBlocked(event.target)
    )
      return
    const key = event.key.toLowerCase()
    const isMove = (
      Object.values(MOVE_KEYS) as readonly (readonly string[])[]
    ).some((list) => list.includes(key))
    if (isMove) {
      this.keys.add(key)
      if (key.startsWith('arrow')) event.preventDefault()
    } else if (event.code === 'Space') {
      // Maintenir Espace charge le coup; le relâcher déclenche la poussée.
      event.preventDefault()
      if (!event.repeat) this.startCharge()
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase())
    if (event.code === 'Space') {
      if (!inputBlocked(event.target)) event.preventDefault()
      this.releaseCharge()
    }
  }

  private readonly onBlur = () => {
    this.keys.clear()
    if (this.chargeTimer !== undefined) {
      window.clearTimeout(this.chargeTimer)
      this.timers.delete(this.chargeTimer)
      this.chargeTimer = undefined
    }
    this.chargeStartedAt = undefined
    this.hintEl.classList.remove('au-charging')
  }

  /* ------------------------------------------------------------ Boucle */

  private readonly tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    if (this.chargeStartedAt !== undefined) {
      const progress = clamp((now - this.chargeStartedAt) / MAX_CHARGE_MS, 0, 1)
      this.hintEl.style.setProperty('--charge', `${progress * 100}%`)
    }
    const { arena, size } = this
    const minX = arena.left + size * 0.4
    const maxX = arena.left + arena.width - size * 0.4
    const minY = arena.top + size * 1.35
    const maxY = arena.top + arena.height - 4

    for (const crew of this.crew.values()) {
      const isAfk = !crew.isLocal && now - crew.lastHeardAt >= AFK_AFTER_MS
      if (crew.isAfk !== isAfk) {
        crew.isAfk = isAfk
        crew.afkEl.hidden = !isAfk
      }
      let px = arena.left + crew.nx * arena.width
      let py = arena.top + crew.ny * arena.height

      if (crew.isLocal) {
        crew.moving = false
        if (!crew.fallen) {
          const ix = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0)
          const iy = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0)
          if (ix || iy) {
            const norm = Math.hypot(ix, iy)
            px += (ix / norm) * this.speed * dt
            py += (iy / norm) * this.speed * dt * 0.75 // la profondeur est un peu plus lente
            crew.moving = true
            if (ix) crew.dir = ix < 0 ? -1 : 1
          }
        }
        if (crew.vx || crew.vy) {
          px += crew.vx * dt
          py += crew.vy * dt
          const friction = Math.exp(-crew.knockbackDrag * dt)
          crew.vx *= friction
          crew.vy *= friction
          if (Math.hypot(crew.vx, crew.vy) < 4) crew.vx = crew.vy = 0
        }
        px = clamp(px, minX, Math.max(minX, maxX))
        py = clamp(py, minY, Math.max(minY, maxY))
        ;[px, py] = this.collideTable(px, py)
      } else if (crew.hasState) {
        const progress = clamp(
          (now - crew.remoteStartAt) / REMOTE_INTERPOLATION_MS,
          0,
          1,
        )
        const eased = progress * progress * (3 - 2 * progress)
        crew.nx = crew.remoteStartX + (crew.tnx - crew.remoteStartX) * eased
        crew.ny = crew.remoteStartY + (crew.tny - crew.remoteStartY) * eased
        px = arena.left + crew.nx * arena.width
        py = arena.top + crew.ny * arena.height
        crew.moving =
          !crew.fallen &&
          Math.hypot(
            (crew.tnx - crew.nx) * arena.width,
            (crew.tny - crew.ny) * arena.height,
          ) > 2
      }

      ;[crew.nx, crew.ny] = this.toNormalized(px, py)
      this.render(crew, px, py)
    }

    this.emitLocalState(now)
    this.raf = requestAnimationFrame(this.tick)
  }

  private emitLocalState(now: number) {
    const me = this.local()
    if (!me || !this.opts.onLocalState || now - this.lastEmit < EMIT_EVERY_MS)
      return
    const x = Math.round(me.nx * 10_000) / 10_000
    const y = Math.round(me.ny * 10_000) / 10_000
    const signature = `${x},${y},${me.dir}`
    if (signature === this.lastSent && now - this.lastEmit < HEARTBEAT_MS)
      return
    this.lastSent = signature
    this.lastEmit = now
    me.lastHeardAt = now
    this.opts.onLocalState({ x, y, dir: me.dir })
  }

  private render(crew: Crew, px: number, py: number) {
    const s = this.size
    crew.el.style.transform = `translate3d(${(px - s / 2).toFixed(1)}px,${(py - s * 1.2).toFixed(1)}px,0)`
    crew.el.style.zIndex = String(Math.round(py))
    if (crew.renderedDir !== crew.dir) {
      crew.el.style.setProperty('--dir', String(crew.dir))
      crew.renderedDir = crew.dir
    }
    const walking = crew.moving && !crew.fallen
    if (crew.renderedWalk !== walking) {
      crew.el.classList.toggle('au-walking', walking)
      crew.renderedWalk = walking
    }
  }
}
