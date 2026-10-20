const pokemonByRarity = {
  ultime: { weight: 1, ids: [150, 151] },
  legendaire: { weight: 4, ids: [144, 145, 146] },
  epique: {
    weight: 10,
    ids: [
      3, 6, 9, 65, 68, 76, 94, 103, 107, 106, 113, 115, 122, 123, 124, 125, 126,
      127, 128, 130, 131, 133, 137, 142, 143, 147, 148, 149,
    ],
  },
  rare: {
    weight: 25,
    ids: [
      1, 2, 4, 5, 7, 8, 25, 26, 37, 38, 51, 58, 59, 61, 62, 63, 64, 66, 67, 79,
      80, 81, 82, 84, 85, 86, 87, 90, 91, 92, 93, 95, 111, 112, 114, 120, 121,
      132, 134, 135, 136, 138, 139, 140, 141,
    ],
  },
  commun: {
    weight: 60,
    ids: [
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27, 28, 29,
      30, 31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
      52, 53, 54, 55, 56, 57, 60, 69, 70, 71, 72, 73, 74, 75, 77, 78, 83, 88, 89,
      96, 97, 98, 99, 100, 101, 102, 104, 105, 108, 109, 110, 116, 117, 118, 119,
      129,
    ],
  },
} as const

export function drawMysteryPokemonId() {
  const rarities = Object.values(pokemonByRarity)
  const totalWeight = rarities.reduce((total, rarity) => total + rarity.weight, 0)
  let roll = Math.random() * totalWeight
  let selected = rarities[rarities.length - 1]

  for (const rarity of rarities) {
    if (roll < rarity.weight) {
      selected = rarity
      break
    }
    roll -= rarity.weight
  }

  return selected.ids[Math.floor(Math.random() * selected.ids.length)]
}

export function drawPokemonIdByRarity(
  rarity: 'commun' | 'rare' | 'epique' | 'legendaire',
) {
  const tier = pokemonByRarity[rarity]
  return tier.ids[Math.floor(Math.random() * tier.ids.length)]
}

export function getPokemonRarityById(
  id: number,
): keyof typeof pokemonByRarity | null {
  for (const rarity of Object.keys(pokemonByRarity) as Array<
    keyof typeof pokemonByRarity
  >) {
    if (pokemonByRarity[rarity].ids.some((pokemonId) => pokemonId === id)) {
      return rarity
    }
  }
  return null
}
