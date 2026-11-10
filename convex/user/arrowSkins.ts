/** Flèches cosmétiques du thème « Tir à l'arc » : aucun effet sur le jeu. */
export const arrowSkinCatalog = [
  {
    id: 'fire',
    name: 'Flèche de feu',
    description: 'Traînée de flammes et explosion de braises à l’impact.',
    price: 100,
  },
  {
    id: 'ice',
    name: 'Flèche de glace',
    description: 'Sillage de givre, éclats de glace, cible gelée sur place.',
    price: 100,
  },
  {
    id: 'rainbow',
    name: 'Flèche arc-en-ciel',
    description: 'Ruban arc-en-ciel et pluie de confettis à l’impact.',
    price: 100,
  },
  {
    id: 'dragon',
    name: 'Flèche du dragon',
    description:
      'Deux dragons spirituels s’enroulent autour de la flèche en plein vol.',
    price: 250,
  },
] as const

export type ArrowSkinId = (typeof arrowSkinCatalog)[number]['id']
