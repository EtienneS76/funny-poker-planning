import { useLayoutEffect, useSyncExternalStore } from 'react'

export type Faction = 'alliance' | 'empire'

const STORAGE_KEY = 'sw-faction'

function readFaction(): Faction {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'empire' ? 'empire' : 'alliance'
  } catch {
    return 'alliance'
  }
}

// Petit store partagé : le switch de camp et l'escarmouche lisent la même valeur.
let current: Faction = readFaction()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setFaction(next: Faction) {
  if (next === current) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // stockage indisponible : la faction reste valable pour la session
  }
  listeners.forEach((listener) => listener())
}

/**
 * Faction choisie (mémorisée dans le navigateur). Elle est exposée en CSS via
 * <html data-sw-faction="alliance|empire"> pour que la barre, la salle et les
 * couches du thème partagent les mêmes variables --sw-*.
 */
export function useFaction() {
  const faction = useSyncExternalStore(
    subscribe,
    () => current,
    (): Faction => 'alliance',
  )

  useLayoutEffect(() => {
    document.documentElement.dataset.swFaction = faction
  }, [faction])

  useLayoutEffect(
    () => () => {
      delete document.documentElement.dataset.swFaction
    },
    [],
  )

  return [faction, setFaction] as const
}
