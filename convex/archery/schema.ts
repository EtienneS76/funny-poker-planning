import { defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Thème « Tir à l'arc ».
 *
 * Une ligne par joueur et par salle : sa posture (accroupi, dernier saut) et
 * son carquois de la manche en cours. Aucune position : chaque joueur reste sur
 * sa plateforme, calculée par les clients à partir de la liste des joueurs.
 */
export const archeryPlayerTable = defineTable({
  refinementId: v.id('refinements'),
  userId: v.string(),
  crouch: v.boolean(),
  /** Arc bandé + direction visée (radians) : les autres voient le tir venir. */
  aiming: v.optional(v.boolean()),
  aim: v.optional(v.number()),
  /** Horodatage serveur du dernier saut : les clients le rejouent quand il change. */
  jumpAt: v.optional(v.number()),
  /** Horodatage serveur de la dernière parade (Espace) : rejouée chez les autres. */
  parryAt: v.optional(v.number()),
  /** Flèche cosmétique équipée (boutique), relue à chaque posture / tir. */
  skin: v.optional(v.string()),
  /** Onglet masqué : le joueur ne peut plus arbitrer les flèches qui le visent. */
  away: v.boolean(),
  /** Manche à laquelle `arrowsUsed` se rapporte. */
  roundKey: v.optional(v.string()),
  arrowsUsed: v.number(),
  /** Dégâts reçus pendant la manche `damageRound` : éliminé à HEALTH, jusqu'à la manche suivante. */
  damage: v.optional(v.number()),
  damageRound: v.optional(v.string()),
  /** Flèches au but depuis l'arrivée dans la salle. */
  hits: v.number(),
  updatedAt: v.number(),
})
  .index('by_refinement', ['refinementId'])
  .index('by_refinement_and_user', ['refinementId', 'userId'])
  .index('by_updated', ['updatedAt'])

/**
 * Une flèche tirée. Position et vitesse sont en unités du monde logique du
 * moteur (voir src/.../archery/engine/world.ts) : tous les clients simulent la
 * même trajectoire. `hitUserId` est posé quand la cible confirme l'impact.
 */
export const archeryShotTable = defineTable({
  refinementId: v.id('refinements'),
  shooterId: v.string(),
  /** Identifiant choisi par le tireur : il reconnaît sa flèche déjà en vol. */
  clientId: v.string(),
  x: v.number(),
  y: v.number(),
  vx: v.number(),
  vy: v.number(),
  firedAt: v.number(),
  /** Flèche cosmétique du tireur au moment du tir. */
  skin: v.optional(v.string()),
  hitUserId: v.optional(v.string()),
  headshot: v.optional(v.boolean()),
  /** Cette flèche a éliminé la cible. */
  kill: v.optional(v.boolean()),
  rewarded: v.optional(v.boolean()),
})
  .index('by_refinement_fired', ['refinementId', 'firedAt'])
  .index('by_fired', ['firedAt'])
