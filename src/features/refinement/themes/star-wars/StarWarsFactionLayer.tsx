import { useEffect } from 'react'
import { useFaction, type Faction } from './useFaction'
import '../../../../styles/star-wars.css'

const FACTIONS: { id: Faction; label: string }[] = [
  { id: 'alliance', label: 'Alliance' },
  { id: 'empire', label: 'Empire' },
]

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap'

/** Switch flottant à gauche : choix du camp (Alliance bleue / Empire rouge). */
export function StarWarsFactionLayer() {
  const [faction, setFaction] = useFaction()

  // Polices du thème, chargées uniquement quand ce thème est affiché
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS_URL
    document.head.append(link)
    return () => link.remove()
  }, [])

  return (
    <div
      className='sw-faction-switch'
      role='group'
      aria-label='Choisir son camp'
    >
      {FACTIONS.map(({ id, label }) => (
        <button
          key={id}
          type='button'
          className={`sw-faction-button sw-faction-button--${id}`}
          aria-pressed={faction === id}
          onClick={() => setFaction(id)}
        >
          <span className='sw-faction-dot' aria-hidden='true' />
          {label}
        </button>
      ))}
    </div>
  )
}
