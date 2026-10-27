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
}
export type CrewDef = { id: string; name: string; card?: CrewCard }
export type LocalState = { x: number; y: number; dir: 1 | -1 }
export type RemoteState = { x: number; y: number; dir: number }

export type EngineOptions = {
  localId: string | null
  getGeometry: () => Geometry
  /** ~10x/s quand le joueur local bouge, et toutes les 4 s à l'arrêt. */
  onLocalState?: (state: LocalState) => void
  /** Le joueur local a poussé : id de la cible la plus proche, ou null (coup dans le vide). */
  onPush?: (targetId: string | null) => void
  pushEnabled?: boolean
  fallDuration?: number
  pushCooldown?: number
}

type Crew = {
  id: string
  el: HTMLElement
  nameEl: HTMLElement
  bubbleEl: HTMLElement
  cardEl: HTMLElement
  colorKey: ColorKey
  isLocal: boolean
  nx: number
  ny: number
  tnx: number
  tny: number
  hasState: boolean
  dir: 1 | -1
  moving: boolean
  fallen: boolean
  vx: number
  vy: number
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

const EMIT_EVERY_MS = 100
const HEARTBEAT_MS = 4_000

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
      '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger<span></span>' +
      '<kbd>Espace</kbd> pousser'
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
      const crew = this.crew.get(def.id) ?? this.addCrew(def, index, defs.length)
      crew.nameEl.textContent = def.name
      this.setColor(crew, colors.get(def.id) ?? crew.colorKey)
      this.renderCard(crew, def.card)
    })
  }

  /** Position d'un joueur distant (coordonnées normalisées). */
  applyRemoteState(id: string, state: RemoteState) {
    const crew = this.crew.get(id)
    if (!crew || crew.isLocal) return
    crew.tnx = clamp(state.x, 0, 1)
    crew.tny = clamp(state.y, 0, 1)
    crew.dir = state.dir < 0 ? -1 : 1
    if (!crew.hasState) {
      crew.nx = crew.tnx
      crew.ny = crew.tny
      crew.hasState = true
    }
  }

  /** Un joueur vient de se faire pousser (événement serveur). */
  hit(id: string, dx: number, _dy: number) {
    const crew = this.crew.get(id)
    if (!crew || crew.fallen) return
    crew.fallen = true
    crew.moving = false
    crew.el.style.setProperty('--fall', dx < 0 ? '-1' : '1')
    crew.el.classList.remove('au-getup')
    crew.el.classList.add('au-fallen')
    this.say(id, SCREAMS[Math.floor(Math.random() * SCREAMS.length)] ?? 'Aïe !')
    if (crew.isLocal) {
      // projection : seul le client du joueur touché simule, les autres reçoivent sa position
        const angle = Math.random() * Math.PI * 2
        const speed = this.arena.width * (1.3 + Math.random() * 0.9)
        crew.vx = Math.cos(angle) * speed
        crew.vy = Math.sin(angle) * speed
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

  private push() {
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

    const range = this.size * 1.5
    let target: Crew | undefined
    let best = Infinity
    let tx = 0
    for (const other of this.crew.values()) {
      if (other === me || other.fallen) continue
      const dx = (other.nx - me.nx) * this.arena.width
      const dy = (other.ny - me.ny) * this.arena.height
      const distance = Math.hypot(dx, dy * 1.6) // la profondeur compte plus
      if (distance < range && distance < best) {
        best = distance
        target = other
        tx = dx
      }
    }
    if (target && tx) me.dir = tx < 0 ? -1 : 1

    this.playPush(me.id, me.dir)
    this.opts.onPush?.(target ? target.id : null)
  }

  /* ------------------------------------------------------------ Crew */

  private addCrew(def: CrewDef, index: number, total: number): Crew {
    const colorKey = assignColors([def.id]).get(def.id) ?? 'red'
    const el = document.createElement('div')
    el.className = 'au-player'
    el.style.setProperty('--dir', '1')
    el.style.setProperty('--fall', '1')
    el.innerHTML =
      '<div class="au-bubble"></div><div class="au-name"></div>' +
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
      nameEl: el.querySelector<HTMLElement>('.au-name')!,
      bubbleEl: el.querySelector<HTMLElement>('.au-bubble')!,
      cardEl: el.querySelector<HTMLElement>('.au-card')!,
      colorKey,
      isLocal: false,
      nx,
      ny,
      tnx: nx,
      tny: ny,
      hasState: false,
      dir: 1,
      moving: false,
      fallen: false,
      vx: 0,
      vy: 0,
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
    if (!card || !visible) return
    crew.cardEl.classList.toggle('au-card--face', card.revealed)
    crew.cardEl.textContent = card.revealed ? (card.value ?? '') : ''
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
    const isMove = (Object.values(MOVE_KEYS) as readonly (readonly string[])[]).some(
      (list) => list.includes(key),
    )
    if (isMove) {
      this.keys.add(key)
      if (key.startsWith('arrow')) event.preventDefault()
    } else if (event.code === 'Space') {
      // Espace pousse (Entrée reste disponible pour activer un bouton au clavier)
      event.preventDefault()
      if (!event.repeat) this.push()
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase())
    if (event.code === 'Space' && !inputBlocked(event.target))
      event.preventDefault() // évite de "cliquer" le bouton focus au relâchement
  }

  private readonly onBlur = () => this.keys.clear()

  /* ------------------------------------------------------------ Boucle */

  private readonly tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const { arena, size } = this
    const minX = arena.left + size * 0.4
    const maxX = arena.left + arena.width - size * 0.4
    const minY = arena.top + size * 1.35
    const maxY = arena.top + arena.height - 4

    for (const crew of this.crew.values()) {
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
          let nextX = px + crew.vx * dt
          let nextY = py + crew.vy * dt
          if (nextX < minX) {
            nextX = minX + (minX - nextX)
            crew.vx = Math.abs(crew.vx)
          } else if (nextX > maxX) {
            nextX = maxX - (nextX - maxX)
            crew.vx = -Math.abs(crew.vx)
          }
          if (nextY < minY) {
            nextY = minY + (minY - nextY)
            crew.vy = Math.abs(crew.vy)
          } else if (nextY > maxY) {
            nextY = maxY - (nextY - maxY)
            crew.vy = -Math.abs(crew.vy)
          }
          px = nextX
          py = nextY
          const friction = Math.exp(-0.9 * dt)
          crew.vx *= friction
          crew.vy *= friction
          if (Math.hypot(crew.vx, crew.vy) < 4) crew.vx = crew.vy = 0
        }
        px = clamp(px, minX, Math.max(minX, maxX))
        py = clamp(py, minY, Math.max(minY, maxY))
        ;[px, py] = this.collideTable(px, py)
      } else if (crew.hasState) {
        const k = 1 - Math.exp(-12 * dt)
        crew.nx += (crew.tnx - crew.nx) * k
        crew.ny += (crew.tny - crew.ny) * k
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
