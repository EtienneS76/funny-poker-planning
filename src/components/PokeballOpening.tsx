import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import {
  getPokemonById,
  getPokemonImageUrl,
  type PokemonRarity,
  type PokemonType,
} from '../features/pokemon/functions/GeneratePokemon'

type Props = {
  pokemonId: number
  shiny: boolean
  showPokemon3d: boolean
  canOpenAnother: boolean
  rerollsRemaining?: number | null
  onClose: () => void
  onOpenAnother: () => Promise<void>
  onKeepWelcomePokemon?: () => Promise<void>
}

const TYPE_COLOR: Record<PokemonType, string> = {
  normal: '#A8A77A',
  combat: '#C22E28',
  vol: '#8F7BF0',
  poison: '#A33EA1',
  sol: '#D2B24C',
  roche: '#B6A136',
  insecte: '#A8B820',
  spectre: '#5E4390',
  acier: '#8E94AE',
  feu: '#EE6B2F',
  eau: '#3F86F5',
  plante: '#5DBB3E',
  electrik: '#F7D02C',
  psy: '#F95587',
  glace: '#6CCFCB',
  dragon: '#4B22D6',
  tenebres: '#705848',
  fee: '#EE99AC',
}
const RARITY: Record<PokemonRarity, { label: string; glow: string }> = {
  commun: { label: 'Commune', glow: '#ffffff' },
  rare: { label: 'Rare', glow: '#6fd0ff' },
  epique: { label: 'Épique', glow: '#c27bff' },
  legendaire: { label: 'Légendaire', glow: '#ffd14a' },
  ultime: { label: 'Ultime', glow: '#ff70dd' },
}

/* Textures générées en SVG (aucun asset externe) */
const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`
const NOISE = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)
const GLITTER = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='1' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 16 -9.4'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
)

/* ───────── Composant ───────── */

type Stage = 'idle' | 'shaking' | 'opening' | 'revealing' | 'revealed'
const vars = (o: Record<string, string | number>) => o as CSSProperties

export default function PokeballOpening({
  pokemonId,
  shiny,
  showPokemon3d,
  canOpenAnother,
  rerollsRemaining = null,
  onClose,
  onOpenAnother,
  onKeepWelcomePokemon,
}: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [openingAnother, setOpeningAnother] = useState(false)
  const [keepingPokemon, setKeepingPokemon] = useState(false)
  const timers = useRef<number[]>([])
  const tilt = useRef<HTMLDivElement>(null)
  const ballEl = useRef<HTMLDivElement>(null)
  const mon = getPokemonById(pokemonId)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const open = () => {
    if (stage !== 'idle') return
    setStage('shaking')
    timers.current = [
      window.setTimeout(() => setStage('opening'), 1700),
      window.setTimeout(() => setStage('revealing'), 2700),
      window.setTimeout(() => setStage('revealed'), 3900),
    ]
  }

  async function openAnother() {
    if (!canOpenAnother || openingAnother) return
    setOpeningAnother(true)
    try {
      await onOpenAnother()
    } finally {
      setOpeningAnother(false)
    }
  }

  async function keepWelcomePokemon() {
    if (!onKeepWelcomePokemon || keepingPokemon) return
    setKeepingPokemon(true)
    try {
      await onKeepWelcomePokemon()
    } finally {
      setKeepingPokemon(false)
    }
  }

  const aim = (el: HTMLElement | null, e: PointerEvent, tiltDeg: number) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    const cx = x - 50,
      cy = y - 50
    const s = el.style
    s.setProperty('--mx', `${x}%`)
    s.setProperty('--my', `${y}%`)
    s.setProperty('--px', String(cx / 50))
    s.setProperty('--py', String(cy / 50))
    s.setProperty('--rx', `${(-cy / 50) * tiltDeg}deg`)
    s.setProperty('--ry', `${(cx / 50) * tiltDeg}deg`)
    s.setProperty('--hyp', String(Math.min(1, Math.hypot(cx, cy) / 60)))
    s.setProperty('--bgx', `${50 + cx}%`)
    s.setProperty('--bgy', `${50 + cy}%`)
    el.classList.add('hov')
  }
  const rest = (el: HTMLElement | null) => {
    if (!el) return
    el.classList.remove('hov')
    ;['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'))
  }

  const live =
    stage === 'opening' || stage === 'revealing' || stage === 'revealed'
  const detailsRevealed = stage === 'revealed'
  const glow = mon && live ? RARITY[mon.rarity].glow : '#ffffff'
  const c1 = mon ? TYPE_COLOR[mon.types[0]] : '#888'
  const c2 = mon ? TYPE_COLOR[mon.types[1] ?? mon.types[0]] : '#888'

  return (
    <div
      className='pk'
      style={vars({ '--glow': glow, '--noise': NOISE, '--glitter': GLITTER })}
    >
      <style>{CSS}</style>

      {live && <div className='screen-flash' />}

      <main className='stage'>
        {stage !== 'revealing' && stage !== 'revealed' && (
          <>
            <div className={`ball-wrap ${stage}`}>
              <div className='beam' />
              <div className='ground' />
              <div
                ref={ballEl}
                className={`ball${shiny ? ' ball--shiny' : ''}`}
                role='button'
                tabIndex={0}
                aria-label='Ouvrir la pokéball'
                onClick={open}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && open()
                }
                onPointerMove={(e) => aim(ballEl.current, e, 10)}
                onPointerLeave={() => rest(ballEl.current)}
              >
                <i className='hemi top' />
                <i className='hemi bottom' />
                <i className='shade' />
                <i className='gloss' />
                <i className='seam' />
                <i className='btn'>
                  <b />
                </i>
              </div>
            </div>
            <p className='hint'>
              {stage === 'idle'
                ? 'Touche la Poké Ball pour l’ouvrir'
                : '\u00A0'}
            </p>
          </>
        )}

        {(stage === 'revealing' || stage === 'revealed') && mon && (
          <div className='reveal'>
            {(mon.rarity === 'epique' ||
              mon.rarity === 'legendaire' ||
              mon.rarity === 'ultime') && <div className='rays' />}
            <div className='burst'>
              {Array.from({ length: 26 }, (_, i) => (
                <i
                  key={i}
                  style={vars({
                    '--a': `${(360 / 26) * i}deg`,
                    '--d': `${170 + ((i * 53) % 130)}px`,
                  })}
                />
              ))}
            </div>

            <div className='persp'>
              <div
                ref={tilt}
                className={`tilt r-${rarityClass(mon.rarity)}${detailsRevealed ? ' is-complete' : ''}`}
                style={vars({ '--c1': c1, '--c2': c2 })}
                onPointerMove={(e) => aim(tilt.current, e, 8)}
                onPointerLeave={() => rest(tilt.current)}
              >
                <article className='front'>
                  <div className='inner'>
                    <div className='card-content'>
                      <header>
                        <h2 className='pokemon-name'>
                          {detailsRevealed ? mon.name : '???'}
                        </h2>
                        <span className='tag'>
                          {shiny ? 'SHINY' : RARITY[mon.rarity].label}
                        </span>
                      </header>
                      <div
                        className={`art${detailsRevealed ? ' art--revealed' : ' art--mystery'}${shiny ? ' art--shiny' : ''}`}
                      >
                        {detailsRevealed ? (
                          <img
                            className={
                              shiny ? 'pokemon-shiny-image' : undefined
                            }
                            src={getPokemonImageUrl(
                              mon.id,
                              showPokemon3d,
                              shiny,
                            )}
                            alt={mon.name}
                            onError={(e) => {
                              const img = e.currentTarget
                              if (showPokemon3d && !img.dataset.fallback) {
                                img.dataset.fallback = 'true'
                                img.src = getPokemonImageUrl(
                                  mon.id,
                                  false,
                                  shiny,
                                )
                                img.classList.add('hd')
                              }
                            }}
                          />
                        ) : (
                          <span className='art-question' aria-hidden='true'>
                            ?
                          </span>
                        )}
                      </div>
                      <footer>
                        <div className='types'>
                          {mon.types.map((t) => (
                            <span key={t} style={{ background: TYPE_COLOR[t] }}>
                              {typeLabel(t)}
                            </span>
                          ))}
                        </div>
                        {detailsRevealed && (
                          <span className='num'>
                            N° {String(mon.id).padStart(3, '0')}
                          </span>
                        )}
                      </footer>
                    </div>
                    <i className='shine' />
                    <i className='sparkle' />
                    <i className='grain' />
                    <i className='glare' />
                  </div>
                </article>
              </div>
            </div>

            <div className='opening-actions'>
              <button
                className='again again--next'
                type='button'
                disabled={!canOpenAnother || openingAnother}
                onClick={() => void openAnother()}
              >
                {openingAnother
                  ? rerollsRemaining !== null
                    ? 'Nouveau tirage…'
                    : 'Ouverture…'
                  : rerollsRemaining !== null
                    ? `Renvoyer et essayer à nouveau (${rerollsRemaining} essai${rerollsRemaining > 1 ? 's' : ''} restant${rerollsRemaining > 1 ? 's' : ''})`
                    : canOpenAnother
                      ? 'Ouvrir une autre Poké Ball'
                      : 'Aucune autre Poké Ball'}
              </button>
              {onKeepWelcomePokemon ? (
                <button
                  className='again again--back'
                  type='button'
                  disabled={keepingPokemon || openingAnother}
                  onClick={() => void keepWelcomePokemon()}
                >
                  {keepingPokemon ? 'Équipement…' : 'Garder et équiper'}
                </button>
              ) : (
                <button
                  className='again again--back'
                  type='button'
                  onClick={onClose}
                >
                  Retour aux consommables
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function rarityClass(rarity: PokemonRarity) {
  switch (rarity) {
    case 'commun':
      return 'common'
    case 'epique':
      return 'epic'
    case 'legendaire':
    case 'ultime':
      return 'legendary'
    case 'rare':
      return 'rare'
  }
}

function typeLabel(type: PokemonType) {
  const labels: Record<PokemonType, string> = {
    normal: 'Normal',
    combat: 'Combat',
    vol: 'Vol',
    poison: 'Poison',
    sol: 'Sol',
    roche: 'Roche',
    insecte: 'Insecte',
    spectre: 'Spectre',
    acier: 'Acier',
    feu: 'Feu',
    eau: 'Eau',
    plante: 'Plante',
    electrik: 'Électrik',
    psy: 'Psy',
    glace: 'Glace',
    dragon: 'Dragon',
    tenebres: 'Ténèbres',
    fee: 'Fée',
  }
  return labels[type]
}

/* ───────── Styles ───────── */

const RAINBOW =
  'repeating-linear-gradient(115deg,#ff2d6f 0%,#ffd23f 7%,#2be37f 14%,#27c3ff 21%,#8b5cff 28%,#ff2d6f 35%)'
const CSS = `
@property --hyp{syntax:'<number>';inherits:true;initial-value:0}
@property --bgx{syntax:'<percentage>';inherits:true;initial-value:50%}
@property --bgy{syntax:'<percentage>';inherits:true;initial-value:50%}
.pk{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;color:#fff;
  font-family:"Avenir Next","Segoe UI",system-ui,sans-serif;background:transparent}
.stage{position:relative;width:100%;height:100%;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:34px 16px 20px}
.hint{margin:0;color:#fff;opacity:.82;letter-spacing:.02em;text-align:center}
.screen-flash{position:absolute;inset:0;z-index:20;pointer-events:none;opacity:0;
  background:radial-gradient(circle at 50% 48%,var(--glow) 0%,#fff0 70%);animation:sflash 1.6s ease-out}

/* ── Pokéball ── */
.ball-wrap{position:relative;width:210px;height:230px;transform:scale(.82);margin:-18px 0}
.ground{position:absolute;left:8%;bottom:-4px;width:84%;height:30px;border-radius:50%;
  background:radial-gradient(ellipse,#000b,#0000 70%);animation:gshadow 3.2s ease-in-out infinite}
.ball{position:absolute;left:0;top:0;width:240px;height:240px;border-radius:50%;cursor:pointer;outline:0;
  --px:0;--py:0;--rx:0deg;--ry:0deg;--mx:50%;--my:50%;
  transform:perspective(700px) rotateX(var(--rx)) rotateY(var(--ry));transition:transform .15s;
  filter:drop-shadow(0 22px 22px #000a)}
.ball--shiny{filter:drop-shadow(0 22px 22px #0008) drop-shadow(0 0 18px #ffca28)}
.ball--shiny::before{content:"";position:absolute;inset:-9px;border:3px solid #ffe276;border-radius:50%;
  box-shadow:0 0 16px #ffca28,inset 0 0 14px #fff3aa;pointer-events:none;animation:shiny-ball-glow 1.5s ease-in-out infinite}
.ball:focus-visible{box-shadow:0 0 0 4px #fff8}
.ball-wrap.idle .ball:not(.hov){animation:float 3.2s ease-in-out infinite}
.ball-wrap.shaking .ball{animation:shake 1.7s cubic-bezier(.36,.07,.19,.97) both;transform-origin:50% 100%}
.ball i{position:absolute;display:block;pointer-events:none}
.hemi{inset:0;border-radius:50%;transition:transform .85s cubic-bezier(.3,.8,.2,1),opacity .85s .1s}
.hemi.top{clip-path:inset(0 0 50% 0);transform-origin:0 50%;
  background:radial-gradient(circle at 30% 22%,#ffe2f0 0%,#ff92c7 20%,#ed5fae 46%,#a82f82 76%,#411840 100%)}
.ball--shiny .hemi.top{background:radial-gradient(circle at 30% 22%,#fffbd0 0%,#ffe878 20%,#f6bd25 46%,#c98209 76%,#563700 100%)}
.hemi.bottom{clip-path:inset(50% 0 0 0);
  background:radial-gradient(circle at 30% 78%,#fff 0%,#f8f0ff 26%,#dfd0f2 54%,#ad9acb 84%,#655477 100%)}
.ball--shiny .hemi.bottom{background:radial-gradient(circle at 30% 78%,#fffef0 0%,#fff5b4 26%,#e8d27d 54%,#b69543 84%,#685122 100%)}
/* matière : grain + reflets anisotropes + rim light */
.shade{inset:0;border-radius:50%;
  background:
    conic-gradient(from 200deg,#0000 0 9%,#ffffff40 13%,#0000 22%,#0000 58%,#ffffff22 64%,#0000 72%),
    var(--noise);
  background-size:100% 100%,160px;background-blend-mode:soft-light,normal;mix-blend-mode:soft-light;opacity:.9;
  box-shadow:inset -14px -18px 36px #000a,inset 8px 10px 22px #ffffff38,inset 0 0 0 2px #ffffff1c}
.gloss{left:13%;top:7%;width:40%;height:24%;border-radius:50%;filter:blur(1.2px);
  background:linear-gradient(165deg,#fffd,#fff0 85%);
  transform:translate(calc(var(--px)*-7px),calc(var(--py)*-7px)) rotate(-28deg)}
.seam{left:0;top:calc(50% - 9px);width:100%;height:18px;transition:opacity .25s;
  background:linear-gradient(#050506,#2e2e35 45%,#0b0b0e);
  box-shadow:0 1px 0 #ffffff25 inset,0 -1px 0 #000 inset}
.seam::before{content:"";position:absolute;inset:-14px 6%;opacity:0;border-radius:50%;
  background:radial-gradient(ellipse,#fff 0%,#fff0 70%);filter:blur(3px)}
.btn{left:calc(50% - 40px);top:calc(50% - 40px);width:80px;height:80px;border-radius:50%;transition:opacity .25s;
  background:radial-gradient(circle at 35% 30%,#a883bb,#493452 55%,#24172d);
  box-shadow:0 0 0 3px #0a0a0d,0 6px 12px #0009,inset 0 2px 3px #ffffff30}
.ball--shiny .btn{background:radial-gradient(circle at 35% 30%,#fff3a4,#a8740a 55%,#4b3400)}
.btn::before{content:"";position:absolute;inset:12px;border-radius:50%;
  background:radial-gradient(circle at 35% 28%,#fff,#f6e5fc 55%,#c79aca);box-shadow:inset 0 -4px 8px #0005}
.ball--shiny .btn::before{background:radial-gradient(circle at 35% 28%,#fff,#fff4ae 55%,#dfb331)}
.btn b{position:absolute;inset:28px;border-radius:50%;z-index:1;
  background:radial-gradient(circle at 40% 35%,#fff,#f7e9fc 55%,#cfacd6);box-shadow:inset 0 -3px 5px #0004,0 0 0 0 #fff}
.ball--shiny .btn b{background:radial-gradient(circle at 40% 35%,#fff,#fff8c8 55%,#e4b931);box-shadow:inset 0 -3px 5px #0004,0 0 9px 3px #ffe988}
.ball-wrap.shaking .seam::before{animation:leak 1.7s ease-in forwards}
.ball-wrap.shaking .btn b{animation:led .42s ease-in-out infinite}

/* ouverture : les deux moitiés s'écartent, la lumière jaillit */
.ball-wrap.opening .hemi.top{transform:rotate(-48deg) translate(-26px,-46px);opacity:0}
.ball-wrap.opening .hemi.bottom{transform:translateY(54px) rotate(5deg);opacity:0}
.ball-wrap.opening .seam,.ball-wrap.opening .btn,.ball-wrap.opening .shade,.ball-wrap.opening .gloss{opacity:0}
.beam{position:absolute;left:50%;bottom:50%;width:420px;height:900px;margin-left:-210px;opacity:0;
  transform-origin:50% 100%;transform:scaleY(0);filter:blur(14px);
  background:linear-gradient(to top,var(--glow),#fff0 85%);clip-path:polygon(38% 100%,62% 100%,100% 0,0 0)}
.ball-wrap.opening .beam{animation:beam 1s ease-out forwards}

/* ── Carte ── */
.reveal{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px}
.rays{position:absolute;left:50%;top:210px;width:900px;height:900px;margin:-450px 0 0 -450px;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,var(--glow) 0 6deg,#0000 6deg 18deg);opacity:.12;
  -webkit-mask:radial-gradient(circle,#000 0%,#0000 66%);mask:radial-gradient(circle,#000 0%,#0000 66%);animation:spin 28s linear infinite}
.persp{perspective:1100px;position:relative;z-index:2}
.tilt{position:relative;width:260px;height:364px;border-radius:18px;touch-action:none;
  --mx:50%;--my:50%;--px:0;--py:0;--rx:0deg;--ry:0deg;--hyp:0;
  transform:rotateX(var(--rx)) rotateY(var(--ry));transition:transform .22s;
  filter:drop-shadow(0 12px 20px #33233a55)}
.front{position:absolute;inset:0;overflow:hidden;padding:5px;border-radius:18px;isolation:isolate;
  background:var(--rim);animation:card-enter .55s cubic-bezier(.2,.75,.25,1) both}
.inner{position:relative;isolation:isolate;width:100%;height:100%;border:1px solid #ffffffa8;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;padding:13px;color:#30233b;
  background:radial-gradient(ellipse at 50% 15%,#fff9,transparent 60%),
    linear-gradient(160deg,#fffaf2,#f2eafb 62%,#f8e6ef)}
.card-content{position:relative;z-index:3;display:flex;flex:1;min-height:0;flex-direction:column}
.inner header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0 10px;border-bottom:1px solid #49375624}
.inner h2{margin:0;font-size:25px;font-weight:800;letter-spacing:-.01em;text-shadow:0 1px 0 #fff7}
.tag{font-size:12px;font-weight:800;padding:4px 10px;border:1px solid color-mix(in srgb,var(--glow) 55%,#fff);border-radius:99px;background:color-mix(in srgb,var(--glow) 22%,#fff);color:#493756;white-space:nowrap}
.art{position:relative;z-index:8;isolation:isolate;flex:1;margin:12px 0;border-radius:12px;overflow:hidden;
  border:1px solid #49375620;box-shadow:inset 0 1px 3px #49375612;
  background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--glow) 24%,#fff),transparent 67%),
    linear-gradient(145deg,color-mix(in srgb,var(--c1) 18%,#fff),color-mix(in srgb,var(--c2) 14%,#fff))}
.art--shiny{border-color:#dfb432;box-shadow:inset 0 1px 3px #fff9,0 0 18px #e9bd3f70;
  background:radial-gradient(circle at 50% 50%,#ffdc6655,transparent 70%),linear-gradient(145deg,#fff7d9,#fffdf4)}
.art img{position:absolute;z-index:2;left:9%;top:9%;width:82%;height:82%;object-fit:contain;image-rendering:pixelated;
  transform:translate(calc(var(--px)*9px),calc(var(--py)*7px));transition:transform .12s;
  filter:drop-shadow(0 8px 8px #352a3b38);animation:pokemon-fade .55s ease-out both}
.art img.pokemon-shiny-image{filter:drop-shadow(0 0 8px #ffd84d) drop-shadow(0 0 18px #e9ad26) drop-shadow(0 8px 8px #352a3b38)}
.art img.hd{image-rendering:auto}
.art-question{position:absolute;inset:0;display:grid;place-items:center;color:color-mix(in srgb,var(--glow) 62%,#493756);font-size:84px;font-weight:800;opacity:.72}
.inner footer{display:flex;justify-content:space-between;align-items:center;min-height:30px}
.types{display:flex;gap:7px}
.types span{padding:4px 11px;border-radius:99px;font-size:12px;font-weight:750;color:#fff;border:1px solid #ffffffc0;text-shadow:0 1px 2px #0008;box-shadow:0 2px 5px #30233b20}
.num{font-size:12px;font-weight:700;opacity:.75;animation:pokemon-fade .45s ease-out both}
.pokemon-name{animation:pokemon-fade .45s ease-out both}

/* rareté : cadre */
.r-common{--rim:linear-gradient(145deg,#e8e2d6,#aaa394)}
.r-rare{--rim:linear-gradient(145deg,#dbeaf5,#83a6c1 50%,#e2eefa)}
.r-epic{--rim:linear-gradient(145deg,#eddafa,#a781c5 50%,#f2e4fa)}
.r-legendary{--rim:linear-gradient(145deg,#fff1bd,#d8a747 48%,#f9e8b2)}

/* couches holo (principe de pokemon-cards-css : dégradé + grain, color-dodge, piloté par le pointeur) */
.inner .shine,.inner .sparkle,.inner .grain,.inner .glare{position:absolute;inset:0;border-radius:14px;pointer-events:none;display:block}
.shine{z-index:0;mix-blend-mode:color-dodge;opacity:0}
.sparkle{z-index:1;mix-blend-mode:color-dodge;opacity:0}
.grain{z-index:1;mix-blend-mode:overlay;background:var(--noise);background-size:160px;opacity:.12}
.glare{z-index:1;mix-blend-mode:overlay;opacity:calc(.08 + var(--hyp)*.2);
  background:radial-gradient(farthest-corner circle at var(--mx) var(--my),#fffc 8%,#ffffffa6 18%,#0007 90%)}
.r-rare .shine{opacity:calc(.3 + var(--hyp)*.4);filter:brightness(.8) contrast(1.35);
  background-image:${RAINBOW},var(--noise);background-size:280% 280%,180px;
  background-position:var(--bgx) var(--bgy),0 0;background-blend-mode:overlay}
.r-epic .shine{opacity:calc(.22 + var(--hyp)*.2);background-image:linear-gradient(120deg,#fff0 20%,#fff9 45%,#fff0 70%);background-size:220% 220%;background-position:var(--bgx) var(--bgy)}
.r-legendary .shine{opacity:calc(.28 + var(--hyp)*.2);filter:brightness(1.05) contrast(1.15) saturate(1.1);
  background-image:linear-gradient(125deg,#ffe27d33 5%,#fff6c466 38%,#d9961a33 52%,#ffe27d55 68%,#6b460022 90%);
  background-size:220% 220%;background-position:var(--bgx) var(--bgy);background-blend-mode:soft-light}
.r-epic .sparkle,.r-legendary .sparkle{opacity:calc(.12 + var(--hyp)*.2);filter:brightness(1.2) contrast(1.1);
  background-image:var(--glitter),var(--glitter);background-size:150px,95px;
  background-position:calc(var(--px)*30px) calc(var(--py)*30px),calc(var(--px)*-22px + 40px) calc(var(--py)*-22px + 20px)}

.opening-actions{position:relative;z-index:9;display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.again{z-index:2;background:#f4deef;color:#54344f;border:1px solid #d8b4d4;border-radius:99px;padding:11px 20px;font:inherit;font-weight:700;cursor:pointer}
.again:hover:not(:disabled){background:#ebc9e5}
.again:disabled{cursor:not-allowed;opacity:.58}
.again--back{background:#ffffffa8;color:#5e5265;border-color:#ffffff80}
.burst{position:absolute;left:50%;top:210px;width:0;height:0;pointer-events:none}
.burst i{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--glow);box-shadow:0 0 10px var(--glow);
  animation:fly 1.1s .15s ease-out both}

@keyframes float{50%{transform:perspective(700px) translateY(-14px)}}
@keyframes shiny-ball-glow{0%,100%{opacity:.55;transform:scale(.98)}50%{opacity:1;transform:scale(1.03)}}
@keyframes gshadow{50%{transform:scale(.86);opacity:.7}}
@keyframes shake{
  0%,100%{transform:rotate(0)}
  10%{transform:translateX(-8px) rotate(-10deg)} 20%{transform:translateX(8px) rotate(10deg)}
  30%{transform:translateX(-8px) rotate(-12deg)} 40%{transform:translateX(8px) rotate(12deg)}
  55%{transform:translateX(-12px) rotate(-17deg)} 70%{transform:translateX(12px) rotate(17deg)}
  85%{transform:translateX(-15px) rotate(-22deg)} 95%{transform:translateX(15px) rotate(22deg)}}
@keyframes leak{from{opacity:0}to{opacity:1}}
@keyframes led{50%{box-shadow:inset 0 -3px 5px #0004,0 0 18px 6px #fff}}
@keyframes beam{0%{opacity:0;transform:scaleY(0)}35%{opacity:1}100%{opacity:0;transform:scaleY(1)}}
@keyframes sflash{0%{opacity:0}20%{opacity:.95}100%{opacity:0}}
@keyframes card-enter{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes pokemon-fade{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fly{from{transform:rotate(var(--a)) translateX(0);opacity:1}to{transform:rotate(var(--a)) translateX(var(--d));opacity:0}}
@media (max-height:640px){
  .tilt{width:220px;height:308px}
  .reveal{gap:10px}
  .stage{gap:12px}
}
@media (max-width:520px){
  .opening-actions{width:100%;flex-direction:column;align-items:stretch}
  .again{width:100%;padding:10px 12px}
  .tilt{width:230px;height:322px}
}
@media (prefers-reduced-motion:reduce){
  .front,.art img,.pokemon-name,.num,.ball,.ball--shiny::before,.rays{animation:none!important}}
`
