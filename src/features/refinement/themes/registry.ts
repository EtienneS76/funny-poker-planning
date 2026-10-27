import { DefaultRoom } from './default/DefaultRoom'
import type { Theme } from './types'
import { PokemonOnboardingLayer } from './pokemon/PokemonOnboardingLayer'
import './pokemon/pokemon.css'
import { StarWarsLayer } from './star-wars/StarWarsLayer'
import { AmongUsLayer } from './among-us/AmongUsLayer'

const defaultTheme: Theme = { id: 'default', Room: DefaultRoom }

// Un thème = au minimum un id + un fichier CSS scopé ([data-theme='<id>']).
// Il réutilise la vue par défaut tant que sa structure ne diffère pas.
const themes: Record<string, Theme> = {
  pk: { id: 'pk', Room: DefaultRoom, Layer: PokemonOnboardingLayer },
  sw: { id: 'sw', Room: DefaultRoom, Layer: StarWarsLayer },
  au: { id: 'au', Room: DefaultRoom, Layer: AmongUsLayer },
}

export function getTheme(universe: string | undefined): Theme {
  return (universe && themes[universe]) || defaultTheme
}
