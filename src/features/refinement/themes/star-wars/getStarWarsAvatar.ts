import { STAR_WARS_CHARACTER_IDS } from '../../../../../convex/user/starWarsCharacterIds'

export interface StarWarsCharacter {
  id: string
  name: string
  era?: string
  imageUrl: string
  description?: string
}

export type StarWarsRarity =
  'common' | 'rare' | 'epic' | 'legendary' | 'ultimate'

const API_ENDPOINT =
  'https://starwars-databank-server.onrender.com/api/v1/characters?page=1&limit=1000'
const CHARACTER_ENDPOINT =
  'https://starwars-databank-server.onrender.com/api/v1/characters'

const normalizeCharacterName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const CHARACTER_RARITIES: Record<string, StarWarsRarity> = {
  // --- ULTIMATE : Les icônes absolues de la pop culture ---
  [normalizeCharacterName('Darth Vader')]: 'ultimate',
  [normalizeCharacterName('Luke Skywalker')]: 'ultimate',
  [normalizeCharacterName('Yoda')]: 'ultimate',

  // --- LEGENDARY : Légendes incontournables et figures centrales (+ Uthar Wynn) ---
  [normalizeCharacterName('Han Solo')]: 'legendary',
  [normalizeCharacterName('Leia Organa')]: 'legendary',
  [normalizeCharacterName('Obi-Wan Kenobi')]: 'legendary',
  [normalizeCharacterName('Anakin Skywalker')]: 'legendary',
  [normalizeCharacterName('Emperor Palpatine / Darth Sidious')]: 'legendary',
  [normalizeCharacterName('Chewbacca')]: 'legendary',
  [normalizeCharacterName('R2-D2')]: 'legendary',
  [normalizeCharacterName('Boba Fett')]: 'legendary',
  [normalizeCharacterName('Uthar Wynn')]: 'legendary',

  // --- EPIC : Piliers majeurs, favoris des fans et persos ultra-populaires ---
  [normalizeCharacterName('Padmé Amidala')]: 'epic',
  [normalizeCharacterName('Ahsoka Tano')]: 'epic',
  [normalizeCharacterName('Din Djarin (The Mandalorian)')]: 'epic',
  [normalizeCharacterName('Grogu')]: 'epic',
  [normalizeCharacterName('Maul')]: 'epic',
  [normalizeCharacterName('Mace Windu')]: 'epic',
  [normalizeCharacterName('Qui-Gon Jinn')]: 'epic',
  [normalizeCharacterName('General Grievous')]: 'epic',
  [normalizeCharacterName('Count Dooku')]: 'epic',
  [normalizeCharacterName('Supreme Leader Kylo Ren')]: 'epic',
  [normalizeCharacterName('Rey')]: 'epic',
  [normalizeCharacterName('C-3PO (See-Threepio)')]: 'epic',
  [normalizeCharacterName('Jabba the Hutt')]: 'epic',
  [normalizeCharacterName('Jango Fett')]: 'epic',
  [normalizeCharacterName('Clone Captain Rex')]: 'epic',

  // --- RARE : Personnages secondaires solides, têtes d'affiche de spin-offs & favoris de niche ---
  [normalizeCharacterName('Lando Calrissian')]: 'rare',
  [normalizeCharacterName('Grand Admiral Thrawn')]: 'rare',
  [normalizeCharacterName('Bo-Katan Kryze')]: 'rare',
  [normalizeCharacterName('Cad Bane')]: 'rare',
  [normalizeCharacterName('Cassian Andor')]: 'rare',
  [normalizeCharacterName('Jyn Erso')]: 'rare',
  [normalizeCharacterName('Poe Dameron')]: 'rare',
  [normalizeCharacterName('Finn')]: 'rare',
  [normalizeCharacterName('Plo Koon')]: 'rare',
  [normalizeCharacterName('Kit Fisto')]: 'rare',
  [normalizeCharacterName('Asajj Ventress')]: 'rare',
  [normalizeCharacterName('Captain Phasma')]: 'rare',
  [normalizeCharacterName('Bossk')]: 'rare',
  [normalizeCharacterName('IG-88')]: 'rare',
}

export function getStarWarsCharacterRarity(name: string): StarWarsRarity {
  return CHARACTER_RARITIES[normalizeCharacterName(name)] ?? 'common'
}

const POPULAR_CHARACTER_NAMES = STAR_WARS_CHARACTER_IDS.map(({ name }) =>
  normalizeCharacterName(name),
)

const POPULAR_CHARACTER_RANK = new Map(
  POPULAR_CHARACTER_NAMES.map((name, index) => [name, index]),
)

interface ApiCharacter {
  _id: string
  name: string
  image?: string
  description?: string
}

interface ApiResponse {
  data: ApiCharacter[]
}

const UTHAR_WYNN: StarWarsCharacter = {
  id: 'uthar-wynn',
  name: 'Uthar Wynn',
  imageUrl:
    'https://static.wikia.nocookie.net/starwars/images/8/8a/Uthar_Wynn_Render.jpg/revision/latest?cb=20091118190912',
  description:
    'Maître Sith et directeur de l’Académie Sith sur Korriban pendant la Guerre Civile Jedi. Il apparaît dans Star Wars: Knights of the Old Republic.',
}

export async function getStarWarsAvatars(): Promise<StarWarsCharacter[]> {
  try {
    const response = await fetch(API_ENDPOINT)
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`)
    }
    const payload: ApiResponse = await response.json()

    return payload.data
      .filter(
        (char) =>
          char.image &&
          POPULAR_CHARACTER_RANK.has(normalizeCharacterName(char.name)),
      )
      .map((char): StarWarsCharacter => {
        return {
          id: char._id,
          name: char.name,
          imageUrl: char.image!,
          description: char.description,
        }
      })
      .concat(UTHAR_WYNN)
      .sort((first, second) => {
        const firstRank =
          POPULAR_CHARACTER_RANK.get(normalizeCharacterName(first.name)) ??
          Number.POSITIVE_INFINITY
        const secondRank =
          POPULAR_CHARACTER_RANK.get(normalizeCharacterName(second.name)) ??
          Number.POSITIVE_INFINITY

        return firstRank - secondRank
      })
  } catch (error) {
    console.error('Impossible de charger les avatars Star Wars :', error)
    return []
  }
}

export async function getRandomStarWarsAvatar(): Promise<StarWarsCharacter> {
  const selected =
    STAR_WARS_CHARACTER_IDS[
      Math.floor(Math.random() * STAR_WARS_CHARACTER_IDS.length)
    ]
  if (selected.id === UTHAR_WYNN.id) return UTHAR_WYNN

  const response = await fetch(`${CHARACTER_ENDPOINT}/${selected.id}`)
  if (!response.ok) {
    throw new Error(`Impossible de charger le personnage (${response.status}).`)
  }

  const character: ApiCharacter = await response.json()
  if (!character.image) {
    throw new Error('Ce personnage ne possède pas d’image disponible.')
  }

  return {
    id: character._id,
    name: character.name,
    imageUrl: character.image,
    description: character.description,
  }
}
