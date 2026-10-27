import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Crosshair } from 'lucide-react'
import type { RoomProps } from '../types'
import { useFaction, type Faction } from './useFaction'
import './star-wars-skirmish.css'

/**
 * Escarmouche : pendant que tu attends les autres joueurs (tu as voté, les
 * cartes ne sont pas révélées), des vaisseaux traversent l'écran. Clique pour
 * les abattre. Alliance : lasers rouges contre des chasseurs impériaux.
 * Empire : lasers verts contre des chasseurs rebelles.
 *
 * La progression des 10 destructions est suivie côté serveur par refinement.
 */

type Ship = {
  id: number
  fromLeft: boolean
  y: number // % de la hauteur de la fenêtre
  duration: number // secondes
  size: number // px
}
type Shot = { id: number; x: number; y: number; length: number; angle: number }
type Blast = { id: number; x: number; y: number; value: number }
type Stats = { enabled: boolean }

const MAX_SHIPS = 3
const FIRST_SHIP_DELAY_MS = 1200
const SPAWN_MIN_MS = 4500
const SPAWN_MAX_MS = 7000
const STORAGE_KEY = 'sw-skirmish'
const SPARKS = 10

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function makeShip(id: number): Ship {
  const duration = Math.random() < 0.35 ? rand(2.4, 3.8) : rand(3.8, 5.4)
  return {
    id,
    fromLeft: Math.random() < 0.5,
    y: rand(14, 78),
    duration,
    size: rand(60, 76),
  }
}

function readStats(): Stats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stats>
      return {
        enabled: parsed.enabled !== false,
      }
    }
  } catch {
    // données illisibles : on repart de zéro
  }
  return { enabled: true }
}

// Alliance : on affronte des chasseurs impériaux ; Empire : des chasseurs rebelles
function ShipArt({ faction }: { faction: Faction }) {
  return faction === 'alliance' ? (
    <svg viewBox='0 0 64 64' aria-hidden='true'>
      <path d='M30 32h4' stroke='#59636d' strokeWidth='4' />
      <rect x='14' y='29.5' width='36' height='5' fill='#59636d' />
      <path
        d='M5 13 15 7v50L5 51z'
        fill='#2b333c'
        stroke='#0f1418'
        strokeWidth='2'
      />
      <path
        d='M59 13 49 7v50l10-6z'
        fill='#2b333c'
        stroke='#0f1418'
        strokeWidth='2'
      />
      <path
        d='M10 14v36M54 14v36M5 32h10M49 32h10'
        stroke='#59636d'
        strokeWidth='1.5'
      />
      <circle
        cx='32'
        cy='32'
        r='10'
        fill='#3a4650'
        stroke='#0f1418'
        strokeWidth='2'
      />
      <circle cx='32' cy='32' r='4.5' fill='#8fb7d8' />
    </svg>
  ) : (
    <svg viewBox='0 0 64 64' aria-hidden='true'>
      <path
        d='M22 29 33 8h7l-5 21z'
        fill='#d9e0e8'
        stroke='#5d6b79'
        strokeWidth='2'
      />
      <path
        d='M22 35 33 56h7l-5-21z'
        fill='#d9e0e8'
        stroke='#5d6b79'
        strokeWidth='2'
      />
      <rect x='31' y='4' width='12' height='7' rx='2' fill='#e5212e' />
      <rect x='31' y='53' width='12' height='7' rx='2' fill='#e5212e' />
      <path
        d='M5 32 46 26l13 6-13 6z'
        fill='#f1f4f7'
        stroke='#5d6b79'
        strokeWidth='2'
      />
      <circle cx='40' cy='32' r='3' fill='#1f6fe0' />
    </svg>
  )
}

export function StarWarsSkirmishLayer({ vm }: RoomProps) {
  const [faction] = useFaction()
  const [stats, setStats] = useState<Stats>(readStats)
  const [ships, setShips] = useState<Ship[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [blasts, setBlasts] = useState<Blast[]>([])
  const nextId = useRef(0)
  const hitIds = useRef(new Set<number>())
  const [reduceMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const { revealed } = vm.table
  const { selectedCard, isSpectator } = vm.hand
  // On joue dans le temps mort : vote posé (ou spectateur) et cartes pas encore révélées
  const active =
    stats.enabled &&
    !reduceMotion &&
    vm.skirmish.eligible &&
    !vm.skirmish.progress?.rewarded &&
    !revealed &&
    (selectedCard !== null || isSpectator)
  const shipsDestroyed = vm.skirmish.progress?.shipsDestroyed ?? 0
  const objectiveProgress = Math.min(shipsDestroyed, 10)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
    } catch {
      // stockage indisponible : les stats restent valables pour la session
    }
  }, [stats])

  // Apparition des vaisseaux, uniquement tant que le jeu est actif
  useEffect(() => {
    if (!active) {
      setShips([])
      return
    }
    let timer = 0
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          const ship = makeShip(nextId.current++)
          setShips((previous) =>
            previous.length >= MAX_SHIPS ? previous : [...previous, ship],
          )
        }
        schedule(rand(SPAWN_MIN_MS, SPAWN_MAX_MS))
      }, delay)
    }
    schedule(FIRST_SHIP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  function removeShip(id: number) {
    setShips((previous) => previous.filter((ship) => ship.id !== id))
  }

  function shoot(ship: Ship, target: HTMLElement) {
    if (hitIds.current.has(ship.id)) return
    hitIds.current.add(ship.id)

    const rect = target.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    // Le canon est en bas au centre de l'écran
    const originX = window.innerWidth / 2
    const originY = window.innerHeight + 8
    const dx = x - originX
    const dy = y - originY
    const id = nextId.current++

    setShots((previous) => [
      ...previous,
      {
        id,
        x: originX,
        y: originY,
        length: Math.hypot(dx, dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      },
    ])
    setBlasts((previous) => [...previous, { id, x, y, value: 1 }])
    removeShip(ship.id)
    if (vm.account.isAuthenticated) {
      void vm.skirmish.recordDestroyedShip()
    }
  }

  if (reduceMotion) return null

  return (
    <>
      <div className='sw-skirmish' data-faction={faction}>
        {ships.map((ship) => (
          <div
            key={ship.id}
            aria-hidden='true'
            className={`sw-ship sw-ship--${ship.fromLeft ? 'ltr' : 'rtl'}`}
            style={
              {
                '--y': `${ship.y}vh`,
                '--dur': `${ship.duration}s`,
                '--size': `${ship.size}px`,
              } as CSSProperties
            }
            onPointerDown={(event) => shoot(ship, event.currentTarget)}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) removeShip(ship.id)
            }}
          >
            <div className='sw-ship-art'>
              <ShipArt faction={faction} />
            </div>
          </div>
        ))}

        {shots.map((shot) => (
          <i
            key={shot.id}
            className='sw-bolt'
            style={
              {
                left: shot.x,
                top: shot.y,
                width: shot.length,
                rotate: `${shot.angle}deg`,
              } as CSSProperties
            }
            onAnimationEnd={() =>
              setShots((previous) =>
                previous.filter((item) => item.id !== shot.id),
              )
            }
          />
        ))}

        {blasts.map((blast) => (
          <div
            key={blast.id}
            className='sw-blast'
            style={{ left: blast.x, top: blast.y }}
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget) return
              setBlasts((previous) =>
                previous.filter((item) => item.id !== blast.id),
              )
            }}
          >
            <i className='sw-blast-ring' />
            {Array.from({ length: SPARKS }, (_, index) => {
              const angle = (index / SPARKS) * Math.PI * 2
              return (
                <i
                  key={index}
                  className='sw-spark'
                  style={
                    {
                      '--dx': `${Math.cos(angle) * 54}px`,
                      '--dy': `${Math.sin(angle) * 54}px`,
                    } as CSSProperties
                  }
                />
              )
            })}
            <b className='sw-plus'>+{blast.value}</b>
          </div>
        ))}
      </div>

      <div className='sw-skirmish-hud' data-faction={faction}>
        <button
          type='button'
          className='sw-skirmish-toggle'
          aria-pressed={stats.enabled}
          onClick={() =>
            setStats((previous) => ({
              ...previous,
              enabled: !previous.enabled,
            }))
          }
        >
          <Crosshair size={16} aria-hidden='true' />
          Escarmouche
        </button>
        {stats.enabled && (
          <div className='sw-skirmish-score'>
            <div
              className='sw-skirmish-bar'
              role='progressbar'
              aria-label='Objectif du Skirmish'
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={objectiveProgress}
            >
              <i
                style={{
                  width: `${(objectiveProgress / 10) * 100}%`,
                }}
              />
            </div>
            <span>
              {vm.account.isAuthenticated
                ? `${shipsDestroyed}/10 vaisseaux`
                : 'Connecte-toi pour suivre l’objectif'}
            </span>

            {!active && (
              <small>
                {vm.skirmish.progress?.rewarded
                  ? 'Objectif terminé'
                  : !vm.skirmish.eligible
                    ? '3 joueurs actifs, dont 2 authentifiés, requis'
                    : revealed
                      ? 'En attente de la prochaine manche'
                      : 'Vote pour lancer l’escarmouche'}
              </small>
            )}
          </div>
        )}
      </div>
    </>
  )
}
