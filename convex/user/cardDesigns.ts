export const cardDesignCatalog = [
  {
    id: 'neon-synthwave',
    name: 'Néon Synthwave',
    description: 'Grille néon, soleil rétro et scanline animée.',
    rarity: 'rare',
    price: 400,
    symbol: '✦',
  },
  {
    id: 'holo-prism',
    name: 'Holo Prisme',
    description: 'Foil holographique arc-en-ciel, grain et éclats.',
    rarity: 'epic',
    price: 900,
    symbol: '◈',
  },
  {
    id: 'golden-eclipse',
    name: 'Éclipse Dorée',
    description: 'Cadre d’or vivant, reflets mobiles et halo doré.',
    rarity: 'legendary',
    price: 2000,
    symbol: '♛',
  },
] as const

export type CardDesignId = (typeof cardDesignCatalog)[number]['id']