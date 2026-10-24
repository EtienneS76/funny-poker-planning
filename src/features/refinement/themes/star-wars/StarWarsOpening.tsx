import { useEffect, useRef, useState } from 'react'
import { Hexagon, PackageOpen } from 'lucide-react'
import type { CSSProperties, PointerEvent } from 'react'
import {
  getStarWarsCharacterRarity,
  type StarWarsCharacter,
  type StarWarsRarity,
} from './getStarWarsAvatar'
import '../../../../styles/star-wars-opening.css'

type Stage = 'idle' | 'claiming' | 'charging' | 'burst' | 'reveal' | 'named'

type Props = {
  character: StarWarsCharacter
  remainingHolocrons: number
  openingAnother: boolean
  onOpen: () => Promise<number>
  onOpenAnother: () => void
  onReturnToInventory: () => void
}

type Rarity = {
  label: string
  color: string
  shake: number
  particles: number
  ember: number
  colors: string[]
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  lifetime: number
  size: number
  color: string
  square: boolean
  rotation: number
  gravity: number
}

const RARITIES: Record<StarWarsRarity, Rarity> = {
  common: {
    label: 'Commune',
    color: '#9fb4c9',
    shake: 850,
    particles: 28,
    ember: 0,
    colors: ['#9fb4c9', '#ffffff'],
  },
  rare: {
    label: 'Rare',
    color: '#5cd6ff',
    shake: 950,
    particles: 48,
    ember: 0.2,
    colors: ['#5cd6ff', '#ffffff', '#1f6fe0'],
  },
  epic: {
    label: 'Épique',
    color: '#b7a2ff',
    shake: 1050,
    particles: 72,
    ember: 0.5,
    colors: ['#b7a2ff', '#ffffff', '#5cd6ff', '#ff6ad5'],
  },
  legendary: {
    label: 'Légendaire',
    color: '#ffc857',
    shake: 1200,
    particles: 104,
    ember: 0.9,
    colors: ['#ffc857', '#ffffff', '#ff9d00', '#fff3b0'],
  },
  ultimate: {
    label: 'Ultime',
    color: '#ff70dd',
    shake: 1300,
    particles: 120,
    ember: 1,
    colors: ['#ff70dd', '#ffffff', '#9b7aff', '#ffc857'],
  },
}

export default function StarWarsOpening({
  character,
  remainingHolocrons,
  openingAnother,
  onOpen,
  onOpenAnother,
  onReturnToInventory,
}: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [holocronsRemaining, setHolocronsRemaining] =
    useState(remainingHolocrons)
  const rarityKey = getStarWarsCharacterRarity(character.name)
  const canvas = useRef<HTMLCanvasElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const particles = useRef<Particle[]>([])
  const timers = useRef<number[]>([])
  const stageRef = useRef<Stage>('idle')
  const rarityRef = useRef<Rarity>(RARITIES[rarityKey])
  const reducedMotion = useRef(false)
  const rarity = RARITIES[rarityKey]

  function changeStage(nextStage: Stage) {
    stageRef.current = nextStage
    setStage(nextStage)
  }

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    return () => timers.current.forEach(window.clearTimeout)
  }, [])

  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, milliseconds))
    })
  }

  async function openPackage() {
    if (stageRef.current !== 'idle' || openingAnother) return
    changeStage('claiming')
    try {
      setHolocronsRemaining(await onOpen())
    } catch {
      changeStage('idle')
      return
    }

    changeStage('charging')
    await wait(reducedMotion.current ? 80 : rarity.shake)
    changeStage('burst')

    const bounds = canvas.current?.getBoundingClientRect()
    if (bounds) {
      const particleCount = reducedMotion.current ? 10 : rarity.particles
      for (let index = 0; index < particleCount; index += 1) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 10
        particles.current.push({
          x: bounds.width / 2,
          y: bounds.height * 0.44,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          age: 0,
          lifetime: 50 + Math.random() * 60,
          size: 1.5 + Math.random() * 3.5,
          color: rarity.colors[index % rarity.colors.length],
          square:
            (rarityKey === 'legendary' || rarityKey === 'ultimate') &&
            index % 3 === 0,
          rotation: Math.random() * Math.PI * 2,
          gravity: 0.12,
        })
      }
    }

    await wait(reducedMotion.current ? 0 : 300)
    changeStage('reveal')
    await wait(reducedMotion.current ? 0 : 750)
    changeStage('named')
  }

  function tiltCard(event: PointerEvent<HTMLDivElement>) {
    const element = card.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    element.style.setProperty('--sw-tilt-x', `${x * 14}deg`)
    element.style.setProperty('--sw-tilt-y', `${y * -14}deg`)
    element.style.setProperty(
      '--sw-pointer-x',
      `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
    )
    element.style.setProperty(
      '--sw-pointer-y',
      `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
    )
  }

  function resetCardTilt() {
    card.current?.style.setProperty('--sw-tilt-x', '0deg')
    card.current?.style.setProperty('--sw-tilt-y', '0deg')
  }

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const context = element.getContext('2d')
    if (!context) return
    const drawingCanvas = element as HTMLCanvasElement
    const drawingContext = context as CanvasRenderingContext2D

    let animationFrame = 0
    let width = 0
    let height = 0
    let pixelRatio = 1

    function resize() {
      const bounds = drawingCanvas.getBoundingClientRect()
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      drawingCanvas.width = Math.round(width * pixelRatio)
      drawingCanvas.height = Math.round(height * pixelRatio)
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    function addEmber(color: string) {
      particles.current.push({
        x: width * (0.3 + Math.random() * 0.4),
        y: height * 0.78,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(1 + Math.random() * 2),
        age: 0,
        lifetime: 100,
        size: 1 + Math.random() * 2,
        color,
        square: false,
        rotation: 0,
        gravity: -0.004,
      })
    }

    function draw() {
      if (
        stageRef.current === 'reveal' &&
        Math.random() < rarityRef.current.ember * 0.12
      ) {
        addEmber(rarityRef.current.color)
      }

      drawingContext.clearRect(0, 0, width, height)
      drawingContext.globalCompositeOperation = 'lighter'
      particles.current = particles.current.filter(
        (particle) => particle.age < particle.lifetime,
      )

      for (const particle of particles.current) {
        particle.age += 1
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += particle.gravity
        particle.vx *= 0.992
        const opacity = 1 - particle.age / particle.lifetime
        drawingContext.globalAlpha = opacity
        drawingContext.fillStyle = particle.color
        if (particle.square) {
          particle.rotation += 0.2
          drawingContext.save()
          drawingContext.translate(particle.x, particle.y)
          drawingContext.rotate(particle.rotation)
          drawingContext.fillRect(
            -particle.size,
            -particle.size * 0.5,
            particle.size * 2,
            particle.size,
          )
          drawingContext.restore()
        } else {
          drawingContext.beginPath()
          drawingContext.arc(
            particle.x,
            particle.y,
            particle.size * opacity + 0.5,
            0,
            Math.PI * 2,
          )
          drawingContext.fill()
        }
      }
      drawingContext.globalAlpha = 1
      drawingContext.globalCompositeOperation = 'source-over'
      animationFrame = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animationFrame = window.requestAnimationFrame(draw)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <main
      className={`sw-opening sw-opening--${stage}`}
      data-rarity={rarityKey}
      style={
        {
          '--sw-color': rarity.color,
        } as CSSProperties
      }
    >
      <canvas className='sw-opening-fx' ref={canvas} aria-hidden='true' />
      <div className='sw-opening-flash' aria-hidden='true' />
      <div className='sw-opening-ring' aria-hidden='true' />

      <button
        className='sw-opening-pack'
        type='button'
        aria-label='Cliquer pour ouvrir le Holocron'
        disabled={stage !== 'idle' || openingAnother}
        onClick={() => void openPackage()}
      >
        <div className='sw-opening-pack-float'>
          <div className='sw-opening-pack-face sw-opening-pack-top'>
            <div className='sw-opening-holocron'>
              <Hexagon strokeWidth={1.4} />
              <strong>HOLOCRON</strong>
              <span>Paquet de fin de refinement</span>
            </div>
          </div>
          <div className='sw-opening-pack-face sw-opening-pack-bottom'>
            <div className='sw-opening-holocron'>
              <Hexagon strokeWidth={1.4} />
              <strong>HOLOCRON</strong>
              <span>Paquet de fin de refinement</span>
            </div>
          </div>
        </div>
      </button>

      <div className='sw-opening-card-wrap'>
        <div
          className='sw-opening-card'
          ref={card}
          onPointerMove={tiltCard}
          onPointerLeave={resetCardTilt}
        >
          <div className='sw-opening-card-inner'>
            <article className='sw-opening-card-front'>
              <div className='sw-opening-card-art'>
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  onError={(event) => {
                    event.currentTarget.hidden = true
                  }}
                />
              </div>
              <div className='sw-opening-card-meta'>
                <small
                  className={`sw-opening-card-rarity sw-opening-card-rarity--${rarityKey}`}
                >
                  {rarity.label}
                </small>
                <strong>{character.name}</strong>
              </div>
            </article>
            <div className='sw-opening-card-shine' />
            <div className='sw-opening-card-glare' />
          </div>
        </div>
      </div>

      <div className='sw-opening-controls'>
        {stage !== 'named' ? (
          <p className='sw-opening-caption' role='status'>
            {stage === 'idle'
              ? 'Cliquer pour ouvrir'
              : stage === 'claiming'
                ? 'Préparation du tirage…'
                : 'Ouverture du Holocron…'}
          </p>
        ) : (
          <>
            <p className='sw-opening-success' role='status'>
              Carte ajoutée à votre collection
            </p>
            <div className='sw-opening-actions'>
              {holocronsRemaining > 0 && (
                <button
                  className='sw-opening-new-pack'
                  type='button'
                  disabled={openingAnother}
                  onClick={onOpenAnother}
                >
                  <PackageOpen size={17} aria-hidden='true' />
                  {openingAnother ? 'Préparation…' : 'Ouvrir un nouveau paquet'}
                </button>
              )}
              <button
                className='sw-opening-return'
                type='button'
                onClick={onReturnToInventory}
              >
                Retourner dans les consommables
              </button>
            </div>
          </>
        )}
      </div>

      <p className='sw-opening-sr' aria-live='polite'>
        {stage === 'named' ? `${character.name}, rareté ${rarity.label}.` : ''}
      </p>
    </main>
  )
}
