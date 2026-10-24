import { useLayoutEffect, useState } from 'react'

export type Faction = 'alliance' | 'empire'

const STORAGE_KEY = 'sw-faction'

function readFaction(): Faction {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'empire' ? 'empire' : 'alliance'
  } catch {
    return 'alliance'
  }
}

/**
 * Faction choisie (mémorisée dans le navigateur). Elle est exposée en CSS via
 * <html data-sw-faction="alliance|empire">, ce qui permet à la barre (Layer) et
 * à la salle de partager les mêmes variables --sw-* sans état React commun.
 */
export function useFaction() {
  const [faction, setFaction] = useState<Faction>(readFaction)

  useLayoutEffect(() => {
    document.documentElement.dataset.swFaction = faction
    try {
      localStorage.setItem(STORAGE_KEY, faction)
    } catch {
      // stockage indisponible : la faction reste valable pour la session
    }
  }, [faction])

  useLayoutEffect(
    () => () => {
      delete document.documentElement.dataset.swFaction
    },
    [],
  )

  return [faction, setFaction] as const
}
