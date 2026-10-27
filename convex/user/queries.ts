import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authComponent } from '../auth/auth'
import { avatarFrameCatalog } from './avatarFrames'
import { cardDesignCatalog } from './cardDesigns'
import { pokemonConsumableCatalog } from './consumables'

export const shopData = query({
  args: {},
  returns: v.object({
    balance: v.number(),
    catalog: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.string(),
        rarity: v.union(
          v.literal('common'),
          v.literal('rare'),
          v.literal('legendary'),
          v.literal('ultimate'),
        ),
        price: v.number(),
      }),
    ),
    cardDesigns: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.string(),
        rarity: v.union(
          v.literal('rare'),
          v.literal('epic'),
          v.literal('legendary'),
        ),
        price: v.number(),
        symbol: v.string(),
      }),
    ),
    ownedCardDesignIds: v.array(v.string()),
    equippedCardDesignId: v.union(v.string(), v.null()),
    ownedIds: v.array(v.string()),
    equippedId: v.union(v.string(), v.null()),
    consumables: v.array(
      v.object({
        id: v.string(),
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
      }),
    ),
    consumableInventory: v.array(
      v.object({
        consumableId: v.string(),
        quantity: v.number(),
      }),
    ),
  }),
  handler: async (context) => {
    const catalog = avatarFrameCatalog.map((frame) => ({ ...frame }))
    const cardDesigns = cardDesignCatalog.map((design) => ({ ...design }))
    const storedConsumables = await context.db
      .query('consumableCatalog')
      .collect()
    const storedConsumablesById = new Map(
      storedConsumables.map((item) => [item.consumableId, item]),
    )
    const consumables = pokemonConsumableCatalog.map((item) => {
      const storedItem = storedConsumablesById.get(item.id)
      const catchRates =
        storedItem?.catchRates ??
        ('catchRates' in item ? item.catchRates : undefined)
      return {
        id: item.id,
        name: storedItem?.name ?? item.name,
        description: storedItem?.description ?? item.description,
        price: storedItem?.price ?? item.price,
        sprite: item.sprite,
        ...(catchRates ? { catchRates } : {}),
      }
    })
    const identity = await context.auth.getUserIdentity()
    if (!identity) {
      return {
        balance: 0,
        catalog,
        cardDesigns,
        ownedCardDesignIds: [],
        equippedCardDesignId: null,
        ownedIds: [],
        equippedId: null,
        consumables,
        consumableInventory: [],
      }
    }

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) {
      return {
        balance: 0,
        catalog,
        cardDesigns,
        ownedCardDesignIds: [],
        equippedCardDesignId: null,
        ownedIds: [],
        equippedId: null,
        consumables,
        consumableInventory: [],
      }
    }

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    const inventory = await context.db
      .query('userAvatarFrames')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()
    const cardDesignInventory = await context.db
      .query('userCardDesigns')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()
    const consumableInventory = await context.db
      .query('userConsumables')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()

    return {
      balance: wallet?.balance ?? 0,
      catalog,
      cardDesigns,
      ownedCardDesignIds: cardDesignInventory.map((item) => item.designId),
      equippedCardDesignId: user.cardDesignId ?? null,
      ownedIds: inventory.map((item) => item.frameId),
      equippedId: user.avatarFrameId ?? null,
      consumables,
      consumableInventory: consumableInventory.map(
        ({ consumableId, quantity }) => ({ consumableId, quantity }),
      ),
    }
  },
})

export const current = query({
  args: {},
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return null

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return null

    const statistics = await context.db
      .query('statistics')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()

    return {
      ...user,
      avatarFrameId: user.avatarFrameId ?? null,
      cardDesignId: user.cardDesignId ?? null,
      assignedPokemonId: user.assignedPokemonId ?? null,
      assignedPokemonShiny: user.assignedPokemonShiny ?? false,
      showPokemon3d: user.showPokemon3d ?? false,
      firstConnectedAt: user._creationTime,
      statistics,
    }
  },
})

export const pokemonCollection = query({
  args: {},
  returns: v.array(
    v.object({
      pokemonId: v.number(),
      shiny: v.boolean(),
      unlockedAt: v.number(),
    }),
  ),
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return []

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return []

    const entries = await context.db
      .query('userPokemons')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()
    return entries.map(({ pokemonId, shiny, unlockedAt }) => ({
      pokemonId,
      shiny: shiny ?? false,
      unlockedAt,
    }))
  },
})

export const starWarsCollection = query({
  args: {},
  returns: v.array(
    v.object({
      recordId: v.id('userStarWarsCharacters'),
      characterId: v.string(),
      name: v.string(),
      imageUrl: v.string(),
      description: v.optional(v.string()),
      openedAt: v.number(),
    }),
  ),
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return []

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return []

    const characters = await context.db
      .query('userStarWarsCharacters')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()
    return characters.map(
      ({ _id, characterId, name, imageUrl, description, openedAt }) => ({
        recordId: _id,
        characterId,
        name,
        imageUrl,
        ...(description ? { description } : {}),
        openedAt,
      }),
    )
  },
})

export const starterPokemonOpening = query({
  args: {},
  returns: v.union(
    v.object({
      pokemonId: v.number(),
      shiny: v.boolean(),
      rerollsRemaining: v.number(),
    }),
    v.null(),
  ),
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity()
    if (!identity) return null

    const authUser = await authComponent.getAuthUser(context)
    const user = await context.db
      .query('users')
      .withIndex('by_auth_user', (query) =>
        query.eq('authUserId', String(authUser._id)),
      )
      .unique()
    if (!user) return null

    const opening = await context.db
      .query('starterPokemonOpenings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()
    if (
      !opening ||
      opening.giftedAt === undefined ||
      opening.claimedAt !== undefined ||
      opening.pokemonId === undefined
    ) {
      return null
    }

    return {
      pokemonId: opening.pokemonId,
      shiny: opening.shiny ?? false,
      rerollsRemaining: opening.rerollsRemaining,
    }
  },
})
