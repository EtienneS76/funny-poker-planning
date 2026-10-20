import { ConvexError, v } from 'convex/values'
import { mutation, type MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { avatarFrameCatalog } from './avatarFrames'
import { pokemonConsumableCatalog } from './consumables'
import { drawMysteryPokemonId, getPokemonRarityById } from './pokemonDraw'
import { syncAuthenticatedUser } from './profile'

async function requireAuthenticatedUser(context: MutationCtx) {
  if (!(await context.auth.getUserIdentity())) {
    throw new ConvexError('Connecte-toi pour gérer ton inventaire.')
  }
  return syncAuthenticatedUser(context)
}

async function syncConsumableCatalog(context: MutationCtx) {
  for (const item of pokemonConsumableCatalog) {
    const existing = await context.db
      .query('consumableCatalog')
      .withIndex('by_consumable_id', (query) =>
        query.eq('consumableId', item.id),
      )
      .unique()
    const catchRates = 'catchRates' in item ? item.catchRates : undefined
    const values = {
      consumableId: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      sprite: item.sprite,
      ...(catchRates ? { catchRates } : {}),
    }
    const isCurrent =
      existing?.name === values.name &&
      existing.description === values.description &&
      existing.price === values.price &&
      existing.sprite === values.sprite &&
      JSON.stringify(existing.catchRates ?? null) ===
        JSON.stringify(catchRates ?? null)
    if (existing && !isCurrent) {
      await context.db.patch(existing._id, values)
    } else if (!existing) {
      await context.db.insert('consumableCatalog', values)
    }
  }
}

export const ensureConsumableCatalog = mutation({
  args: {},
  returns: v.null(),
  handler: async (context) => {
    await syncConsumableCatalog(context)
    return null
  },
})

export const buyConsumable = mutation({
  args: { consumableId: v.string() },
  returns: v.null(),
  handler: async (context, { consumableId }) => {
    const user = await requireAuthenticatedUser(context)
    await syncConsumableCatalog(context)
    const item = await context.db
      .query('consumableCatalog')
      .withIndex('by_consumable_id', (query) =>
        query.eq('consumableId', consumableId),
      )
      .unique()
    if (!item) throw new ConvexError('Ce consommable n’existe pas.')

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    if (!wallet || wallet.balance < item.price) {
      throw new ConvexError(
        'Tu n’as pas assez de Pokisous pour ce consommable.',
      )
    }

    const ownedItem = await context.db
      .query('userConsumables')
      .withIndex('by_user_consumable', (query) =>
        query.eq('userId', user._id).eq('consumableId', consumableId),
      )
      .unique()
    await context.db.patch(wallet._id, {
      balance: wallet.balance - item.price,
    })
    if (ownedItem) {
      await context.db.patch(ownedItem._id, {
        quantity: ownedItem.quantity + 1,
        updatedAt: Date.now(),
      })
    } else {
      await context.db.insert('userConsumables', {
        userId: user._id,
        consumableId,
        quantity: 1,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const openMysteryPokeBall = mutation({
  args: {},
  returns: v.object({
    pokemonId: v.number(),
    welcomeGift: v.boolean(),
    rerollsRemaining: v.number(),
  }),
  handler: async (context) => {
    const user = await requireAuthenticatedUser(context)
    const welcomeOpening = await context.db
      .query('starterPokemonOpenings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()
    if (
      welcomeOpening?.giftedAt !== undefined &&
      welcomeOpening.claimedAt === undefined
    ) {
      if (welcomeOpening.pokemonId !== undefined) {
        return {
          pokemonId: welcomeOpening.pokemonId,
          welcomeGift: true,
          rerollsRemaining: welcomeOpening.rerollsRemaining,
        }
      }
      const pokemonId = drawMysteryPokemonId()
      await context.db.patch(welcomeOpening._id, {
        pokemonId,
        rerollsRemaining: 2,
      })
      await incrementMysteryPokeBallOpenCount(context, user._id)
      return {
        pokemonId,
        welcomeGift: true,
        rerollsRemaining: 2,
      }
    }

    const consumable = await context.db
      .query('userConsumables')
      .withIndex('by_user_consumable', (query) =>
        query.eq('userId', user._id).eq('consumableId', 'mystery-poke-ball'),
      )
      .unique()
    if (!consumable || consumable.quantity < 1) {
      throw new ConvexError('Tu ne possèdes pas de Poké Ball mystère.')
    }

    const pokemonId = drawMysteryPokemonId()
    const now = Date.now()
    if (consumable.quantity === 1) {
      await context.db.delete(consumable._id)
    } else {
      await context.db.patch(consumable._id, {
        quantity: consumable.quantity - 1,
        updatedAt: now,
      })
    }
    await context.db.insert('userPokemons', {
      userId: user._id,
      pokemonId,
      unlockedAt: now,
    })
    await incrementMysteryPokeBallOpenCount(context, user._id)
    return { pokemonId, welcomeGift: false, rerollsRemaining: 0 }
  },
})

function validateGuestId(guestId: string) {
  if (guestId.length < 8 || guestId.length > 128) {
    throw new ConvexError('Identifiant invité invalide.')
  }
}

async function pokemonEncounterOwnerKey(context: MutationCtx, guestId: string) {
  const identity = await context.auth.getUserIdentity()
  if (identity) {
    const user = await syncAuthenticatedUser(context)
    return `user:${user._id}`
  }
  validateGuestId(guestId)
  return `guest:${guestId}`
}

export const startPokemonEncounter = mutation({
  args: { guestId: v.string() },
  returns: v.object({
    pokemonId: v.number(),
  }),
  handler: async (context, { guestId }) => {
    const ownerKey = await pokemonEncounterOwnerKey(context, guestId)
    const existing = await context.db
      .query('pokemonEncounters')
      .withIndex('by_owner', (query) => query.eq('ownerKey', ownerKey))
      .unique()
    if (existing?.status === 'active') {
      return { pokemonId: existing.pokemonId }
    }

    const pokemonId = drawMysteryPokemonId(
      existing?.status === 'escaped' ? existing.pokemonId : undefined,
    )
    if (existing) {
      await context.db.patch(existing._id, {
        pokemonId,
        status: 'active',
        createdAt: Date.now(),
      })
    } else {
      await context.db.insert('pokemonEncounters', {
        ownerKey,
        pokemonId,
        status: 'active',
        createdAt: Date.now(),
      })
    }
    return { pokemonId }
  },
})

export const endPokemonEncounter = mutation({
  args: { guestId: v.string() },
  returns: v.null(),
  handler: async (context, { guestId }) => {
    const ownerKey = await pokemonEncounterOwnerKey(context, guestId)
    const encounter = await context.db
      .query('pokemonEncounters')
      .withIndex('by_owner', (query) => query.eq('ownerKey', ownerKey))
      .unique()
    if (encounter?.status === 'active') {
      await context.db.patch(encounter._id, { status: 'escaped' })
    }
    return null
  },
})

export const attackWildPokemon = mutation({
  args: { guestId: v.string() },
  returns: v.object({
    won: v.boolean(),
    pokemonId: v.number(),
  }),
  handler: async (context, { guestId }) => {
    const ownerKey = await pokemonEncounterOwnerKey(context, guestId)
    const encounter = await context.db
      .query('pokemonEncounters')
      .withIndex('by_owner', (query) => query.eq('ownerKey', ownerKey))
      .unique()
    if (!encounter || encounter.status !== 'active') {
      throw new ConvexError('Cette rencontre Pokémon est terminée.')
    }

    const won = Math.random() < 0.5
    await context.db.patch(encounter._id, {
      status: won ? 'won' : 'escaped',
    })
    return { won, pokemonId: encounter.pokemonId }
  },
})

export const throwCaptureBall = mutation({
  args: {
    consumableId: v.union(
      v.literal('poke-ball'),
      v.literal('hyper-ball'),
      v.literal('master-ball'),
    ),
  },
  returns: v.object({
    captured: v.boolean(),
    captureChance: v.number(),
    pokemonId: v.number(),
    ballsLeft: v.number(),
  }),
  handler: async (context, { consumableId }) => {
    const user = await requireAuthenticatedUser(context)
    const ownerKey = `user:${user._id}`
    const encounter = await context.db
      .query('pokemonEncounters')
      .withIndex('by_owner', (query) => query.eq('ownerKey', ownerKey))
      .unique()
    if (!encounter || encounter.status !== 'active') {
      throw new ConvexError('Cette rencontre Pokémon est terminée.')
    }

    const ownedBall = await context.db
      .query('userConsumables')
      .withIndex('by_user_consumable', (query) =>
        query.eq('userId', user._id).eq('consumableId', consumableId),
      )
      .unique()
    if (!ownedBall || ownedBall.quantity < 1) {
      throw new ConvexError('Tu ne possèdes pas cette Poké Ball.')
    }

    const rarity = getPokemonRarityById(encounter.pokemonId)
    const ball = pokemonConsumableCatalog.find(
      (item) => item.id === consumableId,
    )
    const captureChance =
      rarity && ball && 'catchRates' in ball ? ball.catchRates[rarity] : null
    if (captureChance === null || captureChance === undefined) {
      throw new ConvexError('Impossible de déterminer les chances de capture.')
    }

    if (ownedBall.quantity === 1) {
      await context.db.delete(ownedBall._id)
    } else {
      await context.db.patch(ownedBall._id, {
        quantity: ownedBall.quantity - 1,
        updatedAt: Date.now(),
      })
    }

    const captured = Math.random() * 100 < captureChance
    const captureBallIds = ['poke-ball', 'hyper-ball', 'master-ball']
    const remainingConsumables = await context.db
      .query('userConsumables')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()
    const ballsLeft = remainingConsumables
      .filter((item) => captureBallIds.includes(item.consumableId))
      .reduce((total, item) => total + item.quantity, 0)
    await context.db.patch(encounter._id, {
      status: captured ? 'captured' : 'active',
    })
    if (captured) {
      await context.db.insert('userPokemons', {
        userId: user._id,
        pokemonId: encounter.pokemonId,
        unlockedAt: Date.now(),
      })
    }

    return {
      captured,
      captureChance,
      pokemonId: encounter.pokemonId,
      ballsLeft,
    }
  },
})

async function consumeMysteryPokeBall(
  context: MutationCtx,
  userId: Id<'users'>,
) {
  const consumable = await context.db
    .query('userConsumables')
    .withIndex('by_user_consumable', (query) =>
      query.eq('userId', userId).eq('consumableId', 'mystery-poke-ball'),
    )
    .unique()
  if (!consumable || consumable.quantity < 1) {
    throw new ConvexError('Tu ne possèdes pas de Poké Ball mystère.')
  }
  if (consumable.quantity === 1) {
    await context.db.delete(consumable._id)
  } else {
    await context.db.patch(consumable._id, {
      quantity: consumable.quantity - 1,
      updatedAt: Date.now(),
    })
  }
}

async function incrementMysteryPokeBallOpenCount(
  context: MutationCtx,
  userId: Id<'users'>,
) {
  const statistics = await context.db
    .query('statistics')
    .withIndex('by_user', (query) => query.eq('userId', userId))
    .unique()
  if (statistics) {
    await context.db.patch(statistics._id, {
      mysteryPokeBallOpenCount: (statistics.mysteryPokeBallOpenCount ?? 0) + 1,
    })
  }
}

export const grantWelcomeMysteryPokeBall = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (context) => {
    const user = await requireAuthenticatedUser(context)
    const existing = await context.db
      .query('starterPokemonOpenings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique()
    if (existing?.giftedAt !== undefined) return false
    if (existing?.claimedAt !== undefined) return false

    const ownedPokemon = await context.db
      .query('userPokemons')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .first()
    if (ownedPokemon) {
      return false
    }

    const now = Date.now()
    const consumable = await context.db
      .query('userConsumables')
      .withIndex('by_user_consumable', (query) =>
        query.eq('userId', user._id).eq('consumableId', 'mystery-poke-ball'),
      )
      .unique()
    if (consumable) {
      await context.db.patch(consumable._id, {
        quantity: consumable.quantity + 1,
        updatedAt: now,
      })
    } else {
      await context.db.insert('userConsumables', {
        userId: user._id,
        consumableId: 'mystery-poke-ball',
        quantity: 1,
        updatedAt: now,
      })
    }

    if (existing) {
      await context.db.patch(existing._id, {
        pokemonId: undefined,
        rerollsRemaining: 2,
        giftedAt: now,
      })
    } else {
      await context.db.insert('starterPokemonOpenings', {
        userId: user._id,
        rerollsRemaining: 2,
        giftedAt: now,
      })
    }
    return true
  },
})

export const rerollWelcomeMysteryPokeBall = mutation({
  args: {},
  returns: v.object({
    pokemonId: v.number(),
    rerollsRemaining: v.number(),
  }),
  handler: async (context) => {
    const user = await requireAuthenticatedUser(context)
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
      throw new ConvexError('Aucune ouverture de bienvenue en cours.')
    }
    if (opening.rerollsRemaining < 1) {
      throw new ConvexError('Tu as utilisé tous tes rerolls.')
    }

    const pokemonId = drawMysteryPokemonId()
    const rerollsRemaining = opening.rerollsRemaining - 1
    await context.db.patch(opening._id, { pokemonId, rerollsRemaining })
    return { pokemonId, rerollsRemaining }
  },
})

export const claimStarterPokemon = mutation({
  args: {},
  returns: v.number(),
  handler: async (context) => {
    const user = await requireAuthenticatedUser(context)
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
      throw new ConvexError('Aucun Pokémon de bienvenue à récupérer.')
    }

    await consumeMysteryPokeBall(context, user._id)
    const now = Date.now()
    await context.db.insert('userPokemons', {
      userId: user._id,
      pokemonId: opening.pokemonId,
      unlockedAt: now,
    })
    await context.db.patch(user._id, { assignedPokemonId: opening.pokemonId })
    await context.db.patch(opening._id, { claimedAt: now })
    return opening.pokemonId
  },
})

export const syncCurrent = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (context) => {
    const profile = await syncAuthenticatedUser(context)
    return profile._id
  },
})

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (context, { displayName }) => {
    const name = displayName.trim()
    if (!name || name.length > 36) {
      throw new ConvexError('Le pseudo doit contenir entre 1 et 36 caractères.')
    }

    const user = await syncAuthenticatedUser(context)
    await context.db.patch(user._id, { displayName: name })
    return null
  },
})

export const updatePokemonDisplayPreference = mutation({
  args: { showPokemon3d: v.boolean() },
  returns: v.null(),
  handler: async (context, { showPokemon3d }) => {
    const user = await requireAuthenticatedUser(context)
    await context.db.patch(user._id, { showPokemon3d })
    return null
  },
})

export const buyAvatarFrame = mutation({
  args: { frameId: v.string() },
  returns: v.null(),
  handler: async (context, { frameId }) => {
    const frame = avatarFrameCatalog.find((item) => item.id === frameId)
    if (!frame) throw new ConvexError('Ce cadre n’existe pas.')

    const user = await requireAuthenticatedUser(context)
    const existing = await context.db
      .query('userAvatarFrames')
      .withIndex('by_user_frame', (query) =>
        query.eq('userId', user._id).eq('frameId', frameId),
      )
      .unique()
    if (existing) throw new ConvexError('Tu possèdes déjà ce cadre.')

    const wallet = await context.db
      .query('pokisouWallets')
      .withIndex('by_user_id', (query) => query.eq('userId', String(user._id)))
      .unique()
    if (!wallet || wallet.balance < frame.price) {
      throw new ConvexError('Tu n’as pas assez de Pokisous pour ce cadre.')
    }

    await context.db.patch(wallet._id, {
      balance: wallet.balance - frame.price,
    })
    await context.db.insert('userAvatarFrames', {
      userId: user._id,
      frameId,
      purchasedAt: Date.now(),
    })
    return null
  },
})

export const equipAvatarFrame = mutation({
  args: { frameId: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (context, { frameId }) => {
    const user = await requireAuthenticatedUser(context)
    if (frameId !== null) {
      if (!avatarFrameCatalog.some((frame) => frame.id === frameId)) {
        throw new ConvexError('Ce cadre n’existe pas.')
      }
      const ownedFrame = await context.db
        .query('userAvatarFrames')
        .withIndex('by_user_frame', (query) =>
          query.eq('userId', user._id).eq('frameId', frameId),
        )
        .unique()
      if (!ownedFrame) throw new ConvexError('Tu ne possèdes pas ce cadre.')
    }

    await context.db.patch(user._id, { avatarFrameId: frameId ?? undefined })
    return null
  },
})

export const assignPokemon = mutation({
  args: { pokemonId: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (context, { pokemonId }) => {
    const user = await requireAuthenticatedUser(context)
    if (pokemonId !== null) {
      if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > 151) {
        throw new ConvexError(
          'L’ID du Pokémon doit être compris entre 1 et 151.',
        )
      }
      const ownedPokemon = await context.db
        .query('userPokemons')
        .withIndex('by_user_pokemon', (query) =>
          query.eq('userId', user._id).eq('pokemonId', pokemonId),
        )
        .unique()
      if (!ownedPokemon) {
        throw new ConvexError('Tu dois d’abord débloquer ce Pokémon.')
      }
    }

    await context.db.patch(user._id, {
      assignedPokemonId: pokemonId ?? undefined,
    })
    return null
  },
})
