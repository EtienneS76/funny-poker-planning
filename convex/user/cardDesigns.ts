export const cardDesignCatalog = [
  {
    id: 'neon-synthwave',
    name: 'Néon Synthwave',
    description: 'Grille néon, soleil rétro et scanline animée.',
    rarity: 'rare',
    price: 250,
    symbol: '✦',
  },
  {
    id: 'holo-prism',
    name: 'Holo Prisme',
    description: 'Foil holographique arc-en-ciel, grain et éclats.',
    rarity: 'epic',
    price: 500,
    symbol: '◈',
  },
  {
    id: 'golden-eclipse',
    name: 'Éclipse Dorée',
    description: 'Cadre d’or vivant, reflets mobiles et halo doré.',
    rarity: 'legendary',
    price: 1000,
    symbol: '♛',
  },
] as const

export type CardDesignId = (typeof cardDesignCatalog)[number]['id']
