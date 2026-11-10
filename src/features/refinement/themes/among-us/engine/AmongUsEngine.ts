import { PALETTE, SPRITE, assignColors, type ColorKey } from './sprite'

/**
 * Moteur du thème Among Us : des crewmates qui se baladent dans la zone de jeu.
 * Impératif et sans React (requestAnimationFrame, pas de setState par frame).
 * Le composant AmongUsLayer le pilote et le branche sur Convex.
 *
 * Les positions sont normalisées (0..1) dans la zone de jeu : deux écrans de
 * tailles différentes voient la même scène.
 *
 * Réseau (dead reckoning) : chaque client envoie position + vitesse, et
 * seulement quand ce que les autres extrapolent s'écarte de la réalité
 * (changement de direction, arrêt, obstacle). Entre deux envois, les joueurs
 * distants avancent à vitesse constante : le mouvement reste continu même avec
 * peu de messages.
 *
 * Chute : simulée par chaque client à partir du même coup (direction +
 * puissance). La victime s'envole en vrille, rebondit au sol, ricoche sur les
 * murs et la table, puis glisse. Le client de la victime fait autorité sur sa
 * position ; les autres prédisent la trajectoire puis se recalent en douceur.
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
/** `vx` / `vy` : vitesse en unités normalisées par seconde. */
export type LocalState = {
  x: number
  y: number
  dir: 1 | -1
  vx: number
  vy: number
}
export type RemoteState = {
  x: number
  y: number
  dir: number
  vx?: number
  vy?: number
  updatedAt?: number
}

export type EngineOptions = {
  localId: string | null
  getGeometry: () => Geometry
  /** État local, émis uniquement quand l'extrapolation des autres devient fausse. */
  onLocalState?: (state: LocalState) => void
  /** Le joueur a relâché l'attaque : cible et puissance normalisée 0..1. */
  onPush?: (targetId: string | null, power: number) => void
  pushEnabled?: boolean
  fallDuration?: number
  pushCooldown?: number
}

/**
 * État du corps : `air` et `slide` = éjection en cours (le moteur déplace le
 * joueur), `down` = au sol, `getup` = se relève, `hop` = petit sursaut.
 */
type Phase = 'none' | 'air' | 'slide' | 'down' | 'getup' | 'hop'

type Crew = {
  id: string
  el: HTMLElement
  nameWrapperEl: HTMLElement
  nameEl: HTMLElement
  spectatorEl: HTMLElement
  afkEl: HTMLElement
  bubbleEl: HTMLElement
  cardEl: HTMLElement
  spriteEl: HTMLElement
  shadowEl: HTMLElement
  colorKey: ColorKey
  isLocal: boolean
  /** Position affichée (normalisée). */
  nx: number
  ny: number
  /** Dernier état reçu du réseau, et l'instant local de réception. */
  netX: number
  netY: number
  netVx: number
  netVy: number
  netAt: number
  hasState: boolean
  lastRemoteUpdatedAt: number | undefined
  lastHeardAt: number
  isAfk: boolean
  dir: 1 | -1
  moving: boolean
  fallen: boolean
  /** Vitesse de marche lissée du joueur local (px/s). */
  wx: number
  wy: number
  /** Vitesse réellement parcourue par le joueur local (normalisée/s), pour le réseau. */
  mvx: number
  mvy: number
  /** Corps : éjection (px/s au sol), hauteur, vrille, écrasement (ressort). */
  phase: Phase
  phaseAt: number
  kx: number
  ky: number
  z: number
  vz: number
  angle: number
  spin: number
  restAngle: number
  squash: number
  squashV: number
  bounces: number
  bumpedAt: number
  lastPush: number
  fallTimer: number | undefined
  pushTimer: number | undefined
  bubbleTimer: number | undefined
  renderedDir: number | undefined
  renderedWalk: boolean | undefined
  renderedPos: string
  renderedZ: number
  renderedBody: string
  renderedShadow: string
}

const MOVE_KEYS = {
  up: ['z', 'w', 'arrowup'],
  left: ['q', 'a', 'arrowleft'],
  down: ['s', 'arrowdown'],
  right: ['d', 'arrowright'],
} as const
type Direction = keyof typeof MOVE_KEYS
const MOVE_KEY_SET = new Set<string>(Object.values(MOVE_KEYS).flat())

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
const BUMPS = ['Hé !', 'Oh !', '!?', 'Oups']
const BONKS = ['BONK !', 'BOING !', 'PAF !', 'POF !']

const HEARTBEAT_MS = 5_000
const AFK_AFTER_MS = 30_000
const MAX_CHARGE_MS = 5_000

// Réseau
const MIN_EMIT_GAP_MS = 70
const KEEPALIVE_MOVING_MS = 400
const EMIT_ERROR_PX = 4
const EXTRAPOLATE_MAX_S = 0.5
const REMOTE_CHASE = 14 // 1/s : rattrapage de la cible extrapolée
const REMOTE_CHASE_FALLEN = 7

// Marche locale : accélération / freinage (1/s), assez vifs pour rester réactifs
const WALK_ACCEL = 20
const WALK_BRAKE = 28

// Chute (les longueurs sont en tailles de crewmate `size`)
const GRAVITY = 26
const BOUNCE = 0.52
const MAX_BOUNCES = 4
const AIR_DRAG = 0.5
const SLIDE_DRAG = 4.5
const WALL_BOUNCE = 0.75
const GETUP_MS = 450
const MAX_FX = 14

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const pick = (list: readonly string[]) =>
  list[Math.floor(Math.random() * list.length)] ?? ''

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
  /** États reçus avant que le joueur n'existe dans la salle. */
  private readonly pendingRemote = new Map<string, RemoteState>()
  private readonly keys = new Set<string>()
  private readonly timers = new Set<number>()
  private readonly hintEl: HTMLElement
  private ix = 0
  private iy = 0
  private chargeStartedAt: number | undefined
  private chargeTimer: number | undefined
  private renderedCharge = -1
  private fxCount = 0

  private arena: Rect = { left: 0, top: 0, width: 800, height: 400 }
  private table: Rect | null = null
  private size = 64
  private speed = 220

  private raf = 0
  private lastFrame = 0
  private lastEmit = 0
  private sent: LocalState | undefined
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
      '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> Se déplacer<span></span>' +
      '<kbd>Espace</kbd> Pousser (maintenir pour charger)' +
      '<span class="au-charge-meter"><i></i></span>'
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
    this.sent = undefined
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
      const pending = this.pendingRemote.get(def.id)
      if (pending) {
        this.pendingRemote.delete(def.id)
        this.applyRemoteState(def.id, pending)
      }
    })
  }

  /** Position + vitesse d'un joueur distant (coordonnées normalisées). */
  applyRemoteState(id: string, state: RemoteState) {
    const crew = this.crew.get(id)
    if (!crew) {
      this.pendingRemote.set(id, state)
      return
    }
    if (crew.isLocal) return
    // la liste complète revient à chaque changement : on ignore les joueurs inchangés
    if (
      crew.hasState &&
      state.updatedAt !== undefined &&
      state.updatedAt === crew.lastRemoteUpdatedAt
    )
      return
    const now = performance.now()
    crew.lastRemoteUpdatedAt = state.updatedAt
    crew.lastHeardAt =
      now - Math.max(0, Date.now() - (state.updatedAt ?? Date.now()))
    crew.netX = clamp(state.x, 0, 1)
    crew.netY = clamp(state.y, 0, 1)
    crew.netVx = Number.isFinite(state.vx) ? (state.vx as number) : 0
    crew.netVy = Number.isFinite(state.vy) ? (state.vy as number) : 0
    crew.netAt = now
    crew.dir = state.dir < 0 ? -1 : 1
    if (!crew.hasState) {
      crew.nx = crew.netX
      crew.ny = crew.netY
      crew.hasState = true
    }
  }

  /**
   * Un joueur vient de se faire pousser : il s'envole en vrille dans la
   * direction du coup. Appelé à la réception de l'événement serveur, et tout de
   * suite chez le pousseur (prédiction) : le doublon est alors ignoré.
   */
  hit(id: string, dx: number, dy: number, power = 0) {
    const crew = this.crew.get(id)
    if (!crew || crew.fallen) return
    const charge = clamp(power, 0, 1)
    const size = this.size
    const length = Math.hypot(dx, dy) || 1
    let ux = dx / length
    let uy = dy / length
    if (Math.abs(ux) < 0.3) {
      // toujours une composante latérale : la vrille se lit mieux de côté
      ux = (ux < 0 ? -1 : 1) * 0.6
      uy = Math.sign(uy) * 0.8
    }
    const speed = size * 3.2 + this.arena.width * 0.9 * charge

    crew.fallen = true
    crew.moving = false
    crew.wx = crew.wy = 0
    crew.phase = 'air'
    crew.phaseAt = performance.now()
    crew.kx = ux * speed
    crew.ky = uy * speed * 0.6
    crew.vz = size * (5 + 5.5 * charge)
    crew.spin = (ux < 0 ? -1 : 1) * (500 + 800 * charge)
    crew.bounces = 0
    crew.squashV += 3 // s'étire au décollage
    crew.el.classList.remove('au-down', 'au-pushing')
    crew.el.classList.add('au-fallen')
    if (crew.isLocal) this.cancelCharge()

    this.say(id, charge > 0.6 ? 'AAAAAAAAH !' : pick(SCREAMS))
    this.clearLater(crew.fallTimer)
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
    this.clearLater(crew.pushTimer)
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
    this.clearLater(crew.bubbleTimer)
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
    for (const fx of this.host.querySelectorAll('.au-fx')) fx.remove()
    this.crew.clear()
    this.pendingRemote.clear()
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
    let ty = 0
    for (const other of this.crew.values()) {
      if (other === me || other.fallen) continue
      const dx = (other.nx - me.nx) * this.arena.width
      const dy = (other.ny - me.ny) * this.arena.height
      const distance = Math.hypot(dx / hitRadiusX, dy / hitRadiusY)
      if (distance <= 1 && distance < best) {
        best = distance
        target = other
        tx = dx
        ty = dy
      }
    }
    if (target && tx) me.dir = tx < 0 ? -1 : 1

    this.playPush(me.id, me.dir)
    // Prédiction : la cible tombe tout de suite chez le pousseur, sans attendre
    // l'aller-retour serveur (qui confirmera pour tout le monde).
    if (target) {
      // même règle que le serveur : la victime part toujours un peu de côté
      const length = Math.hypot(tx, ty) || 1
      let kx = tx / length
      if (Math.abs(kx) < 0.3) kx = me.dir * 0.6
      this.hit(target.id, kx, ty / length, power)
    }
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
    me.el.classList.add('au-charging')
    this.chargeTimer = this.later(() => {
      this.chargeTimer = undefined
      this.releaseCharge()
    }, MAX_CHARGE_MS)
  }

  private releaseCharge() {
    if (this.chargeStartedAt === undefined) return
    const power = clamp(
      (performance.now() - this.chargeStartedAt) / MAX_CHARGE_MS,
      0,
      1,
    )
    this.cancelCharge()
    this.push(power)
  }

  private cancelCharge() {
    this.clearLater(this.chargeTimer)
    this.chargeTimer = undefined
    this.chargeStartedAt = undefined
    this.hintEl.classList.remove('au-charging')
    this.local()?.el.classList.remove('au-charging')
    this.renderCharge(0)
  }

  /** Jauge + crewmate qui se ramasse : feedback local de la charge. */
  private renderCharge(progress: number) {
    const value = Math.round(progress * 100)
    if (value === this.renderedCharge) return
    this.renderedCharge = value
    this.hintEl.style.setProperty('--charge', `${value}%`)
    this.local()?.el.style.setProperty('--chg', (value / 100).toFixed(2))
  }

  /* ------------------------------------------------------------ Crew */

  private addCrew(def: CrewDef, index: number, total: number): Crew {
    const colorKey = assignColors([def.id]).get(def.id) ?? 'red'
    const el = document.createElement('div')
    el.className = 'au-player'
    el.style.setProperty('--dir', '1')
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
    const { minX, maxX, minY, maxY } = this.bounds()
    px = clamp(px, minX, maxX)
    py = clamp(py, minY, maxY)
    ;[px, py] = this.collideTable(px, py)
    px = clamp(px, minX, maxX)
    py = clamp(py, minY, maxY)
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
      spriteEl: el.querySelector<HTMLElement>('.au-sprite')!,
      shadowEl: el.querySelector<HTMLElement>('.au-shadow')!,
      colorKey,
      isLocal: false,
      nx,
      ny,
      netX: nx,
      netY: ny,
      netVx: 0,
      netVy: 0,
      netAt: performance.now(),
      hasState: false,
      lastRemoteUpdatedAt: undefined,
      lastHeardAt: performance.now(),
      isAfk: false,
      dir: 1,
      moving: false,
      fallen: false,
      wx: 0,
      wy: 0,
      mvx: 0,
      mvy: 0,
      phase: 'none',
      phaseAt: 0,
      kx: 0,
      ky: 0,
      z: 0,
      vz: 0,
      angle: 0,
      spin: 0,
      restAngle: 0,
      squash: 0,
      squashV: 0,
      bounces: 0,
      bumpedAt: 0,
      lastPush: 0,
      fallTimer: undefined,
      pushTimer: undefined,
      bubbleTimer: undefined,
      renderedDir: undefined,
      renderedWalk: undefined,
      renderedPos: '',
      renderedZ: -1,
      renderedBody: '',
      renderedShadow: '',
    }
    this.applyLocalFlag(crew)
    this.setColor(crew, colorKey)
    this.crew.set(def.id, crew)
    return crew
  }

  private removeCrew(id: string) {
    const crew = this.crew.get(id)
    if (!crew) return
    this.clearLater(crew.fallTimer)
    this.clearLater(crew.pushTimer)
    this.clearLater(crew.bubbleTimer)
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
    } else {
      crew.el.classList.remove('au-charging')
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

  /** Fin de la chute : il se redresse d'un petit bond (animé dans stepBody). */
  private getUp(crew: Crew) {
    crew.fallen = false
    crew.fallTimer = undefined
    crew.phase = 'getup'
    crew.phaseAt = performance.now()
    crew.restAngle = crew.angle
    crew.kx = crew.ky = 0
    crew.spin = 0
    crew.el.classList.remove('au-fallen', 'au-down')
  }

  private later(callback: () => void, delay: number) {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      callback()
    }, delay)
    this.timers.add(id)
    return id
  }

  private clearLater(id: number | undefined) {
    if (id === undefined) return
    window.clearTimeout(id)
    this.timers.delete(id)
  }

  /** Petit effet jetable : nuage de poussière ou onomatopée. */
  private fx(kind: 'puff' | 'pop', px: number, py: number, text?: string) {
    if (this.fxCount >= MAX_FX) return
    const el = document.createElement('div')
    el.className = `au-fx au-${kind}`
    if (text) el.textContent = text
    el.style.left = `${px.toFixed(0)}px`
    el.style.top = `${py.toFixed(0)}px`
    el.style.zIndex = String(Math.round(py) + 1)
    this.host.append(el)
    this.fxCount++
    this.later(() => {
      el.remove()
      this.fxCount--
    }, 560)
  }

  private bonk(px: number, py: number) {
    this.fx('pop', px, py - this.size * 0.9, pick(BONKS))
  }

  /* ------------------------------------------------------------ Géométrie */

  private readonly refreshGeometry = () => {
    const geometry = this.opts.getGeometry()
    this.arena = geometry.arena
    this.table = geometry.table
    const size = clamp(
      Math.min(geometry.arena.height * 0.14, geometry.arena.width * 0.09),
      44,
      80,
    )
    this.speed = clamp(geometry.arena.width * 0.18, 190, 300)
    if (size !== this.size || !this.host.style.getPropertyValue('--au-s')) {
      this.size = size
      this.host.style.setProperty('--au-s', `${size}px`)
    }
  }

  private toNormalized(x: number, y: number): [number, number] {
    return [
      (x - this.arena.left) / this.arena.width,
      (y - this.arena.top) / this.arena.height,
    ]
  }

  /** Limites de la zone de jeu pour les pieds d'un crewmate (pixels). */
  private bounds() {
    const { arena, size } = this
    const minX = arena.left + size * 0.4
    const minY = arena.top + size * 1.35
    return {
      minX,
      maxX: Math.max(minX, arena.left + arena.width - size * 0.4),
      minY,
      maxY: Math.max(minY, arena.top + arena.height - 4),
    }
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

  private refreshInput() {
    const down = (direction: Direction) =>
      MOVE_KEYS[direction].some((key) => this.keys.has(key))
    this.ix = (down('right') ? 1 : 0) - (down('left') ? 1 : 0)
    this.iy = (down('down') ? 1 : 0) - (down('up') ? 1 : 0)
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
    if (MOVE_KEY_SET.has(key)) {
      if (key.startsWith('arrow')) event.preventDefault()
      this.keys.add(key)
      this.refreshInput()
    } else if (event.code === 'Space') {
      // Maintenir Espace charge le coup; le relâcher déclenche la poussée.
      event.preventDefault()
      if (!event.repeat) this.startCharge()
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (this.keys.delete(event.key.toLowerCase())) this.refreshInput()
    if (event.code === 'Space') {
      if (!inputBlocked(event.target)) event.preventDefault()
      this.releaseCharge()
    }
  }

  private readonly onBlur = () => {
    this.keys.clear()
    this.refreshInput()
    this.cancelCharge()
  }

  /* ------------------------------------------------------------ Boucle */

  private readonly tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    if (dt > 0) {
      if (this.chargeStartedAt !== undefined) {
        this.renderCharge(
          clamp((now - this.chargeStartedAt) / MAX_CHARGE_MS, 0, 1),
        )
      }
      for (const crew of this.crew.values()) this.step(crew, dt, now)
      this.emitLocalState(now)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private step(crew: Crew, dt: number, now: number) {
    const { arena } = this
    const isAfk = !crew.isLocal && now - crew.lastHeardAt >= AFK_AFTER_MS
    if (crew.isAfk !== isAfk) {
      crew.isAfk = isAfk
      crew.afkEl.hidden = !isAfk
    }

    const previousX = crew.nx
    const previousY = crew.ny
    let px = arena.left + crew.nx * arena.width
    let py = arena.top + crew.ny * arena.height

    if (crew.phase === 'air' || crew.phase === 'slide') {
      // éjection : simulée ici pour tout le monde (prédiction pour les distants)
      ;[px, py] = this.stepEjection(crew, dt, now, px, py)
    } else if (crew.isLocal) {
      ;[px, py] = this.stepLocalWalk(crew, dt, px, py)
    } else if (crew.hasState) {
      ;[px, py] = this.stepRemote(crew, dt, now)
    }

    this.stepBody(crew, dt, now, px, py)
    ;[crew.nx, crew.ny] = this.toNormalized(px, py)
    if (crew.isLocal) {
      const vx = (crew.nx - previousX) / dt
      const vy = (crew.ny - previousY) / dt
      // moyenne courte contre le bruit de frame, mais un arrêt est immédiat
      crew.mvx = vx === 0 ? 0 : crew.mvx + (vx - crew.mvx) * 0.5
      crew.mvy = vy === 0 ? 0 : crew.mvy + (vy - crew.mvy) * 0.5
    }
    this.render(crew, px, py)
  }

  /** Marche du joueur local : vitesse lissée (accélération / freinage courts). */
  private stepLocalWalk(
    crew: Crew,
    dt: number,
    px: number,
    py: number,
  ): [number, number] {
    const ix = crew.fallen ? 0 : this.ix
    const iy = crew.fallen ? 0 : this.iy
    const active = ix !== 0 || iy !== 0
    const norm = Math.hypot(ix, iy) || 1
    const targetX = (ix / norm) * this.speed
    const targetY = (iy / norm) * this.speed * 0.75 // la profondeur est un peu plus lente
    const blend = 1 - Math.exp(-(active ? WALK_ACCEL : WALK_BRAKE) * dt)
    crew.wx += (targetX - crew.wx) * blend
    crew.wy += (targetY - crew.wy) * blend
    if (!active && Math.hypot(crew.wx, crew.wy) < 10) crew.wx = crew.wy = 0
    crew.moving = active
    if (ix) crew.dir = ix < 0 ? -1 : 1

    px += crew.wx * dt
    py += crew.wy * dt
    const { minX, maxX, minY, maxY } = this.bounds()
    px = clamp(px, minX, maxX)
    py = clamp(py, minY, maxY)
    return this.collideTable(px, py)
  }

  /** Joueur distant : on rattrape en douceur sa position extrapolée. */
  private stepRemote(crew: Crew, dt: number, now: number): [number, number] {
    const { arena } = this
    const age = Math.min((now - crew.netAt) / 1000, EXTRAPOLATE_MAX_S)
    const targetX = clamp(crew.netX + crew.netVx * age, 0, 1)
    const targetY = clamp(crew.netY + crew.netVy * age, 0, 1)
    const gap = Math.hypot(
      (targetX - crew.nx) * arena.width,
      (targetY - crew.ny) * arena.height,
    )
    // trop loin (retour d'onglet, téléportation) : on ne traverse pas la salle
    const blend =
      gap > arena.width * 0.5
        ? 1
        : 1 -
          Math.exp(-(crew.fallen ? REMOTE_CHASE_FALLEN : REMOTE_CHASE) * dt)
    const nx = crew.nx + (targetX - crew.nx) * blend
    const ny = crew.ny + (targetY - crew.ny) * blend
    const netSpeed = Math.hypot(
      crew.netVx * arena.width,
      crew.netVy * arena.height,
    )
    crew.moving =
      !crew.fallen && ((netSpeed > 8 && age < EXTRAPOLATE_MAX_S) || gap > 4)
    return [arena.left + nx * arena.width, arena.top + ny * arena.height]
  }

  /** Déplacement au sol pendant l'éjection : ricochets sur les murs et la table. */
  private stepEjection(
    crew: Crew,
    dt: number,
    now: number,
    px: number,
    py: number,
  ): [number, number] {
    const size = this.size
    px += crew.kx * dt
    py += crew.ky * dt
    const drag = Math.exp(-(crew.phase === 'air' ? AIR_DRAG : SLIDE_DRAG) * dt)
    crew.kx *= drag
    crew.ky *= drag

    const { minX, maxX, minY, maxY } = this.bounds()
    let shock = 0
    if (px < minX || px > maxX) {
      px = clamp(px, minX, maxX)
      shock = Math.abs(crew.kx)
      crew.kx *= -WALL_BOUNCE
    }
    if (py < minY || py > maxY) {
      py = clamp(py, minY, maxY)
      shock = Math.max(shock, Math.abs(crew.ky))
      crew.ky *= -WALL_BOUNCE
    }

    const [tx, ty] = this.collideTable(px, py)
    if (tx !== px || ty !== py) {
      // rebond sur la table : on réfléchit la vitesse sur la normale de sortie
      const length = Math.hypot(tx - px, ty - py) || 1
      const normalX = (tx - px) / length
      const normalY = (ty - py) / length
      const into = crew.kx * normalX + crew.ky * normalY
      if (into < 0) {
        crew.kx -= (1 + WALL_BOUNCE) * into * normalX
        crew.ky -= (1 + WALL_BOUNCE) * into * normalY
        shock = Math.max(shock, -into)
      }
      px = tx
      py = ty
    }

    if (shock > size * 2.5) {
      // gros choc : la vrille s'inverse et il repart d'un petit bond
      crew.spin = -crew.spin * 0.8 || (crew.kx < 0 ? -360 : 360)
      crew.vz = Math.max(crew.vz, 0) + size * 3
      crew.phase = 'air'
      crew.squashV -= 4
      crew.el.classList.remove('au-down')
      this.fx('puff', px, py)
      this.bonk(px, py)
    }

    const speed = Math.hypot(crew.kx, crew.ky)
    if (speed > size * 2.5 && crew.z < size * 0.9)
      this.bumpNeighbours(crew, now)
    if (crew.phase === 'slide' && speed < 8) {
      crew.kx = crew.ky = 0
      crew.phase = 'down'
    }
    return [px, py]
  }

  /** Les joueurs debout sur la trajectoire sursautent (purement visuel). */
  private bumpNeighbours(crew: Crew, now: number) {
    const { arena, size } = this
    for (const other of this.crew.values()) {
      if (
        other === crew ||
        other.fallen ||
        other.phase !== 'none' ||
        now - other.bumpedAt < 900
      )
        continue
      const dx = (other.nx - crew.nx) * arena.width
      const dy = (other.ny - crew.ny) * arena.height
      if (Math.abs(dx) > size * 0.6 || Math.abs(dy) > size * 0.45) continue
      other.bumpedAt = now
      other.phase = 'hop'
      other.vz = size * 5.5
      this.say(other.id, pick(BUMPS), 700)
    }
  }

  /** Hauteur, vrille et écrasement du corps (tout sauf la position au sol). */
  private stepBody(
    crew: Crew,
    dt: number,
    now: number,
    px: number,
    py: number,
  ) {
    const size = this.size
    switch (crew.phase) {
      case 'air': {
        crew.vz -= GRAVITY * size * dt
        crew.z += crew.vz * dt
        crew.angle += crew.spin * dt
        if (crew.z > 0) break
        crew.z = 0
        const impact = -crew.vz
        this.fx('puff', px, py)
        crew.squashV -= clamp((impact / size) * 0.9, 2, 7)
        if (impact > size * 3 && crew.bounces < MAX_BOUNCES) {
          if (crew.bounces === 0) this.bonk(px, py)
          crew.bounces++
          crew.vz = impact * BOUNCE
          crew.kx *= 0.7
          crew.ky *= 0.7
          crew.spin *= 0.75
        } else {
          // fin des rebonds : il glisse couché, sur le dos ou sur le ventre
          crew.vz = 0
          crew.spin = 0
          crew.phase = 'slide'
          crew.restAngle = Math.round((crew.angle - 90) / 180) * 180 + 90
          crew.el.classList.add('au-down')
        }
        break
      }
      case 'slide':
      case 'down':
        crew.angle += (crew.restAngle - crew.angle) * (1 - Math.exp(-14 * dt))
        break
      case 'getup': {
        const t = clamp((now - crew.phaseAt) / GETUP_MS, 0, 1)
        const upright = Math.round(crew.restAngle / 360) * 360
        // easeOutBack : il dépasse un peu la verticale avant de se stabiliser
        const u = t - 1
        const eased = 1 + 2.7 * u * u * u + 1.7 * u * u
        crew.angle = crew.restAngle + (upright - crew.restAngle) * eased
        crew.z = Math.sin(Math.PI * t) * size * 0.4
        if (t >= 1) {
          crew.phase = 'none'
          crew.angle = 0
          crew.z = 0
          crew.vz = 0
          crew.squashV -= 2.5
        }
        break
      }
      case 'hop':
        crew.vz -= GRAVITY * size * dt
        crew.z += crew.vz * dt
        if (crew.z <= 0) {
          crew.z = 0
          crew.vz = 0
          crew.phase = 'none'
          crew.squashV -= 3
        }
        break
      case 'none':
        break
    }

    // écrasement / étirement : ressort amorti, relancé par chaque choc
    if (crew.squash !== 0 || crew.squashV !== 0) {
      crew.squashV += (-380 * crew.squash - 16 * crew.squashV) * dt
      crew.squash = clamp(crew.squash + crew.squashV * dt, -0.45, 0.45)
      if (Math.abs(crew.squash) < 0.004 && Math.abs(crew.squashV) < 0.05)
        crew.squash = crew.squashV = 0
    }
  }

  /**
   * On n'émet que si ce que les autres extrapolent (dernier état envoyé +
   * vitesse) s'écarte de la réalité : marche en ligne droite = presque aucun
   * message, changement de direction ou arrêt = envoi immédiat.
   */
  private emitLocalState(now: number) {
    const me = this.local()
    const emit = this.opts.onLocalState
    if (!me || !emit) return
    const since = now - this.lastEmit
    const sent = this.sent
    if (sent && since < MIN_EMIT_GAP_MS) return

    const { arena } = this
    const moving = Math.hypot(me.mvx * arena.width, me.mvy * arena.height) > 6
    if (sent) {
      const age = Math.min(since / 1000, EXTRAPOLATE_MAX_S)
      const error = Math.hypot(
        (me.nx - clamp(sent.x + sent.vx * age, 0, 1)) * arena.width,
        (me.ny - clamp(sent.y + sent.vy * age, 0, 1)) * arena.height,
      )
      const wasMoving = sent.vx !== 0 || sent.vy !== 0
      const needed =
        error > EMIT_ERROR_PX ||
        me.dir !== sent.dir ||
        moving !== wasMoving ||
        (moving && since >= KEEPALIVE_MOVING_MS) ||
        since >= HEARTBEAT_MS
      if (!needed) return
    }

    const state: LocalState = {
      x: Math.round(me.nx * 10_000) / 10_000,
      y: Math.round(me.ny * 10_000) / 10_000,
      dir: me.dir,
      vx: moving ? Math.round(me.mvx * 1_000) / 1_000 : 0,
      vy: moving ? Math.round(me.mvy * 1_000) / 1_000 : 0,
    }
    this.sent = state
    this.lastEmit = now
    me.lastHeardAt = now
    emit(state)
  }

  private render(crew: Crew, px: number, py: number) {
    const s = this.size
    const position = `translate3d(${(px - s / 2).toFixed(1)}px,${(py - s * 1.2).toFixed(1)}px,0)`
    if (position !== crew.renderedPos) {
      crew.el.style.transform = position
      crew.renderedPos = position
    }
    const depth = Math.round(py)
    if (depth !== crew.renderedZ) {
      crew.el.style.zIndex = String(depth)
      crew.renderedZ = depth
    }
    if (crew.renderedDir !== crew.dir) {
      crew.el.style.setProperty('--dir', String(crew.dir))
      crew.renderedDir = crew.dir
    }
    const walking = crew.moving && !crew.fallen
    if (crew.renderedWalk !== walking) {
      crew.el.classList.toggle('au-walking', walking)
      crew.renderedWalk = walking
    }
    this.renderBody(crew)
  }

  /** Hauteur, vrille et écrasement : styles posés seulement quand le corps bouge. */
  private renderBody(crew: Crew) {
    const s = this.size
    let body = ''
    let shadow = ''
    if (crew.phase !== 'none' || crew.squash !== 0 || crew.z > 0) {
      const airborne = crew.phase === 'air' || crew.phase === 'hop'
      const stretch = airborne
        ? clamp(Math.abs(crew.vz) / (s * 16), 0, 0.16)
        : 0
      const scaleY = 1 + crew.squash + stretch
      const scaleX = 1 - (scaleY - 1) * 0.7
      // le pivot est au centre du corps : on recale pour que l'écrasement parte du sol
      const lift = -crew.z + (1 - scaleY) * 0.5 * s
      // .au-flip retourne le sprite : on compense pour garder le sens de la vrille
      const angle = crew.angle * crew.dir
      body = `translate3d(0,${lift.toFixed(1)}px,0) scale(${scaleX.toFixed(3)},${scaleY.toFixed(3)}) rotate(${angle.toFixed(1)}deg)`
      const lying = Math.abs(Math.sin((crew.angle * Math.PI) / 180))
      shadow = `scale(${((1 + 0.8 * lying) / (1 + crew.z / (s * 1.3))).toFixed(3)})`
    }
    if (body !== crew.renderedBody) {
      crew.spriteEl.style.transform = body
      crew.renderedBody = body
    }
    if (shadow !== crew.renderedShadow) {
      crew.shadowEl.style.transform = shadow
      crew.renderedShadow = shadow
    }
  }
}
