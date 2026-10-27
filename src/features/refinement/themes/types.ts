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
  hitAt?: number
  hitDx?: number
  hitDy?: number
  hitPower?: number
  pushAt?: number
  pushDx?: number
}
export type AmongUsLocalState = { x: number; y: number; dir: 1 | -1 }

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
    players: AmongUsPlayerRecord[] | undefined
    move: (state: AmongUsLocalState) => void
    push: (targetUserId: string | null, power: number) => void
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
