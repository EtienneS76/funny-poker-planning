import { defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Une ligne par joueur et par salle : sa position (normalisée 0..1 dans la zone
 * de jeu du client) + les derniers événements de poussée. Les clients détectent
 * un coup en voyant `hitAt` / `pushAt` changer.
 */
export const amongUsPlayerTable = defineTable({
  refinementId: v.id('refinements'),
  userId: v.string(),
  x: v.number(),
  y: v.number(),
  dir: v.number(), // 1 = regarde à droite, -1 = à gauche
  updatedAt: v.number(),
  // Subi : ce joueur a été poussé
  fallenUntil: v.optional(v.number()),
  hitAt: v.optional(v.number()),
  hitDx: v.optional(v.number()),
  hitDy: v.optional(v.number()),
  hitPower: v.optional(v.number()),
  // Donné : ce joueur a poussé (ou raté son coup)
  pushAt: v.optional(v.number()),
  pushDx: v.optional(v.number()),
})
  .index('by_refinement', ['refinementId'])
  .index('by_refinement_and_user', ['refinementId', 'userId'])
  .index('by_updated', ['updatedAt'])
