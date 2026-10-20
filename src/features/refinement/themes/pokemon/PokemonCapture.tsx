import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PokemonRarity } from '../../../pokemon/functions/GeneratePokemon'

type CapturePhase =
  'ready' | 'throw' | 'absorb' | 'drop' | 'shake' | 'caught' | 'escaped'

type CaptureBall = {
  id: 'poke-ball' | 'hyper-ball' | 'master-ball'
  name: string
  chance: number
  top: string
  bottom: string
  quantity: number
}

type CaptureResult = {
  captured: boolean
  ballsLeft: number
}

type Props = {
  name: string
  rarity: PokemonRarity
  imageSrc: string
  fallbackImageSrc: string
  balls: CaptureBall[] | undefined
  isAuthenticated: boolean
  signInPending: boolean
  onSignIn: () => void
  onThrow: (ballId: CaptureBall['id']) => Promise<CaptureResult>
  onClose: () => void
  onFinish: () => void
}

const rarityAccents: Record<PokemonRarity, string> = {
  commun: '#5a8f63',
  rare: '#3f86f5',
  epique: '#8b5cf6',
  legendaire: '#e0a413',
  ultime: '#e0a413',
}
const confettiColors = [
  '#ffd54a',
  '#ff6b6b',
  '#5ee0a0',
  '#6ab7ff',
  '#c58bff',
  '#fff',
]
const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function captureVars(values: Record<string, string>): CSSProperties {
  return values as CSSProperties
}

export function PokemonCapture({
  name,
  rarity,
  imageSrc,
  fallbackImageSrc,
  balls,
  isAuthenticated,
  signInPending,
  onSignIn,
  onThrow,
  onClose,
  onFinish,
}: Props) {
  const [phase, setPhase] = useState<CapturePhase>('ready')
  const [shakeCount, setShakeCount] = useState(0)
  const [ballsLeft, setBallsLeft] = useState(0)
  const [throwPending, setThrowPending] = useState(false)
  const [choosingBall, setChoosingBall] = useState(false)
  const [selectedBallId, setSelectedBallId] = useState<
    CaptureBall['id'] | null
  >(null)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [image, setImage] = useState(imageSrc)
  const alive = useRef(true)
  const mutedRef = useRef(false)
  const audio = useRef<AudioContext | null>(null)
  const accent = rarityAccents[rarity]
  const selectedBall = balls?.find((item) => item.id === selectedBallId)
  const previewBall = selectedBall ?? {
    id: 'poke-ball' as const,
    name: 'Poké Ball',
    chance: 0,
    top: '#ef4a3c',
    bottom: '#f4f4f6',
    quantity: 0,
  }
  const busy =
    throwPending || ['throw', 'absorb', 'drop', 'shake'].includes(phase)
  const nearMiss = phase === 'escaped' && shakeCount === 2

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (audio.current) void audio.current.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  useEffect(() => {
    setImage(imageSrc)
  }, [imageSrc])

  function playTone(
    frequency: number,
    startAfter = 0,
    duration = 0.12,
    type: OscillatorType = 'sine',
    volume = 0.07,
    endFrequency?: number,
  ) {
    if (mutedRef.current) return

    try {
      const context = (audio.current ??= new AudioContext())
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startAt = context.currentTime + startAfter
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, startAt)
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          startAt + duration,
        )
      }
      gain.gain.setValueAtTime(volume, startAt)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + duration)
    } catch {
      // Audio is optional; unsupported browser audio must not interrupt capture.
    }
  }

  function vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) navigator.vibrate(pattern)
  }

  async function launch(ballId: CaptureBall['id']) {
    if (phase !== 'ready' || !selectedBall) return
    setShakeCount(0)
    setError(null)
    setThrowPending(true)
    let result: CaptureResult
    try {
      result = await onThrow(ballId)
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'La capture a échoué. Réessaie.',
      )
      setThrowPending(false)
      return
    }
    setThrowPending(false)
    setBallsLeft(result.ballsLeft)

    const shakes = result.captured ? 3 : 1 + Math.floor(Math.random() * 2)
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const step = async (nextPhase: CapturePhase, duration: number) => {
      if (!alive.current) return false
      setPhase(nextPhase)
      await wait(reducedMotion ? 20 : duration)
      return alive.current
    }

    playTone(300, 0, 0.35, 'triangle', 0.06, 900)
    vibrate(20)
    if (!(await step('throw', 900))) return
    playTone(1200, 0, 0.3, 'sawtooth', 0.04, 200)
    vibrate(40)
    if (!(await step('absorb', 650))) return
    if (!(await step('drop', 750))) return

    setPhase('shake')
    for (let index = 1; index <= shakes; index += 1) {
      await wait(reducedMotion ? 20 : index === 1 ? 350 : 500)
      if (!alive.current) return
      setShakeCount(index)
      playTone(180, 0, 0.08, 'square', 0.06)
      playTone(120, 0.1, 0.1, 'square', 0.05)
      vibrate(30)
      await wait(reducedMotion ? 20 : 950)
      if (!alive.current) return
    }

    await wait(reducedMotion ? 20 : 300)
    if (!alive.current) return
    if (result.captured) {
      ;[523, 659, 784, 1047].forEach((frequency, index) =>
        playTone(frequency, index * 0.11, 0.28, 'triangle', 0.08),
      )
      vibrate([60, 40, 120])
    } else {
      playTone(400, 0, 0.5, 'sawtooth', 0.05, 90)
      vibrate(200)
    }
    setPhase(result.captured ? 'caught' : 'escaped')
    onFinish()
  }

  const ballPosition = {
    ready: 'ready',
    throw: 'throw',
    absorb: 'held',
    drop: 'drop',
    shake: 'ground',
    caught: 'ground',
    escaped: 'ground',
  }[phase]

  return (
    <div
      className='pokemon-capture-overlay'
      style={captureVars({
        '--capture-accent': accent,
        '--capture-ball-top': previewBall.top,
        '--capture-ball-bottom': previewBall.bottom,
      })}
    >
      <section
        className={`pokemon-capture-panel phase-${phase}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='pokemon-capture-title'
        aria-busy={busy}
      >
        <button
          className='pokemon-capture-icon-button pokemon-capture-close'
          type='button'
          onClick={onClose}
          disabled={busy}
          aria-label='Fermer la capture'
        >
          ×
        </button>
        <button
          className='pokemon-capture-icon-button pokemon-capture-mute'
          type='button'
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Activer le son' : 'Désactiver le son'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <div className='pokemon-capture-scene'>
          <div className='pokemon-capture-aura' />
          <div className='pokemon-capture-ground' />
          <img
            className={`pokemon-capture-pokemon${phase === 'absorb' ? ' is-absorbed' : ''}${phase === 'escaped' ? ' is-back' : ''}`}
            src={image}
            alt={name}
            style={{
              visibility: ['drop', 'shake', 'caught'].includes(phase)
                ? 'hidden'
                : 'visible',
            }}
            onError={() => {
              if (image !== fallbackImageSrc) setImage(fallbackImageSrc)
            }}
          />
          {phase === 'absorb' && <div className='pokemon-capture-flash' />}
          {phase === 'escaped' && (
            <div className='pokemon-capture-flash is-red' />
          )}
          {phase === 'caught' && (
            <>
              <div className='pokemon-capture-rays' />
              {confettiColors.map((color, index) =>
                Array.from({ length: 7 }, (_, item) => {
                  const confettiIndex = index * 7 + item
                  return (
                    <i
                      key={confettiIndex}
                      className='pokemon-capture-confetti'
                      style={captureVars({
                        '--confetti-x': `${((confettiIndex * 37) % 100) - 50}vw`,
                        '--confetti-rotation': `${(confettiIndex * 53) % 360}deg`,
                        '--confetti-color': color,
                        '--confetti-delay': `${(confettiIndex % 8) * 0.05}s`,
                      })}
                    />
                  )
                }),
              )}
            </>
          )}

          {(selectedBall || phase !== 'ready') && (
            <div className={`pokemon-capture-ball-position is-${ballPosition}`}>
              <div
                key={shakeCount}
                className={`pokemon-capture-ball${phase === 'ready' ? ' is-idle' : ''}${phase === 'shake' && shakeCount ? ' is-shaking' : ''}${phase === 'throw' ? ' is-spinning' : ''}${phase === 'escaped' ? ' is-open' : ''}${phase === 'caught' ? ' is-done' : ''}`}
              >
                <i className='pokemon-capture-ball-half is-top' />
                <i className='pokemon-capture-ball-half is-bottom' />
                <i className='pokemon-capture-ball-shade' />
                <i className='pokemon-capture-ball-gloss' />
                <i className='pokemon-capture-ball-seam' />
                <i className='pokemon-capture-ball-button'>
                  <b />
                </i>
              </div>
            </div>
          )}
        </div>

        {busy && (
          <div className='pokemon-capture-dots' aria-hidden='true'>
            {[1, 2, 3].map((number) => (
              <span
                key={number}
                className={`${shakeCount >= number ? 'is-lit' : ''}${shakeCount >= number && phase === 'escaped' ? ' is-failed' : ''}`}
              />
            ))}
          </div>
        )}

        <div className='pokemon-capture-copy' aria-live='polite'>
          {phase === 'ready' && !choosingBall && (
            <>
              <h3 id='pokemon-capture-title'>Un {name} sauvage !</h3>
              {selectedBall ? (
                <p>
                  {selectedBall.name} · <b>{selectedBall.chance}%</b> de chance
                </p>
              ) : (
                <p>Choisis une Poké Ball pour tenter la capture.</p>
              )}
              {error && <p className='pokemon-capture-error'>{error}</p>}
              {selectedBall ? (
                <div className='pokemon-capture-actions'>
                  <button
                    className='pokemon-capture-primary'
                    type='button'
                    onClick={() => void launch(selectedBall.id)}
                  >
                    Lancer !
                  </button>
                  <button
                    className='pokemon-capture-secondary'
                    type='button'
                    onClick={() => setChoosingBall(true)}
                  >
                    Changer de Poké Ball
                  </button>
                </div>
              ) : (
                <button
                  className='pokemon-capture-primary'
                  type='button'
                  onClick={() => setChoosingBall(true)}
                >
                  Choisir la Poké Ball
                </button>
              )}
            </>
          )}
          {phase === 'ready' && choosingBall && (
            <>
              <h3 id='pokemon-capture-title'>Choisis ta Poké Ball</h3>
              {!isAuthenticated ? (
                <>
                  <p>Connecte-toi pour capturer ce Pokémon.</p>
                  <button
                    className='pokemon-capture-primary'
                    type='button'
                    disabled={signInPending}
                    onClick={onSignIn}
                  >
                    {signInPending ? 'Connexion…' : 'Se connecter avec GitHub'}
                  </button>
                </>
              ) : balls === undefined ? (
                <p>Chargement de tes Poké Balls…</p>
              ) : (
                <div className='pokemon-capture-ball-list'>
                  {balls
                    .filter((item) => item.quantity > 0)
                    .map((item) => (
                      <button
                        className='pokemon-capture-ball-option'
                        type='button'
                        key={item.id}
                        onClick={() => {
                          setSelectedBallId(item.id)
                          setChoosingBall(false)
                          setError(null)
                        }}
                      >
                        <span
                          className={`pokemon-capture-ball-option-icon is-${item.id}`}
                          style={captureVars({
                            '--option-ball-top': item.top,
                            '--option-ball-bottom': item.bottom,
                          })}
                          aria-hidden='true'
                        />
                        <span className='pokemon-capture-ball-option-copy'>
                          <strong>{item.name}</strong>
                          <small>{item.chance}% de chance</small>
                        </span>
                        <span className='pokemon-capture-ball-option-quantity'>
                          ×{item.quantity}
                        </span>
                      </button>
                    ))}
                  {balls.every((item) => item.quantity < 1) && (
                    <p className='pokemon-capture-error'>
                      Tu n’as plus de Poké Ball.
                    </p>
                  )}
                </div>
              )}
              <button
                className='pokemon-capture-secondary'
                type='button'
                onClick={() => setChoosingBall(false)}
              >
                Retour
              </button>
            </>
          )}
          {busy && (
            <h3 id='pokemon-capture-title' className='is-dim'>
              {phase === 'shake'
                ? 'Ça bouge…'
                : phase === 'drop'
                  ? '…'
                  : 'Lancé !'}
            </h3>
          )}
          {phase === 'caught' && (
            <>
              <h3 id='pokemon-capture-title' className='is-gold'>
                Capturé !
              </h3>
              <p>{name} rejoint ta collection.</p>
              <button
                className='pokemon-capture-primary'
                type='button'
                onClick={onClose}
              >
                Continuer
              </button>
            </>
          )}
          {phase === 'escaped' && (
            <>
              <h3 id='pokemon-capture-title'>
                {nearMiss ? 'Si près !' : 'Il s’est échappé…'}
              </h3>
              <p>
                {nearMiss
                  ? `${name} a presque cédé. Retente ta chance !`
                  : `${name} a résisté à la ${selectedBall?.name ?? 'Poké Ball'}.`}
              </p>
              <div className='pokemon-capture-actions'>
                {ballsLeft > 0 && (
                  <button
                    className='pokemon-capture-primary'
                    type='button'
                    onClick={() => {
                      setSelectedBallId(null)
                      setShakeCount(0)
                      setChoosingBall(true)
                      setPhase('ready')
                    }}
                  >
                    Réessayer ({ballsLeft} restante{ballsLeft > 1 ? 's' : ''})
                  </button>
                )}
                <button
                  className='pokemon-capture-secondary'
                  type='button'
                  onClick={onClose}
                >
                  {ballsLeft > 0 ? 'Fuir' : 'Fermer'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
