export const pokemonConsumableCatalog = [
  {
    id: 'poke-ball',
    name: 'Poké Ball',
    description: 'Une balle classique pour tenter de capturer un Pokémon.',
    price: 20,
    sprite:
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
    catchRates: {
      commun: 35,
      rare: 25,
      epique: 18,
      legendaire: 10,
      ultime: 5,
    },
  },
  {
    id: 'hyper-ball',
    name: 'Hyper Ball',
    description: 'Une balle puissante qui augmente tes chances de capture.',
    price: 40,
    sprite:
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
    catchRates: {
      commun: 80,
      rare: 65,
      epique: 45,
      legendaire: 25,
      ultime: 15,
    },
  },
  {
    id: 'master-ball',
    name: 'Master Ball',
    description: 'La balle ultime : elle garantit la capture.',
    price: 100,
    sprite:
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
    catchRates: {
      commun: 100,
      rare: 100,
      epique: 100,
      legendaire: 100,
      ultime: 100,
    },
  },
  {
    id: 'mystery-poke-ball',
    name: 'Poké Ball mystère',
    description: 'Une capsule scellée qui renferme un Pokémon aléatoire.',
    price: 100,
    sprite:
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dream-ball.png',
  },
  {
    id: 'shiny-poke-ball',
    name: 'Poké Ball shiny',
    description: 'Une capsule rare qui renferme un Pokémon shiny aléatoire.',
    price: 500,
    sprite:
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/park-ball.png',
  },
  {
    id: 'holocron',
    name: 'Holocron',
    description:
      'Un artefact ancien contenant une carte de personnage Star Wars.',
    price: 100,
    sprite: 'holocron',
  },
] as const
