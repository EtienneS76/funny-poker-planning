import type { ComponentProps, ComponentType } from 'react'
import type { useAccount } from '../../auth/useAccount'
import type { RefinementRoomControls } from '../RefinementRoomControls'
import type { RefinementRoomReactions } from '../RefinementRoomReactions'

export type Seat = {
  id: string
  name: string
  avatarUrl: string | null
  avatarFrameId: string | null
  cardDesignId: string | null
  pokemonGifUrl: string | null
  pokemonName: string | null
  pokemonId: number | null
  pokemonShiny: boolean
  showPokemon3d: boolean
  isSpectator: boolean
  vote: string | null
  hasVoted: boolean
  isMe: boolean
}

export type ReactionKind = 'tomato' | 'poop' | 'egg' | 'soap'

/** Position + derniers événements d'un joueur dans le thème Among Us (voir convex/amongUs). */
export type AmongUsPlayerRecord = {
  userId: string
  x: number
  y: number
  dir: number
  vx?: number
  vy?: number
  updatedAt?: number
  hitAt?: number
  hitDx?: number
  hitDy?: number
  hitPower?: number
  pushAt?: number
  pushDx?: number
}
export type AmongUsLocalState = {
  x: number
  y: number
  dir: 1 | -1
  /** Vitesse normalisée par seconde : les autres clients extrapolent avec. */
  vx: number
  vy: number
}

/** État du thème « Tir à l'arc » (voir convex/archery). */
export type ArcheryState = {
  /** Les tirs suivent le réglage « interactions fun » de la salle. */
  enabled: boolean
  roundKey: string
  players: {
    userId: string
    crouch: boolean
    aiming: boolean
    aim: number
    jumpAt?: number
    parryAt?: number
    /** Flèche cosmétique équipée (boutique). */
    skin?: string
    away: boolean
    arrowsLeft: number
    hits: number
    /** Points de vie restants dans la manche : 0 = éliminé jusqu'à la suivante. */
    health: number
  }[]
  shots: {
    id: string
    shooterId: string
    clientId: string
    x: number
    y: number
    vx: number
    vy: number
    skin?: string
    hitUserId?: string
    headshot?: boolean
    kill?: boolean
    rewarded?: boolean
  }[]
}
export type ArcheryPose = {
  crouch: boolean
  jump: boolean
  parry: boolean
  away: boolean
  /** Arc bandé et direction visée (radians), visibles par les autres joueurs. */
  aiming: boolean
  aim: number
}
export type ArcheryShot = {
  clientId: string
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Tout ce dont un thème a besoin pour afficher la salle : de l'état et des
 * callbacks. Un thème ne parle jamais à Convex et ne contient aucune règle métier.
 */
export type RoomViewModel = {
  universe: string | undefined
  account: ReturnType<typeof useAccount>
  seats: Seat[]
  table: {
    revealed: boolean
    consensus: boolean
    votedCount: number
    playerCount: number
    isTshirtSizing: boolean
    average: number | null
    tshirtSummary: string
  }
  hand: {
    cards: readonly string[]
    selectedCard: string | null
    isSpectator: boolean
    canVote: boolean
    onSelect: (card: string) => void
  }
  controls: ComponentProps<typeof RefinementRoomControls>
  reactions: {
    enabled: boolean
    events: ComponentProps<typeof RefinementRoomReactions>['events']
    eventsReady: boolean
    targetId: string | null
    round: number
    dodging: Record<string, number>
    toggleMenu: (seatId: string, trigger: HTMLButtonElement) => void
    closeMenu: () => void
    dodge: (seatId: string, active: boolean) => void
    send: (targetUserId: string, kind: ReactionKind) => void
  }
  issue: {
    url: string | null
    editorOpen: boolean
    openEditor: () => void
    closeEditor: () => void
    save: (issueUrl: string | null) => Promise<boolean>
  }
  skirmish: {
    refinementSlug: string
    eligible: boolean
    progress: { shipsDestroyed: number; rewarded: boolean } | null | undefined
    recordDestroyedShip: () => Promise<void>
  }
  amongUs: {
    /** Thème Among Us affiché : seul cas où la synchro des positions est active. */
    active: boolean
    /** Les poussées suivent le réglage « interactions fun » de la salle. */
    pushEnabled: boolean
    /**
     * Abonnement direct aux positions : elles changent plusieurs fois par
     * seconde, on ne les fait donc pas passer par un rendu React de la salle.
     */
    subscribe: (
      listener: (players: AmongUsPlayerRecord[]) => void,
    ) => () => void
    move: (state: AmongUsLocalState) => void
    push: (targetUserId: string | null, power: number) => void
  }
  archery: {
    /** Abonnement direct (sans rendu React) aux postures et aux flèches. */
    subscribe: (listener: (state: ArcheryState) => void) => () => void
    setPose: (pose: ArcheryPose) => void
    /** Résout à false si le serveur refuse le tir (carquois vide…). */
    shoot: (shot: ArcheryShot) => Promise<boolean>
    reportHit: (shotId: string, targetUserId: string, headshot: boolean) => void
  }
  copyInviteLink: () => Promise<void>
}

export type RoomProps = { vm: RoomViewModel; themeId?: string }

export type Theme = {
  id: string
  /** Niveau 3 : la mise en page complète. Les thèmes simples réutilisent celle du thème par défaut. */
  Room: ComponentType<RoomProps>
  /** Couche décorative ou interactive affichée au-dessus de la salle. */
  Layer?: ComponentType<RoomProps>
  // Plus tard : vocabulary (niveau 2), slots partiels (Table, Reveal, Background…)
}
