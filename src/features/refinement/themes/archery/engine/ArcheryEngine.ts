import {
  FIXED_STEP,
  HAND_B,
  HEAD,
  HIP,
  NECK,
  attachArrow,
  createStick,
  drawArrow,
  drawStick,
  grounded,
  hitTest,
  jump,
  respawn,
  startRagdoll,
  stepBand,
  stepRagdoll,
  updateStick,
  type Attach,
  type Stick,
} from './stick'
import {
  ARROW_LOOKS,
  RAINBOW,
  asSkin,
  drawDragons,
  type ArrowSkin,
} from './skins'
import {
  ARROW_GRAVITY,
  ARROW_MAX_SPEED,
  ARROW_MIN_SPEED,
  PLATFORM_H,
  PLATFORM_W,
  WORLD_H,
  WORLD_W,
  assignSeats,
  clamp,
  lerp,
  pick,
} from './world'

/**
 * Moteur du thème « Tir à l'arc » : des bonshommes bâton sur des
 * plateformes qui se tirent dessus à l'arc. Impératif, sans React : un seul
 * canvas redessiné par requestAnimationFrame (au ralenti quand rien ne bouge),
 * et quelques étiquettes DOM statiques (nom, vote, carquois).
 *
 * Réseau : presque rien n'est envoyé en continu. Un saut, un accroupissement ou
 * un tir = un message, et pendant la visée la direction de l'arc part au plus
 * ~3 fois par seconde (les autres voient le tir venir) ; chaque client rejoue ensuite la même simulation dans le même
 * monde logique (voir world.ts).
 *
 * Deux équipes : le côté gauche contre le côté droit. Une flèche traverse les
 * coéquipiers du tireur et leurs plateformes, elle ne peut toucher (ou se
 * planter dans) que le camp d'en face.
 *
 * Qui décide d'un impact ? La cible : elle seule voit son esquive sans décalage
 * réseau. Chez les autres, une flèche qui semble toucher reste « en suspens »
 * jusqu'à la confirmation ; sans confirmation, c'était une esquive.
 */

export type Rect = { left: number; top: number; width: number; height: number }
export type ArcherCard = {
  voted: boolean
  revealed: boolean
  value: string | null
  designId?: string | null
}
export type ArcherDef = {
  id: string
  name: string
  isSpectator?: boolean
  card?: ArcherCard
}
export type PoseUpdate = {
  crouch: boolean
  jump: boolean
  parry: boolean
  away: boolean
  aiming: boolean
  aim: number
}
export type ShotRequest = {
  clientId: string
  x: number
  y: number
  vx: number
  vy: number
}
export type RemotePlayer = {
  userId: string
  crouch: boolean
  aiming?: boolean
  aim?: number
  jumpAt?: number
  parryAt?: number
  skin?: string
  away: boolean
  arrowsLeft: number
  health: number
}
export type RemoteShot = ShotRequest & {
  id: string
  shooterId: string
  skin?: string
  hitUserId?: string
  headshot?: boolean
  kill?: boolean
  rewarded?: boolean
}
export type RemoteState = {
  enabled: boolean
  roundKey: string
  players: readonly RemotePlayer[]
  shots: readonly RemoteShot[]
}

export type EngineOptions = {
  /** Zone de jeu en pixels viewport (entre la barre du haut et la main de cartes). */
  getArena: () => Rect
  onPose: (pose: PoseUpdate) => void
  /** Résout à false si le serveur refuse le tir (carquois vide, tirs désactivés). */
  onShoot: (shot: ShotRequest) => Promise<boolean>
  onHit: (shotId: string, targetId: string, headshot: boolean) => void
}

type Archer = {
  stick: Stick
  labelEl: HTMLElement
  nameEl: HTMLElement
  cardEl: HTMLElement
  pipEls: HTMLElement[]
  hpEl: HTMLElement
  away: boolean
  arrowsLeft: number
  /** Points de vie de la manche (serveur) ; `out` = éliminé, remplacé par une tombe. */
  health: number
  out: boolean
  /** A voté (ou est spectateur) : condition pour tirer. */
  canShoot: boolean
  jumpAt: number | undefined
  parryAt: number | undefined
  synced: boolean
  renderedPips: number
  renderedHealth: number
  renderedLabel: string
}

type Arrow = {
  key: string
  serverId: string | null
  shooterId: string
  /** Camp du tireur (1 = gauche, -1 = droite, 0 = inconnu) : la flèche traverse ce camp. */
  team: number
  color: string
  skin: ArrowSkin | null
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  /** fly : en vol · stuck : plantée dans le décor · held : en suspens sur un joueur · drop : retombe. */
  state: 'fly' | 'stuck' | 'held' | 'drop'
  /** Secondes écoulées dans l'état courant. */
  age: number
  heldId: string | null
  attach: Attach | null
  headshot: boolean
  spin: number
  trail: Float32Array
  trailLength: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  gravity: number
}

type FloatingText = {
  x: number
  y: number
  text: string
  color: string
  size: number
  life: number
  max: number
}

const ARROWS_PER_ROUND = 2
const HEALTH = 2
// Poussée du ragdoll (flèche fatale), en fraction de la vitesse de la flèche (+ un minimum latéral)
const KILL_IMPULSE = 0.34
const KNOCK_MIN_SPEED = 340
const STUN_S = 2.6
const HELD_TIMEOUT_S = 1.4
const STUCK_TTL_S = 7
const DROP_TTL_S = 1.2
const TRAIL_POINTS = 10
const MAX_PARTICLES = 420
// Parade (Espace) : fenêtre pendant laquelle une flèche est déviée, puis recharge
const PARRY_WINDOW_S = 0.3
const PARRY_COOLDOWN_MS = 3_000
const IDLE_FRAME_MS = 50

// Visée : pixels écran entre le clic et le pointeur
const PULL_MIN = 16
const PULL_RANGE = 170
// Tremblement de l'arc (radians) : plus on charge et plus on attend, plus ça bouge
const SWAY_BASE = 0.02
const SWAY_POWER = 0.075
// Direction de visée envoyée aux autres : au plus toutes les 300 ms, si elle a bougé
const AIM_SEND_MS = 300
const AIM_SEND_DELTA = 0.2
// Arc bandé d'un joueur distant : on ne connaît pas sa charge, on montre une tension moyenne
const REMOTE_DRAW = 0.7

const JUMP_KEYS = new Set(['z', 'w', 'arrowup'])
const CROUCH_KEYS = new Set(['s', 'arrowdown'])
const UI_SELECTOR =
  'button, a, input, textarea, select, label, summary, details, [role="button"], [role="dialog"], dialog, .pp-topbar, .pp-hand-area'

const OUCH = [
  'Aïe !',
  'Outch !',
  'Mon égo est brisé…',
  'Même pas mal...',
  "C'est injuste !",
  'Mayday !',
]

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

export class ArcheryEngine {
  private readonly host: HTMLElement
  private readonly opts: EngineOptions
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hintEl: HTMLElement
  private readonly archers = new Map<string, Archer>()
  private readonly arrows: Arrow[] = []
  private readonly particles: Particle[] = []
  private readonly texts: FloatingText[] = []
  /** Flèches connues du serveur : id -> impact déjà traité. */
  private shots = new Map<string, boolean>()
  private shotsReady = false
  /** Impacts déjà joués localement (cible locale ou prédiction du tireur). */
  private readonly handled = new Set<string>()
  /** Tirs locaux pas encore vus par le serveur : ils comptent déjà dans le carquois. */
  private readonly unacked = new Set<string>()
  /** Impacts arbitrés par le tireur avant de connaître l'id serveur de sa flèche. */
  private readonly pendingReports = new Map<
    string,
    { targetId: string; headshot: boolean }
  >()
  private lastState: RemoteState | undefined
  private localId: string | null = null
  private enabled = true
  private roundKey: string | undefined

  private platforms = new Float32Array(0)
  /** Camp du propriétaire de chaque plateforme, dans le même ordre que `platforms`. */
  private platformTeams = new Int8Array(0)
  private scale = 1
  private offsetX = 0
  private offsetY = 0
  private dpr = 1
  private layoutKey = ''

  private aim:
    | {
        startX: number
        startY: number
        x: number
        y: number
        id: number
        startedAt: number
        sentAt: number
        sentAngle: number
      }
    | undefined
  private crouchHeld = false
  private shake = 0
  private raf = 0
  private lastFrame = 0
  private lastRender = 0
  private fixedTime = 0
  private geometryTimer = 0

  constructor(host: HTMLElement, options: EngineOptions) {
    this.host = host
    this.opts = options
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'ar-canvas'
    this.ctx = this.canvas.getContext('2d')!
    this.hintEl = document.createElement('div')
    this.hintEl.className = 'ar-hint'
    this.hintEl.innerHTML =
      '<span class="ar-hint-on"><b>Clique-glisse</b> viser et tirer<i></i>' +
      '<kbd>Z</kbd> sauter<i></i><kbd>S</kbd> s’accroupir<i></i>' +
      '<kbd>Espace</kbd> parer</span>' +
      '<span class="ar-hint-off">Tirs désactivés dans cette salle</span>' +
      '<span class="ar-hint-vote">Vote pour pouvoir tirer</span>' +
      '<span class="ar-hint-dead">Éliminé · retour à la prochaine manche</span>'
    host.append(this.canvas, this.hintEl)

    this.layout()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('resize', this.layout)
    window.addEventListener('scroll', this.layout, { passive: true })
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.cancelAim)
    window.addEventListener('contextmenu', this.cancelAim)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.geometryTimer = window.setInterval(this.layout, 500)

    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  /* ------------------------------------------------------------ API */

  setLocalId(id: string | null) {
    if (this.localId === id) return
    this.localId = id
    this.cancelAim()
    for (const archer of this.archers.values()) this.applyLocalFlag(archer)
    // crée la ligne du joueur côté serveur : les autres savent qu'il est là
    if (id !== null) this.sendPose(false)
  }

  /** Synchronise la liste des joueurs (ajoute, met à jour, retire). */
  setPlayers(defs: readonly ArcherDef[]) {
    const ids = new Set(defs.map((def) => def.id))
    for (const [id, archer] of this.archers) {
      if (ids.has(id)) continue
      archer.labelEl.remove()
      this.archers.delete(id)
    }
    const seats = assignSeats(defs.map((def) => def.id))
    for (const def of defs) {
      const seat = seats.get(def.id)!
      let archer = this.archers.get(def.id)
      if (!archer) {
        archer = this.addArcher(
          def.id,
          seat.slot.x,
          seat.slot.y,
          seat.slot.facing,
          seat.color,
        )
      }
      const stick = archer.stick
      stick.tx = seat.slot.x
      stick.ty = seat.slot.y
      stick.color = seat.color
      if (stick.baseFacing !== seat.slot.facing) {
        stick.baseFacing = seat.slot.facing
        if (!stick.aiming) stick.facing = seat.slot.facing
      }
      archer.labelEl.style.setProperty('--c', seat.color)
      archer.labelEl.classList.toggle('ar-spectator', Boolean(def.isSpectator))
      archer.nameEl.textContent = def.name
      archer.canShoot = Boolean(def.isSpectator) || Boolean(def.card?.voted)
      this.renderCard(archer, def.card)
    }
    this.platforms = new Float32Array(this.archers.size * 4)
    this.platformTeams = new Int8Array(this.archers.size)
    this.layoutKey = ''
    this.layout()
    if (this.lastState) this.applyPlayers(this.lastState)
    this.syncCanAim()
  }

  /** Postures, carquois et flèches venus du serveur. */
  applyState(state: RemoteState) {
    this.lastState = state
    this.enabled = state.enabled
    if (!state.enabled) this.cancelAim()
    if (this.roundKey !== undefined && this.roundKey !== state.roundKey) {
      // nouvelle manche : carquois pleins, on retire les flèches plantées
      for (const archer of this.archers.values()) archer.stick.stuck.length = 0
      const me = this.local()
      if (me) this.say(me.stick, 'Carquois rempli !', '#ffe08a', 26)
    }
    this.roundKey = state.roundKey

    // les flèches d'abord : un joueur éliminé tombe avant de devenir une tombe
    const first = !this.shotsReady
    const next = new Map<string, boolean>()
    // du plus ancien au plus récent ; le premier instantané sert de référence
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const shot = state.shots[i]!
      const known = this.shots.get(shot.id)
      if (known === undefined && !first) this.onNewShot(shot)
      if (shot.hitUserId && !known && !first) this.onShotHit(shot)
      next.set(shot.id, Boolean(shot.hitUserId))
    }
    this.shots = next
    this.shotsReady = true
    this.applyPlayers(state)
    this.syncCanAim()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.clearInterval(this.geometryTimer)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.layout)
    window.removeEventListener('scroll', this.layout)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.cancelAim)
    window.removeEventListener('contextmenu', this.cancelAim)
    document.removeEventListener('visibilitychange', this.onVisibility)
    document.documentElement.classList.remove('ar-can-aim', 'ar-aiming')
    for (const archer of this.archers.values()) archer.labelEl.remove()
    this.archers.clear()
    this.canvas.remove()
    this.hintEl.remove()
  }

  /* ------------------------------------------------------------ Joueurs */

  private local(): Archer | undefined {
    return this.localId === null ? undefined : this.archers.get(this.localId)
  }

  private addArcher(
    id: string,
    x: number,
    y: number,
    facing: 1 | -1,
    color: string,
  ): Archer {
    const labelEl = document.createElement('div')
    labelEl.className = 'ar-label'
    // .au-card : on réutilise les dos de carte (et designs) du thème Among Us
    labelEl.innerHTML =
      '<span class="ar-hp"></span><span class="ar-name"></span>' +
      '<span class="ar-pips"><i></i><i></i></span>' +
      '<span class="ar-parry" title="Parade">🛡</span>' +
      '<span class="au-card ar-card" hidden></span>'
    this.host.append(labelEl)
    const archer: Archer = {
      stick: createStick(id, x, y, facing, color),
      labelEl,
      nameEl: labelEl.querySelector<HTMLElement>('.ar-name')!,
      cardEl: labelEl.querySelector<HTMLElement>('.ar-card')!,
      pipEls: [...labelEl.querySelectorAll<HTMLElement>('.ar-pips i')],
      hpEl: labelEl.querySelector<HTMLElement>('.ar-hp')!,
      away: false,
      arrowsLeft: ARROWS_PER_ROUND,
      health: HEALTH,
      out: false,
      canShoot: false,
      jumpAt: undefined,
      parryAt: undefined,
      synced: false,
      renderedPips: -1,
      renderedHealth: -1,
      renderedLabel: '',
    }
    // arrivée : il tombe du ciel sur sa plateforme
    archer.stick.jy = 300
    archer.stick.jv = -1
    this.applyLocalFlag(archer)
    this.archers.set(id, archer)
    return archer
  }

  private applyLocalFlag(archer: Archer) {
    archer.stick.isLocal = archer.stick.id === this.localId
    archer.labelEl.classList.toggle('ar-me', archer.stick.isLocal)
    if (archer.stick.isLocal) archer.stick.crouching = this.crouchHeld
  }

  private applyPlayers(state: RemoteState) {
    for (const player of state.players) {
      const archer = this.archers.get(player.userId)
      if (!archer) continue
      const stick = archer.stick
      archer.arrowsLeft = player.arrowsLeft
      if (archer.away !== player.away) {
        archer.away = player.away
        archer.labelEl.classList.toggle('ar-away', player.away)
      }
      if (!stick.isLocal) {
        stick.crouching = player.crouch
        // arc bandé : on voit qui vise, et dans quelle direction
        stick.aiming = player.aiming === true && stick.down <= 0
        if (stick.aiming) {
          stick.aim = player.aim ?? stick.aim
          stick.facing = Math.cos(stick.aim) < 0 ? -1 : 1
          stick.draw = REMOTE_DRAW
        }
        if (
          archer.synced &&
          player.jumpAt !== undefined &&
          player.jumpAt !== archer.jumpAt
        )
          jump(stick)
      }
      if (
        !stick.isLocal &&
        archer.synced &&
        player.parryAt !== undefined &&
        player.parryAt !== archer.parryAt
      )
        // un peu plus long que chez lui : couvre le décalage réseau à l'écran
      {
        this.startParry(stick, PARRY_WINDOW_S + 0.15)
        // une flèche « en suspens » sur lui était en fait parée
        for (const arrow of this.arrows)
          if (arrow.state === 'held' && arrow.heldId === stick.id)
            this.deflect(arrow, stick)
      }
      archer.parryAt = player.parryAt
      stick.skin = asSkin(player.skin)
      archer.jumpAt = player.jumpAt
      archer.synced = true
      archer.health = player.health
      if (player.health <= 0) {
        // déjà éliminé à notre arrivée (ou chute terminée) : directement la tombe
        if (!archer.out && stick.down <= 0) this.eliminate(archer)
      } else if (archer.out) {
        // nouvelle manche : il retombe du ciel
        archer.out = false
        archer.labelEl.classList.remove('ar-dead')
        respawn(stick)
      }
    }
    for (const archer of this.archers.values()) {
      this.renderPips(archer)
      this.renderHealth(archer)
    }
  }

  /** Éliminé jusqu'à la prochaine manche : une tombe sur la plateforme. */
  private eliminate(archer: Archer) {
    const stick = archer.stick
    archer.out = true
    stick.rag = null
    stick.aiming = false
    stick.down = Number.MAX_VALUE
    archer.labelEl.classList.add('ar-dead')
    if (stick.isLocal) this.cancelAim()
  }

  private renderHealth(archer: Archer) {
    if (archer.health === archer.renderedHealth) return
    archer.renderedHealth = archer.health
    archer.hpEl.textContent =
      archer.health <= 0
        ? '☠'
        : '♥'.repeat(archer.health) + '♡'.repeat(HEALTH - archer.health)
  }

  private arrowsLeft(archer: Archer) {
    return archer.stick.isLocal
      ? Math.max(0, archer.arrowsLeft - this.unacked.size)
      : archer.arrowsLeft
  }

  private renderPips(archer: Archer) {
    const left = this.arrowsLeft(archer)
    if (left === archer.renderedPips) return
    archer.renderedPips = left
    archer.pipEls.forEach((pip, index) =>
      pip.classList.toggle('ar-pip--spent', index >= left),
    )
  }

  private renderCard(archer: Archer, card: ArcherCard | undefined) {
    const el = archer.cardEl
    const visible = Boolean(card?.voted)
    el.hidden = !visible
    el.replaceChildren()
    if (!card || !visible) {
      delete el.dataset.cardDesign
      el.classList.remove('au-card--face')
      return
    }
    if (card.designId) el.dataset.cardDesign = card.designId
    else delete el.dataset.cardDesign
    el.classList.toggle('au-card--face', card.revealed)
    if (card.revealed && card.value !== null) {
      const value = document.createElement('span')
      value.className = 'au-card-value'
      value.textContent = card.value
      el.append(value)
    }
  }

  /* ------------------------------------------------------------ Tirs */

  private canAim(me: Archer | undefined): me is Archer {
    return (
      me !== undefined &&
      this.enabled &&
      me.canShoot &&
      me.stick.down <= 0 &&
      this.arrowsLeft(me) > 0
    )
  }

  /** Curseur « viseur » quand le joueur local peut tirer, et aide adaptée à sa situation. */
  private syncCanAim() {
    const me = this.local()
    document.documentElement.classList.toggle('ar-can-aim', this.canAim(me))
    this.hintEl.dataset.state = !this.enabled
      ? 'off'
      : me?.out
        ? 'dead'
        : me && !me.canShoot
          ? 'vote'
          : 'on'
  }

  private spawnArrow(
    key: string,
    serverId: string | null,
    shooterId: string,
    shot: ShotRequest,
    skin: ArrowSkin | null,
  ): Arrow {
    const arrow: Arrow = {
      key,
      serverId,
      shooterId,
      team: this.archers.get(shooterId)?.stick.baseFacing ?? 0,
      color: this.archers.get(shooterId)?.stick.color ?? '#5b4636',
      skin,
      x: shot.x,
      y: shot.y,
      vx: shot.vx,
      vy: shot.vy,
      angle: Math.atan2(shot.vy, shot.vx),
      state: 'fly',
      age: 0,
      heldId: null,
      attach: null,
      headshot: false,
      spin: 0,
      trail: new Float32Array(TRAIL_POINTS * 2),
      trailLength: 0,
    }
    this.arrows.push(arrow)
    return arrow
  }

  private removeArrow(arrow: Arrow) {
    const index = this.arrows.indexOf(arrow)
    if (index >= 0) this.arrows.splice(index, 1)
  }

  /** Le joueur local relâche la corde. */
  private shoot(power: number) {
    const me = this.local()
    if (!this.canAim(me)) return
    const stick = me.stick
    const speed = lerp(ARROW_MIN_SPEED, ARROW_MAX_SPEED, power)
    const dx = Math.cos(stick.aim)
    const dy = Math.sin(stick.aim)
    const shot: ShotRequest = {
      clientId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
      x: Math.round(stick.pts[HAND_B * 2]! + dx * 20),
      y: Math.round(stick.pts[HAND_B * 2 + 1]! + dy * 20),
      vx: Math.round(dx * speed),
      vy: Math.round(dy * speed),
    }
    // la flèche part tout de suite ; le serveur confirme (ou refuse) ensuite
    const arrow = this.spawnArrow(shot.clientId, null, stick.id, shot, stick.skin)
    this.unacked.add(shot.clientId)
    stick.readyHold = 0.5
    stick.flinch = 0.18 + power * 0.2 // recul
    if (stick.skin) this.skinBurst(shot.x, shot.y, stick.skin, 16, 300)
    else this.burst(shot.x, shot.y, stick.color, 5, 160)
    if (stick.skin === 'dragon') this.dragonCry(stick)
    this.renderPips(me)
    this.syncCanAim()

    const settle = (accepted: boolean) => {
      this.unacked.delete(shot.clientId)
      if (!accepted) {
        this.burst(arrow.x, arrow.y, '#8d9db3', 8, 120)
        this.removeArrow(arrow)
      }
      const archer = this.local()
      if (archer) this.renderPips(archer)
      this.syncCanAim()
    }
    this.opts.onShoot(shot).then(settle, () => settle(false))
  }

  /** Une flèche tirée par quelqu'un apparaît dans l'état serveur. */
  private onNewShot(shot: RemoteShot) {
    if (shot.shooterId === this.localId) {
      const arrow = this.arrows.find(
        (candidate) => candidate.key === shot.clientId,
      )
      if (arrow) {
        arrow.serverId = shot.id
        arrow.skin = asSkin(shot.skin) // le serveur fait foi sur la flèche équipée
      }
      const report = this.pendingReports.get(shot.clientId)
      if (report) {
        this.pendingReports.delete(shot.clientId)
        this.handled.add(shot.id)
        this.opts.onHit(shot.id, report.targetId, report.headshot)
      }
      if (arrow || report) return
      // tiré depuis un autre onglet du même joueur : on la joue comme les autres
    }
    const skin = asSkin(shot.skin)
    this.spawnArrow(shot.clientId, shot.id, shot.shooterId, shot, skin)
    if (skin) this.skinBurst(shot.x, shot.y, skin, 16, 300)
    const archer = this.archers.get(shot.shooterId)
    if (skin === 'dragon' && archer) this.dragonCry(archer.stick)
    const shooter = this.archers.get(shot.shooterId)?.stick
    if (shooter && shooter.down <= 0) {
      // geste de tir : l'arc se lève (s'il ne l'était pas déjà) et la corde claque
      shooter.aiming = false
      shooter.aim = Math.atan2(shot.vy, shot.vx)
      shooter.facing = shot.vx < 0 ? -1 : 1
      shooter.ready = 1
      shooter.draw = 0.7
      shooter.readyHold = 0.5
      shooter.flinch = 0.25
    }
  }

  /** Le serveur confirme un impact : la cible tombe chez tout le monde. */
  private onShotHit(shot: RemoteShot) {
    const victim = this.archers.get(shot.hitUserId ?? '')
    const shooter = this.archers.get(shot.shooterId)
    const arrow = this.arrows.find(
      (candidate) => candidate.serverId === shot.id,
    )
    if (!this.handled.has(shot.id) && victim) {
      const stick = victim.stick
      const p = stick.pts
      if (arrow && arrow.state === 'held' && arrow.heldId === stick.id) {
        this.knock(
          victim,
          arrow,
          arrow.x,
          arrow.y,
          Boolean(shot.headshot),
          false,
          Boolean(shot.kill),
        )
      } else {
        // notre flèche locale a raté (ou n'existe plus) : on la replante sur la cible
        if (arrow?.attach && arrow.heldId)
          this.detach(arrow.heldId, arrow.attach)
        const source = arrow ?? {
          vx: shot.vx,
          vy: shot.vy,
          angle: Math.atan2(shot.vy, shot.vx),
          color: shooter?.stick.color ?? '#5b4636',
          skin: asSkin(shot.skin),
        }
        const point = shot.headshot ? HEAD : NECK
        this.knock(
          victim,
          source,
          p[point * 2]!,
          p[point * 2 + 1]! + (shot.headshot ? 0 : 22),
          Boolean(shot.headshot),
          true,
          Boolean(shot.kill),
        )
      }
    }
    if (arrow) this.removeArrow(arrow)
    this.handled.delete(shot.id)

    if (shooter && shot.rewarded)
      this.say(shooter.stick, '+2 🪙', '#ffd76a', 30)
  }

  private detach(stickId: string, attach: Attach) {
    const stuck = this.archers.get(stickId)?.stick.stuck
    const index = stuck ? stuck.indexOf(attach) : -1
    if (stuck && index >= 0) stuck.splice(index, 1)
  }

  /** La flèche touche un joueur sur cet écran : qui a le droit de trancher ? */
  private onArrowTouch(arrow: Arrow, archer: Archer, headshot: boolean) {
    const stick = archer.stick
    if (stick.parry > 0) {
      this.deflect(arrow, stick)
      return
    }
    if (stick.isLocal) {
      // c'est moi la cible : mon écran fait foi
      this.knock(archer, arrow, arrow.x, arrow.y, headshot, true)
      if (arrow.serverId) {
        this.handled.add(arrow.serverId)
        this.opts.onHit(arrow.serverId, stick.id, headshot)
      }
      this.removeArrow(arrow)
      return
    }
    if (archer.away && arrow.shooterId === this.localId) {
      // cible absente (onglet masqué) : le tireur arbitre
      this.knock(archer, arrow, arrow.x, arrow.y, headshot, true)
      if (arrow.serverId) {
        this.handled.add(arrow.serverId)
        this.opts.onHit(arrow.serverId, stick.id, headshot)
      } else {
        this.pendingReports.set(arrow.key, { targetId: stick.id, headshot })
      }
      this.removeArrow(arrow)
      return
    }
    // en suspens : plantée à l'écran, en attendant le verdict de la cible
    arrow.state = 'held'
    arrow.age = 0
    arrow.heldId = stick.id
    arrow.headshot = headshot
    arrow.attach = attachArrow(
      stick,
      arrow.x,
      arrow.y,
      arrow.angle,
      arrow.color,
      arrow.skin,
    )
    stick.flinch = 0.6
    this.burst(arrow.x, arrow.y, '#25324a', 5, 150)
  }

  /** Un joueur est touché : il encaisse (première flèche au corps) ou part en ragdoll (flèche fatale). */
  private knock(
    archer: Archer,
    source: {
      vx: number
      vy: number
      angle: number
      color: string
      skin: ArrowSkin | null
    },
    x: number,
    y: number,
    headshot: boolean,
    plant: boolean,
    /** Verdict du serveur quand on le connaît ; sinon on le devine (tête, ou dernier cœur). */
    lethal = headshot || archer.health <= 1,
  ) {
    const stick = archer.stick
    if (stick.down > 0) return
    if (plant)
      attachArrow(stick, x, y, source.angle, source.color, source.skin)
    if (source.skin) this.skinBurst(x, y, source.skin, 30, 460)

    if (!lethal) {
      // première flèche au corps : il encaisse, perd un cœur et garde la flèche plantée
      archer.health = Math.max(1, archer.health - 1)
      this.renderHealth(archer)
      stick.flinch = 1
      this.shake = Math.max(this.shake, stick.isLocal ? 8 : 3)
      this.burst(x, y, stick.color, 10, 300)
      this.say(stick, pick(OUCH), '#f4f7ff', 24)
      return
    }

    // flèche spéciale : le corps en garde la trace pendant sa chute
    if (source.skin) this.statusFx.set(stick.id, source.skin)
    // toujours de quoi quitter la plateforme, dans le sens de la flèche
    let pushX = source.vx * KILL_IMPULSE
    if (Math.abs(pushX) < KNOCK_MIN_SPEED)
      pushX = (source.vx < 0 ? -1 : 1) * KNOCK_MIN_SPEED
    startRagdoll(stick, pushX, source.vy * KILL_IMPULSE, x, y)
    stick.down = STUN_S
    if (stick.isLocal) {
      this.cancelAim()
      this.shake = 14
    } else this.shake = Math.max(this.shake, 4)
    this.burst(x, y, stick.color, 14, 380)
    this.burst(x, y, '#25324a', 8, 260)
    this.say(stick, headshot ? 'HEADSHOT !' : 'K.O. !', '#ffd76a', 34)
    this.syncCanAim()
  }

  /* ------------------------------------------------------------ Effets */

  private burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
  ) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2
      const velocity = speed * (0.35 + Math.random() * 0.65)
      const life = 0.35 + Math.random() * 0.35
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - speed * 0.3,
        life,
        max: life,
        size: 3 + Math.random() * 4,
        color,
        gravity: 900,
      })
    }
  }

  /** Gerbe d'une flèche cosmétique : braises qui montent, givre, confettis. */
  private skinBurst(
    x: number,
    y: number,
    skin: ArrowSkin,
    count: number,
    speed: number,
  ) {
    const look = ARROW_LOOKS[skin]
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2
      const velocity = speed * (0.2 + Math.random() * 0.8)
      const life = 0.45 + Math.random() * 0.5
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - speed * 0.2,
        life,
        max: life,
        size: 3 + Math.random() * 5,
        color: pick(look.sparks),
        gravity: look.gravity,
      })
    }
  }

  /** Flèche du dragon : le tireur lance son cri. */
  private dragonCry(stick: Stick) {
    this.say(stick, 'RYŪ GA WAGA TEKI WO KURAU !', '#9fe8ff', 22, -14)
    this.shake = Math.max(this.shake, 5)
  }

  /** Flèche parée : elle est renvoyée en vrille, personne n'est touché. */
  private deflect(arrow: Arrow, stick: Stick) {
    if (arrow.attach && arrow.heldId) this.detach(arrow.heldId, arrow.attach)
    arrow.attach = null
    arrow.heldId = null
    arrow.state = 'drop'
    arrow.age = 0
    arrow.vx *= -0.3
    arrow.vy = -320 - Math.random() * 120
    arrow.spin = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10)
    stick.flinch = 0.3
    this.burst(arrow.x, arrow.y, '#ffd76a', 12, 420)
    this.burst(arrow.x, arrow.y, stick.color, 8, 300)
    this.say(stick, 'PARÉ !', '#ffd76a', 30)
    this.shake = Math.max(this.shake, stick.isLocal ? 7 : 3)
  }

  /** Parade : l'arc se lève en bouclier pendant un court instant. */
  private startParry(stick: Stick, duration: number) {
    stick.parry = duration
    if (!stick.aiming) {
      stick.aim = stick.facing > 0 ? -0.5 : Math.PI + 0.5
      stick.readyHold = duration + 0.1
    }
  }

  private parry() {
    const me = this.local()
    const now = performance.now()
    if (
      !me ||
      me.stick.down > 0 ||
      now - this.parriedAt < PARRY_COOLDOWN_MS
    )
      return
    this.parriedAt = now
    this.startParry(me.stick, PARRY_WINDOW_S)
    this.sendPose(false, true)
    // jauge de recharge : animation CSS, rien à faire par frame
    const gauge = me.labelEl.querySelector<HTMLElement>('.ar-parry')
    if (gauge) {
      gauge.classList.remove('ar-parry--cooling')
      void gauge.offsetWidth
      gauge.classList.add('ar-parry--cooling')
    }
  }

  private parriedAt = -PARRY_COOLDOWN_MS
  /** Effet en cours sur un joueur touché par une flèche cosmétique (le temps de sa chute). */
  private readonly statusFx = new Map<string, ArrowSkin>()

  private say(
    stick: Stick,
    text: string,
    color: string,
    size: number,
    lift = 0,
  ) {
    const p = stick.rag ? stick.rag.pts : stick.pts
    this.texts.push({
      x: p[HEAD * 2]!,
      y: p[HEAD * 2 + 1]! - 40 + lift,
      text,
      color,
      size,
      life: 1.3,
      max: 1.3,
    })
    if (this.texts.length > 12) this.texts.shift()
  }

  /* ------------------------------------------------------------ Entrées */

  private sendPose(jumped: boolean, parried = false) {
    if (this.localId === null) return
    const me = this.local()
    this.opts.onPose({
      crouch: this.crouchHeld,
      jump: jumped,
      parry: parried,
      away: document.hidden,
      aiming: this.aim !== undefined,
      aim: me ? Math.round(me.stick.aim * 100) / 100 : 0,
    })
    if (this.aim && me) {
      this.aim.sentAt = performance.now()
      this.aim.sentAngle = me.stick.aim
    }
  }

  private setCrouch(held: boolean) {
    if (this.crouchHeld === held) return
    this.crouchHeld = held
    const me = this.local()
    if (me) me.stick.crouching = held
    this.sendPose(false)
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === 'escape') return this.cancelAim()
    if (inputBlocked(event.target)) return
    if (event.code === 'Space') {
      // sinon Espace active le bouton resté sélectionné (carte de vote…)
      event.preventDefault()
      if (!event.repeat) this.parry()
    } else if (JUMP_KEYS.has(key)) {
      if (key.startsWith('arrow')) event.preventDefault()
      const me = this.local()
      if (!event.repeat && me && jump(me.stick)) this.sendPose(true)
    } else if (CROUCH_KEYS.has(key)) {
      if (key.startsWith('arrow')) event.preventDefault()
      this.setCrouch(true)
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !inputBlocked(event.target))
      event.preventDefault()
    if (CROUCH_KEYS.has(event.key.toLowerCase())) this.setCrouch(false)
  }

  private readonly onBlur = () => {
    this.setCrouch(false)
    this.cancelAim()
  }

  private readonly onVisibility = () => this.sendPose(false)

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.aim || inputBlocked(event.target)) return
    if (event.target instanceof Element && event.target.closest(UI_SELECTOR))
      return
    const me = this.local()
    if (!me || !this.enabled || me.stick.down > 0) return
    if (!me.canShoot) {
      this.say(me.stick, 'Vote d’abord !', '#cfd8ee', 22)
      return
    }
    if (this.arrowsLeft(me) <= 0) {
      this.say(me.stick, 'Carquois vide !', '#cfd8ee', 22)
      return
    }
    event.preventDefault()
    this.aim = {
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      startedAt: performance.now(),
      sentAt: 0,
      sentAngle: 0,
    }
    me.stick.aiming = true
    me.stick.draw = 0
    me.stick.aim = me.stick.facing > 0 ? 0 : Math.PI
    document.documentElement.classList.add('ar-aiming')
    this.sendPose(false)
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.aim || event.pointerId !== this.aim.id) return
    this.aim.x = event.clientX
    this.aim.y = event.clientY
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    const aim = this.aim
    if (!aim || event.pointerId !== aim.id) return
    const pull = Math.hypot(
      aim.startX - event.clientX,
      aim.startY - event.clientY,
    )
    const power = clamp((pull - PULL_MIN) / PULL_RANGE, 0, 1)
    this.cancelAim()
    // un simple clic ne tire pas : il faut tirer la corde
    if (pull >= PULL_MIN) this.shoot(power)
  }

  private readonly cancelAim = () => {
    if (!this.aim) return
    this.aim = undefined
    const me = this.local()
    if (me) me.stick.aiming = false
    document.documentElement.classList.remove('ar-aiming')
    this.sendPose(false)
  }

  /** Puissance courante de la visée (0..1) et mise à jour de l'angle de l'arc. */
  private updateAim(stick: Stick) {
    const aim = this.aim
    if (!aim) return 0
    // lance-pierre : on tire dans le sens opposé au glissement
    const dx = aim.startX - aim.x
    const dy = aim.startY - aim.y
    const pull = Math.hypot(dx, dy)
    const power = clamp((pull - PULL_MIN) / PULL_RANGE, 0, 1)
    if (pull > 6) {
      // le bras tremble : la flèche part là où l'arc pointe à l'instant du lâcher
      const now = performance.now()
      const held = (now - aim.startedAt) / 1000
      const amplitude =
        (SWAY_BASE + SWAY_POWER * power) * Math.min(1, 0.35 + held * 0.35)
      const sway =
        amplitude *
        (Math.sin(held * 5.3) * 0.65 + Math.sin(held * 8.9 + 1.3) * 0.35)
      stick.aim = Math.atan2(dy, dx) + sway
      if (Math.abs(dx) > 4) stick.facing = dx < 0 ? -1 : 1
      // les autres voient où l'arc pointe (envoi rare, seulement si ça a tourné)
      let turned = Math.abs(stick.aim - aim.sentAngle) % (Math.PI * 2)
      if (turned > Math.PI) turned = Math.PI * 2 - turned
      if (now - aim.sentAt >= AIM_SEND_MS && turned > AIM_SEND_DELTA)
        this.sendPose(false)
    }
    stick.draw = power
    return power
  }

  /* ------------------------------------------------------------ Géométrie */

  /** Monde logique centré et mis à l'échelle dans la zone de jeu ; étiquettes replacées. */
  private readonly layout = () => {
    const arena = this.opts.getArena()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    const scale = Math.min(arena.width / WORLD_W, arena.height / WORLD_H)
    const offsetX = arena.left + (arena.width - WORLD_W * scale) / 2
    const offsetY = arena.top + (arena.height - WORLD_H * scale) / 2
    const key = `${width},${height},${dpr},${scale.toFixed(4)},${offsetX.toFixed(1)},${offsetY.toFixed(1)}`
    if (key === this.layoutKey) return
    this.layoutKey = key
    this.scale = scale
    this.offsetX = offsetX
    this.offsetY = offsetY
    if (
      this.dpr !== dpr ||
      this.canvas.width !== Math.round(width * dpr) ||
      this.canvas.height !== Math.round(height * dpr)
    ) {
      this.dpr = dpr
      this.canvas.width = Math.round(width * dpr)
      this.canvas.height = Math.round(height * dpr)
    }
    this.host.style.setProperty('--ar-scale', scale.toFixed(3))
    for (const archer of this.archers.values()) {
      const { tx, ty } = archer.stick
      const label = `translate(${(offsetX + tx * scale).toFixed(1)}px,${(offsetY + (ty + PLATFORM_H + 8) * scale).toFixed(1)}px)`
      if (label === archer.renderedLabel) continue
      archer.renderedLabel = label
      archer.labelEl.style.transform = label
    }
    this.lastRender = 0 // redessine tout de suite, même au ralenti
  }

  /* ------------------------------------------------------------ Boucle */

  private readonly tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick)
    // rien ne bouge : on se contente de ~20 images/s pour la respiration
    if (!this.isBusy() && now - this.lastRender < IDLE_FRAME_MS) return
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.lastRender = now
    if (dt <= 0) return
    this.update(dt, now / 1000)
    this.render(now / 1000)
  }

  private isBusy() {
    if (
      this.aim ||
      this.particles.length ||
      this.texts.length ||
      this.shake > 0.2
    )
      return true
    for (const arrow of this.arrows) if (arrow.state !== 'stuck') return true
    for (const { stick, out } of this.archers.values()) {
      if (out) continue
      if (
        stick.rag ||
        stick.down > 0 ||
        stick.shield > 0 ||
        stick.parry > 0 ||
        !grounded(stick) ||
        stick.ready > 0.02 ||
        stick.flinch > 0.02 ||
        stick.land > 0.02 ||
        Math.abs(
          stick.crouch - (stick.crouching && stick.down <= 0 ? 1 : 0),
        ) > 0.01 ||
        Math.abs(stick.x - stick.tx) + Math.abs(stick.y - stick.ty) > 0.5
      )
        return true
    }
    return false
  }

  private update(dt: number, time: number) {
    const me = this.local()
    const power = me ? this.updateAim(me.stick) : 0
    if (this.aim && me && !this.canAim(me)) this.cancelAim()
    this.aimPower = power

    let index = 0
    for (const archer of this.archers.values()) {
      const stick = archer.stick
      if (stick.down > 0 && !archer.out) {
        stick.down -= dt
        if (stick.down <= 0) {
          const p = stick.rag ? stick.rag.pts : stick.pts
          this.burst(p[HIP * 2]!, p[HIP * 2 + 1]!, '#8d9db3', 10, 200)
          // plus de points de vie : il ne revient qu'à la prochaine manche
          if (archer.health <= 0) this.eliminate(archer)
          else respawn(stick)
          if (stick.isLocal) this.syncCanAim()
        }
      }
      if (updateStick(stick, dt, time))
        this.burst(stick.x, stick.y, 'rgba(141,157,179,.8)', 6, 130)
      const fx = this.statusFx.get(stick.id)
      if (fx) {
        if (!stick.rag) this.statusFx.delete(stick.id)
        else {
          // le corps brûle, gèle ou sème des confettis pendant sa chute
          stick.tint = ARROW_LOOKS[fx].tint
          if (Math.random() < dt * 45) {
            const point = Math.floor(Math.random() * 3) * 2
            this.skinBurst(
              stick.rag.pts[point]!,
              stick.rag.pts[point + 1]!,
              fx,
              1,
              110,
            )
          }
        }
      }
      const left = stick.x - PLATFORM_W / 2
      this.platformTeams[index / 4] = stick.baseFacing
      this.platforms[index++] = left
      this.platforms[index++] = stick.y
      this.platforms[index++] = left + PLATFORM_W
      this.platforms[index++] = stick.y + PLATFORM_H
    }

    // ragdolls et bandeaux à pas fixe : même physique quel que soit l'écran
    this.fixedTime = Math.min(this.fixedTime + dt, FIXED_STEP * 3)
    while (this.fixedTime >= FIXED_STEP) {
      this.fixedTime -= FIXED_STEP
      for (const { stick } of this.archers.values()) {
        stepRagdoll(stick, this.platforms)
        stepBand(stick)
      }
    }

    this.updateArrows(dt)

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]!
      particle.life -= dt
      if (particle.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!
        this.particles.pop()
        continue
      }
      particle.vy += particle.gravity * dt
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const text = this.texts[i]!
      text.life -= dt
      text.y -= 34 * dt
      if (text.life <= 0) this.texts.splice(i, 1)
    }
    this.shake *= Math.exp(-9 * dt)
  }

  private aimPower = 0

  private updateArrows(dt: number) {
    const platforms = this.platforms
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i]!
      arrow.age += dt
      if (arrow.state === 'stuck') {
        if (arrow.age > STUCK_TTL_S) this.arrows.splice(i, 1)
        continue
      }
      if (arrow.state === 'held') {
        if (arrow.age < HELD_TIMEOUT_S) continue
        // pas de confirmation : la cible avait esquivé, la flèche retombe
        const target = arrow.heldId ? this.archers.get(arrow.heldId) : undefined
        if (target && arrow.attach) {
          this.detach(target.stick.id, arrow.attach)
          this.say(target.stick, 'ESQUIVÉ !', '#9ff0d8', 24)
        }
        arrow.state = 'drop'
        arrow.age = 0
        arrow.vx *= -0.08
        arrow.vy = -160
        arrow.spin = (Math.random() - 0.5) * 14
        continue
      }
      if (arrow.state === 'drop') {
        arrow.vy += ARROW_GRAVITY * dt
        arrow.x += arrow.vx * dt
        arrow.y += arrow.vy * dt
        arrow.angle += arrow.spin * dt
        if (arrow.age > DROP_TTL_S) this.arrows.splice(i, 1)
        continue
      }

      // en vol : on avance par petits pas pour ne traverser ni tête ni plateforme
      const trail = arrow.trail
      trail.copyWithin(2, 0, (TRAIL_POINTS - 1) * 2)
      trail[0] = arrow.x
      trail[1] = arrow.y
      arrow.trailLength = Math.min(TRAIL_POINTS, arrow.trailLength + 1)
      // flèche spéciale : elle sème braises, givre ou confettis (~1 par image)
      if (arrow.skin && Math.random() < dt * 70)
        this.skinBurst(
          arrow.x - Math.cos(arrow.angle) * 28,
          arrow.y - Math.sin(arrow.angle) * 28,
          arrow.skin,
          1,
          80,
        )
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(arrow.vx, arrow.vy) * dt) / 6),
      )
      const h = dt / steps
      flight: for (let step = 0; step < steps; step++) {
        arrow.vy += ARROW_GRAVITY * h
        arrow.x += arrow.vx * h
        arrow.y += arrow.vy * h
        for (let r = 0; r < platforms.length; r += 4) {
          // les plateformes de son camp ne l'arrêtent pas
          if (this.platformTeams[r / 4] === arrow.team) continue
          if (
            arrow.x > platforms[r]! &&
            arrow.x < platforms[r + 2]! &&
            arrow.y > platforms[r + 1]! &&
            arrow.y < platforms[r + 3]!
          ) {
            arrow.state = 'stuck'
            arrow.age = 0
            if (arrow.skin)
              this.skinBurst(arrow.x, arrow.y, arrow.skin, 14, 300)
            else this.burst(arrow.x, arrow.y, '#8d9db3', 6, 170)
            break flight
          }
        }
        for (const archer of this.archers.values()) {
          const stick = archer.stick
          if (
            stick.id === arrow.shooterId ||
            stick.baseFacing === arrow.team || // pas de tir ami : elle traverse
            stick.down > 0 ||
            stick.shield > 0
          )
            continue
          const kind = hitTest(stick, arrow.x, arrow.y)
          if (!kind) continue
          arrow.angle = Math.atan2(arrow.vy, arrow.vx)
          this.onArrowTouch(arrow, archer, kind === 2)
          break flight
        }
      }
      if (arrow.state !== 'fly') continue
      arrow.angle = Math.atan2(arrow.vy, arrow.vx)
      if (
        arrow.x < -300 ||
        arrow.x > WORLD_W + 300 ||
        arrow.y > WORLD_H + 300 ||
        arrow.age > 8
      ) {
        const at = this.arrows.indexOf(arrow)
        if (at >= 0) this.arrows.splice(at, 1)
      }
    }
  }

  /* ------------------------------------------------------------ Rendu */

  private render(time: number) {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const zoom = this.scale * this.dpr
    const shakeX = (Math.random() - 0.5) * this.shake
    const shakeY = (Math.random() - 0.5) * this.shake
    ctx.setTransform(
      zoom,
      0,
      0,
      zoom,
      (this.offsetX + shakeX) * this.dpr,
      (this.offsetY + shakeY) * this.dpr,
    )
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // plateformes
    for (const { stick } of this.archers.values()) {
      const left = stick.x - PLATFORM_W / 2
      ctx.fillStyle = 'rgba(37,50,74,.16)'
      ctx.fillRect(left + 8, stick.y + PLATFORM_H, PLATFORM_W - 16, 6)
      ctx.fillStyle = '#25324a'
      ctx.beginPath()
      ctx.roundRect(left, stick.y, PLATFORM_W, PLATFORM_H, 6)
      ctx.fill()
      ctx.fillStyle = stick.color
      ctx.fillRect(left + 10, stick.y, PLATFORM_W - 20, 3.5)
    }

    for (const arrow of this.arrows) {
      if (arrow.state !== 'stuck') continue
      ctx.globalAlpha = clamp((STUCK_TTL_S - arrow.age) / 0.6, 0, 1)
      drawArrow(
        ctx,
        arrow.x,
        arrow.y,
        arrow.angle,
        arrow.color,
        true,
        arrow.skin,
      )
    }
    ctx.globalAlpha = 1

    // bonshommes, le joueur local par-dessus
    let localStick: Stick | undefined
    for (const { stick, out } of this.archers.values()) {
      if (out) this.renderTomb(stick)
      else if (stick.isLocal) localStick = stick
      else this.renderStick(stick, time)
    }
    if (localStick) this.renderStick(localStick, time)

    // flèches en vol, avec leur traînée
    for (const arrow of this.arrows) {
      if (arrow.state === 'fly' && arrow.trailLength > 1) {
        const trace = () => {
          ctx.beginPath()
          ctx.moveTo(arrow.x, arrow.y)
          for (let i = 0; i < arrow.trailLength; i++)
            ctx.lineTo(arrow.trail[i * 2]!, arrow.trail[i * 2 + 1]!)
          ctx.stroke()
        }
        if (arrow.skin === 'rainbow') {
          // ruban : six bandes concentriques, de la plus large à la plus fine
          ctx.globalAlpha = 0.75
          RAINBOW.forEach((band, index) => {
            ctx.strokeStyle = band
            ctx.lineWidth = 15 - index * 2.4
            trace()
          })
          ctx.globalAlpha = 1
        } else if (arrow.skin) {
          ctx.strokeStyle = ARROW_LOOKS[arrow.skin].halo
          ctx.lineWidth = 9
          trace()
        } else {
          ctx.strokeStyle = 'rgba(37,50,74,.2)'
          ctx.lineWidth = 2.5
          trace()
        }
      }
      if (arrow.state === 'fly' || arrow.state === 'drop') {
        if (arrow.state === 'drop')
          ctx.globalAlpha = clamp((DROP_TTL_S - arrow.age) / 0.4, 0, 1)
        drawArrow(
          ctx,
          arrow.x,
          arrow.y,
          arrow.angle,
          arrow.color,
          false,
          arrow.skin,
        )
        ctx.globalAlpha = 1
        if (arrow.skin === 'dragon' && arrow.state === 'fly')
          drawDragons(ctx, arrow.x, arrow.y, arrow.angle, arrow.age)
      }
    }

    if (localStick) {
      if (this.aim) this.renderAim(localStick)
      else if (!localStick.rag) {
        // repère « c'est toi »
        const x = localStick.pts[HEAD * 2]!
        const y = localStick.pts[HEAD * 2 + 1]! - 32 + Math.sin(time * 3) * 2.5
        ctx.fillStyle = localStick.color
        ctx.beginPath()
        ctx.moveTo(x - 8, y - 11)
        ctx.lineTo(x + 8, y - 11)
        ctx.lineTo(x, y)
        ctx.fill()
      }
    }

    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1)
      ctx.fillStyle = particle.color
      ctx.fillRect(
        particle.x - particle.size / 2,
        particle.y - particle.size / 2,
        particle.size,
        particle.size,
      )
    }
    ctx.textAlign = 'center'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(13,17,27,.82)'
    for (const text of this.texts) {
      const age = text.max - text.life
      const pop = 1 + 0.45 * Math.max(0, 1 - age / 0.16)
      ctx.globalAlpha = clamp(text.life / 0.35, 0, 1)
      ctx.font = `800 ${(text.size * pop).toFixed(1)}px 'Bricolage Grotesque','DM Sans',sans-serif`
      ctx.strokeText(text.text, text.x, text.y)
      ctx.fillStyle = text.color
      ctx.fillText(text.text, text.x, text.y)
    }
    ctx.globalAlpha = 1
  }

  /** Joueur éliminé : une tombe à ses couleurs sur sa plateforme. */
  private renderTomb(stick: Stick) {
    const ctx = this.ctx
    ctx.fillStyle = '#9aa8ba'
    ctx.beginPath()
    ctx.roundRect(stick.x - 18, stick.y - 46, 36, 46, [17, 17, 2, 2])
    ctx.fill()
    ctx.fillStyle = stick.color
    ctx.fillRect(stick.x - 18, stick.y - 8, 36, 4)
    ctx.fillStyle = '#25324a'
    ctx.textAlign = 'center'
    ctx.font = "800 12px 'DM Sans',sans-serif"
    ctx.fillText('RIP', stick.x, stick.y - 22)
  }

  private renderStick(stick: Stick, time: number) {
    // clignote tant qu'il est intouchable (réapparition)
    if (stick.shield > 0 && !stick.rag)
      this.ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 30)
    drawStick(this.ctx, stick)
    this.ctx.globalAlpha = 1
    if (stick.parry > 0 && !stick.rag) this.renderParry(stick)
  }

  /** Bouclier de parade : deux arcs lumineux devant le joueur, qui s'effacent. */
  private renderParry(stick: Stick) {
    const ctx = this.ctx
    const strength = clamp(stick.parry / PARRY_WINDOW_S, 0, 1)
    const cx = stick.pts[NECK * 2]!
    const cy = stick.pts[NECK * 2 + 1]! + 22
    const facing = stick.facing > 0 ? 0 : Math.PI
    const radius = 62 + (1 - strength) * 16
    ctx.globalAlpha = strength
    ctx.strokeStyle = stick.color
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.arc(cx, cy, radius, facing - 1.25, facing + 1.25)
    ctx.stroke()
    ctx.strokeStyle = '#fff6d6'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(cx, cy, radius, facing - 1.25, facing + 1.25)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** Demi-cercle de charge derrière le joueur + début de la trajectoire. */
  private renderAim(stick: Stick) {
    const ctx = this.ctx
    const power = this.aimPower
    const cx = stick.pts[NECK * 2]!
    const cy = stick.pts[NECK * 2 + 1]!
    const back = stick.aim + Math.PI
    const dots = 15
    const middle = (dots - 1) / 2
    const hue = 48 - 40 * power
    for (let i = 0; i < dots; i++) {
      const angle = back + ((i - middle) / middle) * 1.45
      const lit = Math.abs(i - middle) <= power * middle + 0.01
      ctx.fillStyle = lit
        ? `hsl(${hue.toFixed(0)} 95% 52%)`
        : 'rgba(37,50,74,.16)'
      ctx.beginPath()
      ctx.arc(
        cx + Math.cos(angle) * 96,
        cy + Math.sin(angle) * 96,
        lit ? 6.5 : 4.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    // poignée : là où la corde est « tenue »
    const reach = 28 + 62 * power
    const knobX = cx + Math.cos(back) * reach
    const knobY = cy + Math.sin(back) * reach
    ctx.strokeStyle = 'rgba(37,50,74,.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 7])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(knobX, knobY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = `hsl(${hue.toFixed(0)} 95% 52%)`
    ctx.beginPath()
    ctx.arc(knobX, knobY, 8, 0, Math.PI * 2)
    ctx.fill()

    // aperçu : juste le départ de la flèche, à chacun de doser la suite
    const speed = lerp(ARROW_MIN_SPEED, ARROW_MAX_SPEED, power)
    const dx = Math.cos(stick.aim)
    const dy = Math.sin(stick.aim)
    const originX = stick.pts[HAND_B * 2]! + dx * 20
    const originY = stick.pts[HAND_B * 2 + 1]! + dy * 20
    ctx.fillStyle = '#25324a'
    for (let i = 1; i <= 3; i++) {
      const t = i * 0.035
      ctx.globalAlpha = 0.7 - i * 0.17
      ctx.beginPath()
      ctx.arc(
        originX + dx * speed * t,
        originY + dy * speed * t + 0.5 * ARROW_GRAVITY * t * t,
        4 - i * 0.3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
