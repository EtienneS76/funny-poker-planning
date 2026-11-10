/** Règles du thème « Tir à l'arc », partagées par les requêtes et les mutations. */
export const ARROWS_PER_ROUND = 2
export const POKISOUS_PER_HIT = 2
/** Points de vie par manche : une flèche au corps en retire 1, une flèche en pleine tête tue. */
export const HEALTH = 2
export const BODY_DAMAGE = 1
export const HEADSHOT_DAMAGE = HEALTH
/** Vitesse maximale d'une flèche, en unités du monde par seconde (le client tire à 2000 max). */
export const MAX_ARROW_SPEED = 2200
/** Monde logique du moteur : les tirs doivent partir de l'intérieur (avec une marge). */
export const WORLD_WIDTH = 2000
export const WORLD_HEIGHT = 900
/** Une flèche ne peut plus toucher personne après ce délai. */
export const SHOT_LIFETIME_MS = 12_000
/** Anti-triche, comme le Skirmish : pas de Pokisous à gagner seul avec deux onglets. */
export const MIN_ACTIVE_PARTICIPANTS = 3
export const MIN_AUTHENTICATED_PARTICIPANTS = 2
