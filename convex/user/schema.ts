import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const userTable = defineTable({
  authUserId: v.string(),
  username: v.string(),
  displayName: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  avatarFrameId: v.optional(v.string()),
  assignedPokemonId: v.optional(v.number()),
  showPokemon3d: v.optional(v.boolean()),
  starterCaptureBallsGiftedAt: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
}).index('by_auth_user', ['authUserId'])

export const pokisouWalletTable = defineTable({
  userId: v.string(),
  balance: v.number(),
}).index('by_user_id', ['userId'])

export const userAvatarFramesTable = defineTable({
  userId: v.id('users'),
  frameId: v.string(),
  purchasedAt: v.number(),
})
  .index('by_user', ['userId'])
  .index('by_user_frame', ['userId', 'frameId'])

export const userPokemonsTable = defineTable({
  userId: v.id('users'),
  pokemonId: v.number(),
  unlockedAt: v.number(),
})
  .index('by_user', ['userId'])
  .index('by_user_pokemon', ['userId', 'pokemonId'])

export const starterPokemonOpeningTable = defineTable({
  userId: v.id('users'),
  pokemonId: v.optional(v.number()),
  rerollsRemaining: v.number(),
  giftedAt: v.optional(v.number()),
  claimedAt: v.optional(v.number()),
}).index('by_user', ['userId'])

export const pokemonEncounterTable = defineTable({
  ownerKey: v.string(),
  pokemonId: v.number(),
  status: v.union(
    v.literal('active'),
    v.literal('won'),
    v.literal('escaped'),
    v.literal('captured'),
  ),
  createdAt: v.number(),
}).index('by_owner', ['ownerKey'])

export const consumableCatalogTable = defineTable({
  consumableId: v.string(),
  name: v.string(),
  description: v.string(),
  price: v.number(),
  sprite: v.string(),
  catchRates: v.optional(
    v.object({
      commun: v.number(),
      rare: v.number(),
      epique: v.number(),
      legendaire: v.number(),
      ultime: v.number(),
    }),
  ),
}).index('by_consumable_id', ['consumableId'])

export const userConsumablesTable = defineTable({
  userId: v.id('users'),
  consumableId: v.string(),
  quantity: v.number(),
  updatedAt: v.number(),
})
  .index('by_user', ['userId'])
  .index('by_user_consumable', ['userId', 'consumableId'])
