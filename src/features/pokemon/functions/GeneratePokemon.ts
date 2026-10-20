// Define rarity types
export type PokemonRarity =
  'commun' | 'rare' | 'epique' | 'legendaire' | 'ultime'

export type PokemonType =
  | 'normal'
  | 'combat'
  | 'vol'
  | 'poison'
  | 'sol'
  | 'roche'
  | 'insecte'
  | 'spectre'
  | 'acier'
  | 'feu'
  | 'eau'
  | 'plante'
  | 'electrik'
  | 'psy'
  | 'glace'
  | 'dragon'
  | 'tenebres'
  | 'fee'

// Represents the output of a generated Pokemon
export interface GeneratedPokemon {
  id: number
  name: string
  rarity: PokemonRarity
  types: PokemonType[]
  gifUrl: string
}

interface RarityTierData {
  weight: number
  pokemons: { id: number; name: string }[]
}

const BASE_URL =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'
const POKEMON_3D_BASE_URL =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/lets-go-pikachu-lets-go-eevee'
// Configuration table with weight & Pokemon entries (IDs 1 to 151)
const POKEDEX_TIERS: Record<PokemonRarity, RarityTierData> = {
  ultime: {
    weight: 1, // 1%
    pokemons: [
      { id: 150, name: 'Mewtwo' },
      { id: 151, name: 'Mew' },
    ],
  },
  legendaire: {
    weight: 4, // 4%
    pokemons: [
      { id: 144, name: 'Artikodin' },
      { id: 145, name: 'Électhor' },
      { id: 146, name: 'Sulfura' },
    ],
  },
  epique: {
    weight: 10, // 10%
    pokemons: [
      { id: 3, name: 'Florizarre' },
      { id: 6, name: 'Dracaufeu' },
      { id: 9, name: 'Tortank' },
      { id: 65, name: 'Alakazam' },
      { id: 68, name: 'Mackogneur' },
      { id: 76, name: 'Grolem' },
      { id: 94, name: 'Ectoplasma' },
      { id: 103, name: 'Noadkoko' },
      { id: 107, name: 'Tygnon' },
      { id: 106, name: 'Kicklee' },
      { id: 113, name: 'Leveinard' },
      { id: 115, name: 'Kangourex' },
      { id: 122, name: 'M. Mime' },
      { id: 123, name: 'Insécateur' },
      { id: 124, name: 'Lippoutou' },
      { id: 125, name: 'Élektek' },
      { id: 126, name: 'Magmar' },
      { id: 127, name: 'Scarabrute' },
      { id: 128, name: 'Tauros' },
      { id: 130, name: 'Léviator' },
      { id: 131, name: 'Lokhlass' },
      { id: 133, name: 'Évoli' },
      { id: 137, name: 'Porygon' },
      { id: 142, name: 'Ptéra' },
      { id: 143, name: 'Ronflex' },
      { id: 147, name: 'Minidraco' },
      { id: 148, name: 'Draco' },
      { id: 149, name: 'Dracolosse' },
    ],
  },
  rare: {
    weight: 25, // 25%
    pokemons: [
      { id: 1, name: 'Bulbizarre' },
      { id: 2, name: 'Herbizarre' },
      { id: 4, name: 'Salamèche' },
      { id: 5, name: 'Reptincel' },
      { id: 7, name: 'Carapuce' },
      { id: 8, name: 'Carabaffe' },
      { id: 25, name: 'Pikachu' },
      { id: 26, name: 'Raichu' },
      { id: 37, name: 'Goupix' },
      { id: 38, name: 'Feunard' },
      { id: 51, name: 'Triopikeur' },
      { id: 58, name: 'Caninos' },
      { id: 59, name: 'Arcanin' },
      { id: 61, name: 'Têtarte' },
      { id: 62, name: 'Tartard' },
      { id: 63, name: 'Abra' },
      { id: 64, name: 'Kadabra' },
      { id: 66, name: 'Machoc' },
      { id: 67, name: 'Machopeur' },
      { id: 79, name: 'Ramoloss' },
      { id: 80, name: 'Flagadoss' },
      { id: 81, name: 'Magnéti' },
      { id: 82, name: 'Magnéton' },
      { id: 84, name: 'Doduo' },
      { id: 85, name: 'Dodrio' },
      { id: 86, name: 'Otaria' },
      { id: 87, name: 'Lamantine' },
      { id: 90, name: 'Kokiyas' },
      { id: 91, name: 'Crustabri' },
      { id: 92, name: 'Fantominus' },
      { id: 93, name: 'Spectrum' },
      { id: 95, name: 'Onix' },
      { id: 111, name: 'Rhinocorne' },
      { id: 112, name: 'Rhinoférox' },
      { id: 114, name: 'Saquedeneu' },
      { id: 120, name: 'Stari' },
      { id: 121, name: 'Staross' },
      { id: 132, name: 'Métamorph' },
      { id: 134, name: 'Aquali' },
      { id: 135, name: 'Voltali' },
      { id: 136, name: 'Pyroli' },
      { id: 138, name: 'Amonita' },
      { id: 139, name: 'Amonistar' },
      { id: 140, name: 'Kabuto' },
      { id: 141, name: 'Kabutops' },
    ],
  },
  commun: {
    weight: 60, // 60%
    pokemons: [
      { id: 10, name: 'Chenipan' },
      { id: 11, name: 'Chrysacier' },
      { id: 12, name: 'Papilusion' },
      { id: 13, name: 'Aspicot' },
      { id: 14, name: 'Coconfort' },
      { id: 15, name: 'Dardargnan' },
      { id: 16, name: 'Roucool' },
      { id: 17, name: 'Roucoups' },
      { id: 18, name: 'Roucarnage' },
      { id: 19, name: 'Rattata' },
      { id: 20, name: 'Rattatac' },
      { id: 21, name: 'Piafabec' },
      { id: 22, name: 'Rapasdepic' },
      { id: 23, name: 'Abo' },
      { id: 24, name: 'Arbok' },
      { id: 27, name: 'Sablette' },
      { id: 28, name: 'Sablaireau' },
      { id: 29, name: 'Nidoran♀' },
      { id: 30, name: 'Nidorina' },
      { id: 31, name: 'Nidoqueen' },
      { id: 32, name: 'Nidoran♂' },
      { id: 33, name: 'Nidorino' },
      { id: 34, name: 'Nidoking' },
      { id: 35, name: 'Mélofée' },
      { id: 36, name: 'Mélodelfe' },
      { id: 39, name: 'Rondoudou' },
      { id: 40, name: 'Grodoudou' },
      { id: 41, name: 'Nosferapti' },
      { id: 42, name: 'Nosferalto' },
      { id: 43, name: 'Mystherbe' },
      { id: 44, name: 'Ortide' },
      { id: 45, name: 'Rafflesia' },
      { id: 46, name: 'Paras' },
      { id: 47, name: 'Parasect' },
      { id: 48, name: 'Mimitoss' },
      { id: 49, name: 'Aéromite' },
      { id: 50, name: 'Taupiqueur' },
      { id: 52, name: 'Miaouss' },
      { id: 53, name: 'Persian' },
      { id: 54, name: 'Psykokwak' },
      { id: 55, name: 'Akwakwak' },
      { id: 56, name: 'Férosinge' },
      { id: 57, name: 'Colossinge' },
      { id: 60, name: 'Ptitard' },
      { id: 69, name: 'Chétiflor' },
      { id: 70, name: 'Boustiflor' },
      { id: 71, name: 'Empiflor' },
      { id: 72, name: 'Tentacool' },
      { id: 73, name: 'Tentacruel' },
      { id: 74, name: 'Racaillou' },
      { id: 75, name: 'Gravalanch' },
      { id: 77, name: 'Ponyta' },
      { id: 78, name: 'Galopa' },
      { id: 83, name: 'Canarticho' },
      { id: 88, name: 'Tadmorv' },
      { id: 89, name: 'Grotadmorv' },
      { id: 96, name: 'Soporifik' },
      { id: 97, name: 'Hypnomade' },
      { id: 98, name: 'Krabby' },
      { id: 99, name: 'Krabboss' },
      { id: 100, name: 'Voltorbe' },
      { id: 101, name: 'Électrode' },
      { id: 102, name: 'Noeunoeuf' },
      { id: 104, name: 'Osselait' },
      { id: 105, name: 'Ossatueur' },
      { id: 108, name: 'Excelangue' },
      { id: 109, name: 'Smogo' },
      { id: 110, name: 'Smogogo' },
      { id: 116, name: 'Hypocampe' },
      { id: 117, name: 'Hypocéan' },
      { id: 118, name: 'Poisseneau' },
      { id: 119, name: 'Poissoroy' },
      { id: 129, name: 'Magicarpe' },
    ],
  },
}

const TYPES_BY_POKEDEX_ID: PokemonType[][] = `
plante,poison|plante,poison|plante,poison|feu|feu|feu,vol|eau|eau|eau|insecte
|insecte|insecte,vol|insecte,poison|insecte,poison|insecte,poison|normal,vol|normal,vol|normal,vol|normal|normal
|normal,vol|normal,vol|poison|poison|electrik|electrik|sol|sol|poison|poison
|poison,sol|poison|poison|poison,sol|fee|fee|feu|feu|normal,fee|normal,fee
|poison,vol|poison,vol|plante,poison|plante,poison|plante,poison|insecte,plante|insecte,plante|insecte,poison|insecte,poison
|sol|sol|normal|normal|eau|eau|combat|combat|feu|feu
|eau|eau|eau,combat|psy|psy|psy|combat|combat|combat|plante,poison
|plante,poison|plante,poison|eau,poison|eau,poison|roche,sol|roche,sol|roche,sol|feu|feu
|eau,psy|eau,psy|electrik,acier|electrik,acier|normal,vol|normal,vol|normal,vol|eau|eau,glace
|poison|poison|eau|eau,glace|spectre,poison|spectre,poison|spectre,poison|roche,sol|psy|psy
|eau|eau|electrik|electrik|plante,psy|plante,psy|sol|sol|combat|combat
|normal|poison|poison|sol,roche|sol,roche|normal|plante|normal|eau|eau
|eau|eau|eau|eau,psy|psy,fee|insecte,vol|glace,psy|electrik|feu
|insecte|normal|eau|eau,vol|eau,glace|normal|normal|eau|electrik|feu
|normal|roche,eau|roche,eau|roche,eau|roche,eau|roche,vol|normal|glace,vol|electrik,vol|feu,vol
|dragon|dragon|dragon,vol|psy|psy
`.trim().split(/\s*\|\s*/).map((types) => types.split(',') as PokemonType[])

/**
 * Generates a random Pokemon based on rarity weights.
 */
export function getRandomPokemon(): GeneratedPokemon {
  const rarities = Object.keys(POKEDEX_TIERS) as PokemonRarity[]
  const totalWeight = rarities.reduce(
    (acc, rarity) => acc + POKEDEX_TIERS[rarity].weight,
    0,
  )

  // Pick a random float between 0 and totalWeight
  let randomRoll = Math.random() * totalWeight
  let selectedRarity: PokemonRarity = 'commun'

  // Determine rarity tier based on roll
  for (const rarity of rarities) {
    if (randomRoll < POKEDEX_TIERS[rarity].weight) {
      selectedRarity = rarity
      break
    }
    randomRoll -= POKEDEX_TIERS[rarity].weight
  }

  // Pick a random Pokemon inside the selected tier
  const tierList = POKEDEX_TIERS[selectedRarity].pokemons
  const randomIndex = Math.floor(Math.random() * tierList.length)
  const selectedPokemon = tierList[randomIndex]

  return {
    id: selectedPokemon.id,
    name: selectedPokemon.name,
    rarity: selectedRarity,
    types: getPokemonTypes(selectedPokemon.id),
    gifUrl: `${BASE_URL}/${selectedPokemon.id}.png`,
  }
}

export function getPokemonTypes(id: number): PokemonType[] {
  return TYPES_BY_POKEDEX_ID[id - 1] ?? []
}

export function getPokemonImageUrl(id: number, use3d: boolean): string {
  return `${use3d ? POKEMON_3D_BASE_URL : BASE_URL}/${id}.${use3d ? 'gif' : 'png'}`
}

export function getPokemonById(id: number): GeneratedPokemon | null {
  for (const [rarity, tier] of Object.entries(POKEDEX_TIERS) as [
    PokemonRarity,
    RarityTierData,
  ][]) {
    const pokemon = tier.pokemons.find((entry) => entry.id === id)
    if (pokemon) {
      return {
        ...pokemon,
        rarity,
        types: getPokemonTypes(pokemon.id),
        gifUrl: `${BASE_URL}/${pokemon.id}.png`,
      }
    }
  }
  return null
}
